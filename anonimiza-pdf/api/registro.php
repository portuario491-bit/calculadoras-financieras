<?php
require __DIR__ . '/_comun.php';

$in = leer_json_entrada();
$email = strtolower(trim((string) ($in['email'] ?? '')));
$password = (string) ($in['password'] ?? '');

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) error_humano('Escribe un email válido.');
if (strlen($password) < 8) error_humano('La contraseña debe tener al menos 8 caracteres.');

global $PLANES;
list($db, $resultado) = db_transaccion(function ($db) use ($email, $password) {
  global $PLANES;
  if (isset($db['usuarios'][$email])) {
    return [$db, ['error' => 'Ya existe una cuenta con ese email. Inicia sesión.']];
  }
  $db['usuarios'][$email] = [
    'email' => $email,
    'hash' => password_hash($password, PASSWORD_BCRYPT),
    'plan' => 'gratis',
    'creditos' => $PLANES['gratis']['creditos'],
    'renovacion' => null,
    'creado' => date('c'),
    'historial' => [['fecha' => date('c'), 'accion' => 'registro']],
  ];
  $db = crear_sesion($db, $email);
  return [$db, ['ok' => true, 'email' => $email]];
});

if (!$resultado || !empty($resultado['error'])) {
  error_humano($resultado['error'] ?? 'No se ha podido crear la cuenta. Inténtalo de nuevo.', 409);
}

responder(['ok' => true, 'usuario' => usuario_publico($db['usuarios'][$email])]);
