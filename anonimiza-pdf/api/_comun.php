<?php
// _comun.php — sesiones, credenciales de usuarios y el libro de créditos.
// Ningún otro fichero debe leer o escribir usuarios.json directamente:
// todos pasan por las funciones de aquí para que el candado de escritura
// (flock) se respete siempre.

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
// Every response here is per-session account data (credits, plan, history).
// Without an explicit directive Hostinger's edge CDN applies its own default
// (observed: "public, max-age=3600" + cache HIT) and can serve one user's
// account data to a different visitor hitting the same endpoint. Never cache.
header('Cache-Control: no-store, no-cache, must-revalidate, private, max-age=0');
header('Pragma: no-cache');
header('Expires: 0');

$PLANES = [
  'gratis'  => ['nombre' => 'Gratis',  'precio' => 0,  'creditos' => 5],
  'pro'     => ['nombre' => 'Pro',     'precio' => 19, 'creditos' => 200],
  'empresa' => ['nombre' => 'Empresa', 'precio' => 59, 'creditos' => 1000],
];

// ---------- Dónde vive la base de datos ----------
// api/ vive en .../public_html/anonimiza/api/  (anonimiza.utilix.uno es un
// subdominio anidado dentro del public_html del dominio principal).
// Subir SOLO un nivel (".../public_html/") sigue estando dentro del árbol
// que se borra al publicar el sitio principal, así que subimos DOS niveles
// hasta ".../domains/utilix.uno/", que ningún despliegue estático toca.
function ruta_base_fuera() {
  return dirname(dirname(dirname(__DIR__))) . '/anonimiza_datos';
}
function ruta_db() {
  $fuera = ruta_base_fuera();
  if (is_dir($fuera) || @mkdir($fuera, 0750, true)) {
    if (is_writable($fuera)) return $fuera . '/usuarios.json';
  }
  // Último recurso: dentro de public_html/anonimiza/datos (protegido por .htaccess,
  // pero SÍ se borra en cada despliegue de este subdominio — solo para que la
  // demo nunca se caiga si el hosting no permite escribir fuera).
  return __DIR__ . '/../datos/usuarios.json';
}

function db_leer() {
  $ruta = ruta_db();
  if (!is_file($ruta)) return ['usuarios' => [], 'sesiones' => []];
  $fh = @fopen($ruta, 'r');
  if (!$fh) return ['usuarios' => [], 'sesiones' => []];
  flock($fh, LOCK_SH);
  $raw = stream_get_contents($fh);
  flock($fh, LOCK_UN);
  fclose($fh);
  $d = json_decode($raw, true);
  if (!is_array($d)) $d = [];
  if (!isset($d['usuarios'])) $d['usuarios'] = [];
  if (!isset($d['sesiones'])) $d['sesiones'] = [];
  return $d;
}

// Lee, aplica $fn($db) -> $db modificado, escribe con candado exclusivo.
// $fn debe devolver [$db, $resultado] o lanzar una excepción para abortar.
function db_transaccion($fn) {
  $ruta = ruta_db();
  $dir = dirname($ruta);
  if (!is_dir($dir)) @mkdir($dir, 0750, true);
  $fh = @fopen($ruta, 'c+');
  if (!$fh) return [null, false];
  flock($fh, LOCK_EX);
  $raw = stream_get_contents($fh);
  $d = json_decode($raw, true);
  if (!is_array($d)) $d = [];
  if (!isset($d['usuarios'])) $d['usuarios'] = [];
  if (!isset($d['sesiones'])) $d['sesiones'] = [];
  try {
    list($d2, $resultado) = $fn($d);
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, json_encode($d2, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    fflush($fh);
    flock($fh, LOCK_UN);
    fclose($fh);
    return [$d2, $resultado];
  } catch (Exception $e) {
    flock($fh, LOCK_UN);
    fclose($fh);
    return [null, false];
  }
}

// ---------- JSON de entrada ----------
function leer_json_entrada() {
  $raw = file_get_contents('php://input');
  $d = json_decode($raw, true);
  return is_array($d) ? $d : [];
}
function responder($arr, $code = 200) {
  http_response_code($code);
  echo json_encode($arr, JSON_UNESCAPED_UNICODE);
  exit;
}
function error_humano($msg, $code = 400, $extra = []) {
  responder(array_merge(['error' => $msg], $extra), $code);
}

// ---------- Sesiones ----------
function cookie_segura() {
  return !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
}
function crear_sesion(&$db, $email) {
  $token = bin2hex(random_bytes(32));
  $db['sesiones'][$token] = ['email' => $email, 'expira' => date('c', time() + 30 * 86400)];
  setcookie('sesion', $token, [
    'expires' => time() + 30 * 86400, 'path' => '/', 'httponly' => true,
    'samesite' => 'Lax', 'secure' => cookie_segura(),
  ]);
  return $db;
}
function borrar_cookie_sesion() {
  setcookie('sesion', '', ['expires' => time() - 3600, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax', 'secure' => cookie_segura()]);
}
function usuario_de_sesion($db) {
  $token = $_COOKIE['sesion'] ?? '';
  if ($token === '' || !isset($db['sesiones'][$token])) return null;
  $s = $db['sesiones'][$token];
  if (isset($s['expira']) && strtotime($s['expira']) < time()) return null;
  $email = $s['email'];
  if (!isset($db['usuarios'][$email])) return null;
  return $email;
}
function requerir_sesion($db) {
  $email = usuario_de_sesion($db);
  if ($email === null) error_humano('Tu sesión ha caducado. Vuelve a iniciar sesión.', 401);
  return $email;
}

// ---------- Renovación mensual simulada (mockup) ----------
function aplicar_renovacion_si_toca(&$u) {
  global $PLANES;
  if ($u['plan'] === 'gratis' || empty($u['renovacion'])) return $u;
  if (strtotime($u['renovacion']) <= time()) {
    $plan = $PLANES[$u['plan']] ?? $PLANES['gratis'];
    $u['creditos'] = $plan['creditos'];
    $u['renovacion'] = date('c', strtotime('+30 days'));
    $u['historial'][] = ['fecha' => date('c'), 'accion' => 'renovacion', 'plan' => $u['plan']];
  }
  return $u;
}

function usuario_publico($u) {
  return [
    'email' => $u['email'], 'plan' => $u['plan'], 'creditos' => $u['creditos'],
    'renovacion' => $u['renovacion'] ?? null, 'creado' => $u['creado'] ?? null,
    'historial' => array_slice($u['historial'] ?? [], -80),
  ];
}

// ---------- Límite de intentos de login ----------
function rate_limit_login($email) {
  $tmp = sys_get_temp_dir() . '/anonimiza_login_' . md5(strtolower($email)) . '.json';
  $now = time();
  $stamps = is_file($tmp) ? json_decode(@file_get_contents($tmp), true) : [];
  if (!is_array($stamps)) $stamps = [];
  $stamps = array_values(array_filter($stamps, function ($t) use ($now) { return $t > $now - 900; }));
  if (count($stamps) >= 5) return false;
  $stamps[] = $now;
  @file_put_contents($tmp, json_encode($stamps), LOCK_EX);
  return true;
}
