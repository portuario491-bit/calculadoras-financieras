(function () {
  "use strict";
  window.__BRAND__ = {
    name: "AnonimizaPDF",
    tagline: "Censura de datos personales en tus PDF. De verdad.",
    dominio: "anonimiza.utilix.uno",
    contacto: { email: "hola@anonimiza.utilix.uno" },

    tipos: [
      { id: "nombre", label: "Nombres y apellidos" },
      { id: "dni", label: "DNI / NIE" },
      { id: "telefono", label: "Teléfono" },
      { id: "email", label: "Email" },
      { id: "direccion", label: "Dirección" },
      { id: "iban", label: "Cuenta bancaria (IBAN)" },
      { id: "fecha_nacimiento", label: "Fecha de nacimiento" }
    ],

    planes: [
      {
        id: "gratis",
        nombre: "Gratis",
        precio: 0,
        creditos: 5,
        periodo: "para siempre",
        destacado: false,
        descripcion: "Para probar la herramienta sin compromiso.",
        incluye: [
          "5 créditos de regalo (5 páginas)",
          "Detección automática de los 7 tipos de dato",
          "Censura real, no un recuadro decorativo",
          "Caja manual para repasar a mano"
        ]
      },
      {
        id: "pro",
        nombre: "Pro",
        precio: 19,
        creditos: 200,
        periodo: "al mes",
        destacado: true,
        descripcion: "Para gestorías y despachos con uso habitual.",
        incluye: [
          "200 créditos al mes (200 páginas)",
          "Todo lo del plan Gratis",
          "Historial de documentos procesados",
          "Soporte por email en horario laboral"
        ]
      },
      {
        id: "empresa",
        nombre: "Empresa",
        precio: 59,
        creditos: 1000,
        periodo: "al mes",
        destacado: false,
        descripcion: "Para departamentos de RR. HH. y despachos grandes.",
        incluye: [
          "1.000 créditos al mes (1.000 páginas)",
          "Todo lo del plan Pro",
          "Prioridad de procesamiento",
          "Soporte prioritario"
        ]
      }
    ],

    pasos: [
      {
        titulo: "1. Sube el documento",
        texto: "Arrastra el contrato, la nómina o la factura. El archivo se procesa en tu navegador: nunca sale de tu ordenador sin cifrar."
      },
      {
        titulo: "2. Revisa las detecciones",
        texto: "La IA localiza nombres, DNI, teléfonos, emails, direcciones, cuentas bancarias y fechas de nacimiento. Tú decides qué se tapa con un clic."
      },
      {
        titulo: "3. Descarga el PDF censurado",
        texto: "El texto tapado se elimina de verdad del archivo. No es un recuadro que se pueda quitar ni un texto que se pueda seleccionar por debajo."
      }
    ],

    faqs: [
      {
        p: "¿La censura es reversible? ¿Alguien podría copiar el texto de debajo del recuadro negro?",
        r: "No. AnonimizaPDF no dibuja un rectángulo encima del texto: cada página censurada se reconstruye como una imagen con las zonas marcadas ya pintadas en negro antes de generarse el PDF final. El resultado no contiene texto seleccionable en ningún punto de la página, así que no hay nada que copiar, buscar ni recuperar por debajo. Es el mismo principio que tachar con rotulador y luego fotocopiar."
      },
      {
        p: "¿Eso tiene alguna contrapartida?",
        r: "Sí, y te lo decimos siempre antes de descargar: el PDF resultante deja de tener texto seleccionable o buscable en toda la página (no solo en lo censurado), y pesa algo más que el original porque cada página pasa a ser una imagen. Visualmente e impreso es idéntico al documento original. Es exactamente el comportamiento que debe tener un documento anonimizado de verdad."
      },
      {
        p: "¿Qué pasa si la IA marca algo que no debía, o se le escapa un dato?",
        r: "Puedes activar o desactivar cada detección individual antes de descargar, y también dibujar tú mismo una caja manual sobre cualquier zona que la IA no haya detectado (útil en escaneos de mala calidad o letra manuscrita). La responsabilidad final de revisar el documento es siempre tuya: te lo recordamos en la propia herramienta."
      },
      {
        p: "¿Subís nuestros documentos a algún servidor?",
        r: "El archivo PDF nunca sale de tu navegador. Lo que viaja a nuestro servidor es solo el texto de cada página (no la imagen ni el archivo), para que la inteligencia artificial identifique qué fragmentos son datos personales. El propio proceso de tapar y reconstruir el PDF final ocurre también en tu navegador."
      },
      {
        p: "¿Qué es un crédito?",
        r: "Un crédito equivale a una página procesada. Un contrato de 8 páginas consume 8 créditos, se detecten datos o no. Verás el coste antes de empezar."
      },
      {
        p: "¿Puedo probarlo sin pagar?",
        r: "Sí, el plan Gratis incluye 5 créditos de regalo al crear la cuenta, sin necesidad de tarjeta."
      },
      {
        p: "¿Los pagos son reales?",
        r: "Todavía no: esta es una demostración funcional y los pagos están simulados (verás el aviso de MODO DEMO en todo momento). Las cuentas, el inicio de sesión y el contador de créditos sí son reales."
      }
    ],

    sectores: [
      {
        nombre: "Gestorías",
        texto: "Anonimiza nóminas y documentación de clientes antes de compartirla o archivarla, sin repasar cada página a mano."
      },
      {
        nombre: "Despachos de abogados",
        texto: "Prepara contratos y expedientes para compartir con peritos, formación interna o publicación, protegiendo a las partes."
      },
      {
        nombre: "Recursos Humanos",
        texto: "Anonimiza CVs, nóminas e informes internos antes de compartirlos entre departamentos o con proveedores externos."
      }
    ]
  };
})();
