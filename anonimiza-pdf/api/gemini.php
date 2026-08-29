<?php
// gemini.php — el ÚNICO archivo que toca las claves de la IA.
// El navegador nunca habla con Claude ni con Google: habla con los ficheros
// de api/, en el propio dominio. Dos motores, un trabajo: Claude Haiku por
// defecto, Gemini de respaldo. Con una sola clave el producto ya funciona.

$MODELO_CLAUDE = 'claude-haiku-4-5';
// La familia 2.5 de Gemini está retirada para claves nuevas. Estos responden hoy.
// NO añadir thinkingConfig: los modelos *-lite dan HTTP 400 si se incluye.
$MODELS_GEMINI = ['gemini-3.5-flash', 'gemini-3.6-flash', 'gemini-flash-latest'];
$PER_MIN    = 20;
$PER_DAY    = 300;
$GLOBAL_DAY = 2000;
$TIMEOUT    = 60;

// ---------- Claves: entorno -> fuera de public_html -> respaldo local ----------
// api/ vive en .../public_html/anonimiza/api/ — subir tres niveles llega a
// .../domains/utilix.uno/, fuera de cualquier carpeta que un despliegue
// estático pueda borrar (igual que ruta_base_fuera() en _comun.php).
function ia_carpeta_fuera() { return dirname(dirname(dirname(__DIR__))); }

function ia_key_claude() {
  $k = getenv('ANTHROPIC_API_KEY');
  if (!$k && is_file(ia_carpeta_fuera() . '/anthropic_api_key.php')) $k = @include ia_carpeta_fuera() . '/anthropic_api_key.php';
  if (!$k && is_file(__DIR__ . '/../datos/anthropic_config.php')) $k = @include __DIR__ . '/../datos/anthropic_config.php';
  $k = is_string($k) ? trim($k) : '';
  return ($k !== '' && $k !== 'TU_CLAVE_AQUI') ? $k : '';
}
function ia_key_gemini() {
  $k = getenv('GEMINI_API_KEY');
  if (!$k && is_file(ia_carpeta_fuera() . '/gemini_api_key.php')) $k = @include ia_carpeta_fuera() . '/gemini_api_key.php';
  if (!$k && is_file(__DIR__ . '/../datos/gemini_config.php')) $k = @include __DIR__ . '/../datos/gemini_config.php';
  $k = is_string($k) ? trim($k) : '';
  return ($k !== '' && $k !== 'TU_CLAVE_AQUI') ? $k : '';
}
function ia_hay_clave() { return ia_key_claude() !== '' || ia_key_gemini() !== ''; }

// ---------- Límites de uso (por encima del sistema de créditos) ----------
function ia_limites($prefijo) {
  global $PER_MIN, $PER_DAY, $GLOBAL_DAY;
  $ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
  $tmp = sys_get_temp_dir(); $now = time(); $hoy = date('Ymd');

  $ipFile = $tmp . '/' . $prefijo . '_rl_' . md5($ip) . '.json';
  $stamps = is_file($ipFile) ? json_decode(@file_get_contents($ipFile), true) : [];
  if (!is_array($stamps)) $stamps = [];
  $enMin = array_filter($stamps, function ($t) use ($now) { return $t > $now - 60; });
  $enDia = array_filter($stamps, function ($t) use ($now) { return $t > $now - 86400; });
  if (count($enMin) >= $PER_MIN) return 'rate_min';
  if (count($enDia) >= $PER_DAY) return 'rate_day';

  $gFile  = $tmp . '/' . $prefijo . '_rl_global_' . $hoy . '.txt';
  $gCount = is_file($gFile) ? (int) @file_get_contents($gFile) : 0;
  if ($gCount >= $GLOBAL_DAY) return 'rate_global';

  $stamps[] = $now;
  $stamps = array_slice($stamps, -600);
  @file_put_contents($ipFile, json_encode(array_values($stamps)), LOCK_EX);
  @file_put_contents($gFile, (string) ($gCount + 1), LOCK_EX);
  return '';
}

// ---------- Llamada HTTP genérica ----------
function ia_http($url, $headers, $body, $timeout = null) {
  global $TIMEOUT;
  $ch = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_HTTPHEADER     => $headers,
    CURLOPT_POSTFIELDS     => $body,
    CURLOPT_TIMEOUT        => $timeout ?: $TIMEOUT,
  ]);
  $resp = curl_exec($ch);
  $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
  $err  = curl_error($ch);
  curl_close($ch);
  return [$resp, $code, $err];
}

// ---------- Motor Claude (Anthropic) — por defecto para texto ----------
function ia_claude($system, $prompt, $maxTokens = 2000) {
  global $MODELO_CLAUDE;
  $key = ia_key_claude();
  if ($key === '') return ['ok' => false, 'motivo' => 'sin_clave_claude'];
  $body = json_encode([
    'model' => $MODELO_CLAUDE, 'max_tokens' => $maxTokens,
    'system' => $system, 'messages' => [['role' => 'user', 'content' => $prompt]],
  ], JSON_UNESCAPED_UNICODE);
  list($resp, $code, $err) = ia_http('https://api.anthropic.com/v1/messages',
    ['content-type: application/json', 'x-api-key: ' . $key, 'anthropic-version: 2023-06-01'], $body);
  if ($resp === false || $code >= 400) { @error_log("[claude] http $code $err " . substr((string) $resp, 0, 200)); return ['ok' => false, 'motivo' => "claude http $code"]; }
  $texto = json_decode($resp, true)['content'][0]['text'] ?? '';
  return $texto !== '' ? ['ok' => true, 'texto' => $texto] : ['ok' => false, 'motivo' => 'claude_vacio'];
}

// ---------- Motor Gemini — respaldo de texto ----------
function ia_gemini($system, $prompt, $maxTokens = 4096) {
  global $MODELS_GEMINI;
  $key = ia_key_gemini();
  if ($key === '') return ['ok' => false, 'motivo' => 'sin_clave_gemini'];
  $payload = [
    'system_instruction' => ['parts' => [['text' => $system]]],
    'contents'           => [['role' => 'user', 'parts' => [['text' => $prompt]]]],
    'generationConfig'   => ['temperature' => 0.1, 'topP' => 0.9, 'maxOutputTokens' => $maxTokens, 'responseMimeType' => 'application/json'],
    'safetySettings'     => [
      ['category' => 'HARM_CATEGORY_HARASSMENT',        'threshold' => 'BLOCK_ONLY_HIGH'],
      ['category' => 'HARM_CATEGORY_HATE_SPEECH',       'threshold' => 'BLOCK_ONLY_HIGH'],
      ['category' => 'HARM_CATEGORY_SEXUALLY_EXPLICIT', 'threshold' => 'BLOCK_ONLY_HIGH'],
      ['category' => 'HARM_CATEGORY_DANGEROUS_CONTENT', 'threshold' => 'BLOCK_ONLY_HIGH'],
    ],
  ];
  $body = json_encode($payload, JSON_UNESCAPED_UNICODE);
  $ultimo = '';
  foreach ($MODELS_GEMINI as $model) {
    $url = 'https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode($model) . ':generateContent?key=' . urlencode($key);
    list($resp, $code, $err) = ia_http($url, ['Content-Type: application/json'], $body);
    if ($resp === false || $code >= 400) { $ultimo = "$model http $code"; continue; }
    $texto = json_decode($resp, true)['candidates'][0]['content']['parts'][0]['text'] ?? '';
    if ($texto !== '') return ['ok' => true, 'texto' => $texto];
    $ultimo = "$model vacio";
  }
  @error_log('[gemini] ' . $ultimo);
  return ['ok' => false, 'motivo' => $ultimo];
}

// ---------- Texto: Claude primero, Gemini de respaldo ----------
function ia_texto($system, $prompt, $maxTokens = 2000) {
  $r = ia_claude($system, $prompt, $maxTokens);
  if ($r['ok']) return $r;
  return ia_gemini($system, $prompt, max($maxTokens, 4096));
}

// ---------- Ayuda: extraer JSON aunque venga con ``` o texto alrededor ----------
function ia_json($texto) {
  $t = trim($texto);
  $t = preg_replace('/^```(?:json)?/m', '', $t);
  $t = preg_replace('/```$/m', '', $t);
  $d = json_decode(trim($t), true);
  if (!is_array($d)) {
    $a = strpos($t, '{'); $b = strrpos($t, '}');
    if ($a !== false && $b !== false && $b > $a) $d = json_decode(substr($t, $a, $b - $a + 1), true);
  }
  return is_array($d) ? $d : null;
}

// ---------- Prompt específico de censurar-pdf ----------
function ia_system_censura() {
  return 'Eres un asistente que ayuda a anonimizar documentos en español. Recibes el texto de UNA página de un documento (contrato, nómina, factura, DNI, etc.) y debes localizar los datos personales de PERSONAS FÍSICAS. Devuelves EXCLUSIVAMENTE un objeto JSON válido, sin texto adicional y sin ```.';
}
function ia_prompt_censura($texto) {
  return "Analiza el siguiente texto extraído de una página de un documento y localiza los datos personales de personas físicas (no de empresas).\n\n" .
    "Tipos permitidos (usa EXACTAMENTE estos identificadores):\n" .
    "- nombre: nombres y apellidos de personas físicas\n" .
    "- dni: DNI o NIE\n" .
    "- telefono: números de teléfono personales\n" .
    "- email: direcciones de email personales\n" .
    "- direccion: direcciones postales completas (calle, número, piso, ciudad)\n" .
    "- iban: números de cuenta bancaria / IBAN\n" .
    "- fecha_nacimiento: fechas de nacimiento\n\n" .
    "Reglas OBLIGATORIAS:\n" .
    "- \"texto\" debe ser el fragmento LITERAL, copiado carácter a carácter tal y como aparece en el documento, y COMPLETO (la dirección entera, el IBAN entero).\n" .
    "- NO marques los datos de la empresa o entidad que emite el documento (su CIF, su dirección fiscal, su teléfono o email de atención al cliente): solo personas físicas.\n" .
    "- NO marques importes de dinero, números de factura, de contrato o de referencia, ni fechas que no sean de nacimiento (fecha del documento, vencimientos, etc.).\n" .
    "- Si no hay ningún dato personal en el texto, responde { \"detecciones\": [] }. No inventes nada que no esté literalmente en el texto.\n\n" .
    "Responde EXCLUSIVAMENTE con este JSON (sin texto adicional, sin ```):\n" .
    "{ \"detecciones\": [ { \"tipo\": string, \"texto\": string } ] }\n\n" .
    "Texto de la página:\n---\n" . $texto . "\n---";
}

$TIPOS_PERMITIDOS = ['nombre', 'dni', 'telefono', 'email', 'direccion', 'iban', 'fecha_nacimiento'];

function ia_validar_detecciones($detecciones) {
  global $TIPOS_PERMITIDOS;
  if (!is_array($detecciones)) return [];
  $vistos = [];
  $out = [];
  foreach ($detecciones as $d) {
    if (!is_array($d)) continue;
    $tipo = strtolower(trim((string) ($d['tipo'] ?? '')));
    $texto = trim((string) ($d['texto'] ?? ''));
    if ($texto === '' || !in_array($tipo, $TIPOS_PERMITIDOS, true)) continue;
    $clave = $tipo . '|' . mb_strtolower($texto);
    if (isset($vistos[$clave])) continue;
    $vistos[$clave] = true;
    $out[] = ['tipo' => $tipo, 'texto' => $texto];
    if (count($out) >= 200) break;
  }
  return $out;
}
