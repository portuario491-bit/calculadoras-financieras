<?php
// webhook.php — MOCKUP: no hace nada todavía. En producción, la pasarela de
// pago real llamará aquí para confirmar altas, renovaciones y bajas; ese es
// el único fichero que cambiará al pasar a pagos reales (18-go-live-playbooks.md).
require __DIR__ . '/_comun.php';
responder(['ok' => true, 'modo' => 'demo']);
