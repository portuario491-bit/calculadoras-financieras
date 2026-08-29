<?php
// cancelar.php — MOCKUP: vuelve al plan Gratis. En producción abriría el
// portal de cliente de la pasarela de pago real.
require __DIR__ . '/_comun.php';

global $PLANES;
list($db, $resultado) = db_transaccion(function ($db) {
  global $PLANES;
  $email = usuario_de_sesion($db);
  if ($email === null) return [$db, null];
  $u = $db['usuarios'][$email];
  $u['plan'] = 'gratis';
  $u['creditos'] = $PLANES['gratis']['creditos'];
  $u['renovacion'] = null;
  $u['historial'][] = ['fecha' => date('c'), 'accion' => 'cancelacion'];
  $db['usuarios'][$email] = $u;
  return [$db, $email];
});

if ($resultado === null) error_humano('No has iniciado sesión.', 401);

responder(['ok' => true, 'usuario' => usuario_publico($db['usuarios'][$resultado])]);
