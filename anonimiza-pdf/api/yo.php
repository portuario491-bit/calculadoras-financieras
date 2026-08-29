<?php
require __DIR__ . '/_comun.php';

list($db, $resultado) = db_transaccion(function ($db) {
  $email = usuario_de_sesion($db);
  if ($email === null) return [$db, null];
  $db['usuarios'][$email] = aplicar_renovacion_si_toca($db['usuarios'][$email]);
  return [$db, $email];
});

if ($resultado === null) error_humano('No has iniciado sesión.', 401);

responder(['ok' => true, 'usuario' => usuario_publico($db['usuarios'][$resultado])]);
