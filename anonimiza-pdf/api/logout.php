<?php
require __DIR__ . '/_comun.php';

$token = $_COOKIE['sesion'] ?? '';
if ($token !== '') {
  db_transaccion(function ($db) use ($token) {
    unset($db['sesiones'][$token]);
    return [$db, true];
  });
}
borrar_cookie_sesion();
responder(['ok' => true]);
