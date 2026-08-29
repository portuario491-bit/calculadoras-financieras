<?php
// checkout.php — MOCKUP: marca el plan como pagado y recarga créditos.
// En producción esto redirigiría al checkout real de la pasarela de pago
// (18-go-live-playbooks.md); el resto del sistema no cambia.
require __DIR__ . '/_comun.php';

global $PLANES;
$in = leer_json_entrada();
$planId = (string) ($in['plan'] ?? '');
if (!isset($PLANES[$planId]) || $planId === 'gratis') error_humano('Plan no válido.');

list($db, $resultado) = db_transaccion(function ($db) use ($planId) {
  global $PLANES;
  $email = usuario_de_sesion($db);
  if ($email === null) return [$db, null];
  $u = $db['usuarios'][$email];
  $u['plan'] = $planId;
  $u['creditos'] = $PLANES[$planId]['creditos'];
  $u['renovacion'] = date('c', strtotime('+30 days'));
  $u['historial'][] = ['fecha' => date('c'), 'accion' => 'upgrade', 'plan' => $planId];
  $db['usuarios'][$email] = $u;
  return [$db, $email];
});

if ($resultado === null) error_humano('No has iniciado sesión.', 401);

responder(['ok' => true, 'usuario' => usuario_publico($db['usuarios'][$resultado])]);
