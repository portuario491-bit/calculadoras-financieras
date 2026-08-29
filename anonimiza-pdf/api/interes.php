<?php
// interes.php — apunta el interés real de un usuario en un plan de pago,
// SIN cobrar ni activar nada. Mientras el dueño valida si hay demanda real
// antes de darse de alta como autónomo, esto sustituye al checkout simulado
// (api/checkout.php, que se deja intacto por si se quiere volver a activar
// el modo demo con pago falso más adelante).
require __DIR__ . '/_comun.php';

global $PLANES;
$in = leer_json_entrada();
$planId = (string) ($in['plan'] ?? '');
if (!isset($PLANES[$planId]) || $planId === 'gratis') error_humano('Plan no válido.');

list($db, $resultado) = db_transaccion(function ($db) use ($planId) {
  $email = usuario_de_sesion($db);
  if ($email === null) return [$db, null];
  if (!isset($db['interes']) || !is_array($db['interes'])) $db['interes'] = [];
  $db['interes'][] = ['fecha' => date('c'), 'email' => $email, 'plan' => $planId];
  $db['usuarios'][$email]['historial'][] = ['fecha' => date('c'), 'accion' => 'interes', 'plan' => $planId];
  return [$db, $email];
});

if ($resultado === null) error_humano('No has iniciado sesión.', 401);

responder(['ok' => true]);
