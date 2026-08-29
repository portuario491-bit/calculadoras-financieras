<?php
// usar.php — el endpoint que de verdad cuesta dinero. Orden estricto:
// 1) hay sesión  2) coste (SIEMPRE calculado aquí, nunca confiar en el navegador)
// 3) hay créditos suficientes  4) RESERVAR créditos  5) llamar a la IA
// 6a) éxito -> registrar en el historial   6b) fallo -> DEVOLVER los créditos.
require __DIR__ . '/_comun.php';
require __DIR__ . '/gemini.php';

$db = db_leer();
$email = requerir_sesion($db);

$in = leer_json_entrada();
$texto = trim((string) ($in['texto'] ?? ''));
$pagina = (int) ($in['pagina'] ?? 0);

// Una página sin texto (extracción vacía) no cuesta nada: ni se reserva ni se llama a la IA.
if (mb_strlen($texto) < 3) {
  responder(['ok' => true, 'detecciones' => [], 'gratis' => true]);
}

if (mb_strlen($texto) > 20000) {
  $texto = mb_substr($texto, 0, 20000);
}

$motivoLimite = ia_limites('anonimiza');
if ($motivoLimite !== '') {
  error_humano('Estamos recibiendo muchas peticiones ahora mismo. Espera unos segundos y vuelve a intentarlo.', 429);
}

$coste = 1; // 1 crédito = 1 página, siempre, se detecten datos o no.

// ---------- Reservar créditos ANTES de llamar a la IA ----------
list($db2, $reserva) = db_transaccion(function ($db) use ($email, $coste) {
  if (!isset($db['usuarios'][$email])) return [$db, ['ok' => false, 'motivo' => 'sin_usuario']];
  $u = aplicar_renovacion_si_toca($db['usuarios'][$email]);
  if ($u['creditos'] < $coste) { $db['usuarios'][$email] = $u; return [$db, ['ok' => false, 'motivo' => 'sin_creditos', 'creditos' => $u['creditos']]]; }
  $u['creditos'] -= $coste;
  $db['usuarios'][$email] = $u;
  return [$db, ['ok' => true, 'creditos' => $u['creditos']]];
});

if (!$reserva || !$reserva['ok']) {
  if ($reserva && $reserva['motivo'] === 'sin_creditos') {
    error_humano('No te quedan créditos suficientes. Mejora tu plan para seguir procesando documentos.', 402, ['creditos' => $reserva['creditos'], 'necesita_mejora' => true]);
  }
  error_humano('No se ha podido comprobar tu cuenta. Vuelve a iniciar sesión.', 401);
}

// ---------- Llamar a la IA (Claude -> Gemini) ----------
$detecciones = [];
$exito = false;
$motivoFallo = 'sin_clave';

if (ia_hay_clave()) {
  $system = ia_system_censura();
  $prompt = ia_prompt_censura($texto);
  $resp = ia_texto($system, $prompt, 2200);
  $motivoFallo = $resp['motivo'] ?? 'desconocido';
  if ($resp['ok']) {
    $data = ia_json($resp['texto']);
    if (is_array($data) && isset($data['detecciones'])) {
      $detecciones = ia_validar_detecciones($data['detecciones']);
      $exito = true;
    } else {
      $motivoFallo = 'json_invalido';
    }
  }
}

if (!$exito) {
  // Devolver el crédito reservado: el fallo es nuestro, no del usuario.
  db_transaccion(function ($db) use ($email, $coste) {
    if (isset($db['usuarios'][$email])) {
      $db['usuarios'][$email]['creditos'] += $coste;
    }
    return [$db, true];
  });
  @error_log('[usar.php] fallo IA: ' . $motivoFallo);
  $msg = $motivoFallo === 'sin_clave'
    ? 'El servicio de IA todavía no está activado en este servidor (falta configurar la clave en /setup.php). Se te ha devuelto el crédito.'
    : 'Ahora mismo no hemos podido analizar esta página. Se te ha devuelto el crédito; inténtalo de nuevo en un momento.';
  error_humano($msg, 502);
}

// ---------- Éxito: registrar en el historial ----------
db_transaccion(function ($db) use ($email, $pagina, $coste) {
  if (isset($db['usuarios'][$email])) {
    $db['usuarios'][$email]['historial'][] = ['fecha' => date('c'), 'accion' => 'censurar-pdf', 'pagina' => $pagina, 'coste' => $coste];
  }
  return [$db, true];
});

responder(['ok' => true, 'detecciones' => $detecciones]);
