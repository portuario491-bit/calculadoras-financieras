<?php
require __DIR__ . '/_comun.php';

$in = leer_json_entrada();
$email = strtolower(trim((string) ($in['email'] ?? '')));
$password = (string) ($in['password'] ?? '');

if ($email === '' || $password === '') error_humano('Escribe tu email y contraseña.');
if (!rate_limit_login($email)) error_humano('Demasiados intentos. Espera unos minutos y vuelve a intentarlo.', 429);

list($db, $resultado) = db_transaccion(function ($db) use ($email, $password) {
  if (!isset($db['usuarios'][$email]) || !password_verify($password, $db['usuarios'][$email]['hash'])) {
    return [$db, ['error' => 'Email o contraseña incorrectos.']];
  }
  $u = aplicar_renovacion_si_toca($db['usuarios'][$email]);
  $db['usuarios'][$email] = $u;
  $db = crear_sesion($db, $email);
  return [$db, ['ok' => true]];
});

if (!$resultado || !empty($resultado['error'])) {
  error_humano($resultado['error'] ?? 'No se ha podido iniciar sesión.', 401);
}

responder(['ok' => true, 'usuario' => usuario_publico($db['usuarios'][$email])]);
