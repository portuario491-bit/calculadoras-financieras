<?php
// interes-lista.php — panel privado para que el DUEÑO vea quién ha mostrado
// interés real en un plan de pago. Protegido con una clave secreta que se
// genera sola la primera vez y se guarda fuera de la carpeta pública (igual
// que las claves de la IA). No es un endpoint de la app: solo se accede
// pegando la URL con la clave en el navegador.
require __DIR__ . '/_comun.php';

function ruta_secreto_interes() {
  return dirname(dirname(dirname(__DIR__))) . '/interes_secret.php';
}

$archivoSecreto = ruta_secreto_interes();

// ?nueva=1 fuerza a generar una clave nueva y la muestra UNA vez en la
// respuesta (el fichero vive fuera de la carpeta pública: no hay otra forma
// de recuperarla si se pierde). Úsalo, copia la clave y no la compartas.
if (($_GET['nueva'] ?? '') === '1') {
  $nueva = bin2hex(random_bytes(24));
  @mkdir(dirname($archivoSecreto), 0750, true);
  @file_put_contents($archivoSecreto, "<?php return '" . $nueva . "';\n");
  header('Content-Type: text/plain; charset=utf-8');
  echo "Nueva clave generada. Guárdala, no se puede volver a mostrar:\n\n" . $nueva . "\n\nURL completa: https://anonimiza.utilix.uno/api/interes-lista.php?clave=" . $nueva . "\n";
  exit;
}

if (!is_file($archivoSecreto)) {
  $nuevo = bin2hex(random_bytes(24));
  @mkdir(dirname($archivoSecreto), 0750, true);
  @file_put_contents($archivoSecreto, "<?php return '" . $nuevo . "';\n");
}
$secreto = is_file($archivoSecreto) ? trim((string) (@include $archivoSecreto)) : '';
$dada = (string) ($_GET['clave'] ?? '');

header('Content-Type: text/html; charset=utf-8');

if ($secreto === '' || !hash_equals($secreto, $dada)) {
  http_response_code(403);
  echo '<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;padding:40px;color:#555">Acceso denegado. Falta o es incorrecta la clave (?clave=...).</body>';
  exit;
}

$db = db_leer();
$lista = array_reverse($db['interes'] ?? []);
$totales = [];
foreach ($lista as $i) { $p = $i['plan'] ?? '?'; $totales[$p] = ($totales[$p] ?? 0) + 1; }

?><!doctype html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>Interés en planes — AnonimizaPDF</title>
<style>
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:760px;margin:40px auto;padding:0 20px;color:#1a1f2b}
  h1{font-size:22px;margin-bottom:4px}
  .resumen{display:flex;gap:14px;margin:18px 0 26px;flex-wrap:wrap}
  .pill{background:#eef1fb;color:#2148d1;padding:8px 16px;border-radius:999px;font-weight:600;font-size:14px}
  table{width:100%;border-collapse:collapse;font-size:14px}
  th,td{text-align:left;padding:9px 8px;border-bottom:1px solid #e6e8ee}
  th{color:#888;font-weight:600;text-transform:uppercase;font-size:11px;letter-spacing:.03em}
  .vacio{color:#888;padding:30px 0}
</style></head><body>
<h1>Interés real en planes de pago</h1>
<p style="color:#888;font-size:14px">Cada fila es un clic en "Elegir plan" dentro de la app — nadie ha pagado nada.</p>
<div class="resumen">
  <span class="pill">Total: <?= count($lista) ?></span>
  <?php foreach ($totales as $p => $n): ?><span class="pill"><?= htmlspecialchars($p) ?>: <?= $n ?></span><?php endforeach; ?>
</div>
<?php if (!$lista): ?>
  <p class="vacio">Todavía no hay nadie apuntado.</p>
<?php else: ?>
<table>
  <thead><tr><th>Fecha</th><th>Email</th><th>Plan</th></tr></thead>
  <tbody>
    <?php foreach ($lista as $i): ?>
    <tr>
      <td><?= htmlspecialchars($i['fecha'] ?? '') ?></td>
      <td><?= htmlspecialchars($i['email'] ?? '') ?></td>
      <td><?= htmlspecialchars($i['plan'] ?? '') ?></td>
    </tr>
    <?php endforeach; ?>
  </tbody>
</table>
<?php endif; ?>
</body></html>
