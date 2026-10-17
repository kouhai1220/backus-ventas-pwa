# Backus Ventas PWA

Proyecto académico desarrollado con Angular 21. Permite consultar un catálogo de demostración, buscar por nombre (con o sin tildes), filtrar por categoría y disponibilidad, y ordenar por nombre o precio.

## Ejecutar

Requisitos: Node.js y npm compatibles con Angular 21, y dependencias instaladas con `npm ci`.

- `npm start`: desarrollo en http://localhost:4200.
- `npm run build`: compilación de producción en `dist/backus-ventas-pwa/browser`.
- `npm test -- --watch=false`: pruebas automatizadas.

En PowerShell, si la política bloquea `npm.ps1`, utiliza `npm.cmd` en lugar de `npm`.

## Datos y caché

Los archivos en `public/data` simulan un servicio HTTP; no existe un backend ni se realizan ventas reales.

- `catalogo.json`: catálogo base, caché **performance** durante un día. Se prioriza la copia guardada.
- `precios.json`: precios y stock por `productoId`, caché **freshness** durante una hora. Se intenta la red y, después de tres segundos, se utiliza una copia válida si existe.
- El servicio combina ambos archivos. Si fallan los precios, conserva los valores base y muestra un aviso. Si falla el catálogo, muestra un error con reintento.
- El indicador de conexión refleja el estado que informa el navegador; no garantiza que un servidor responda.

El botón de actualización vuelve a consultar los archivos respetando estas políticas. Los datos guardados pueden estar desactualizados. El catálogo no se descarga por adelantado: hay que consultarlo al menos una vez antes de usarlo offline.

## Demostración de PWA para la entrega

1. Ejecutar `npm run build`.
2. Servir `dist/backus-ventas-pwa/browser` mediante un servidor estático en localhost, por ejemplo `npx http-server dist/backus-ventas-pwa/browser -p 8080 -c-1` (puede requerir descargar esa herramienta).
3. Abrir http://localhost:8080 con conexión, esperar a que aparezca el catálogo y a que se active el service worker. Revisarlo en DevTools → Application → Service Workers.
4. Recargar para que la página esté controlada por el service worker. Comprobar las cachés en Application → Cache Storage.
5. Activar Offline en DevTools → Network y recargar. Comprobar que la aplicación y los productos siguen visibles y que funciona la búsqueda.
6. Volver a conectar y pulsar Actualizar catálogo. Revisar también el manifiesto desde Application → Manifest; la instalación depende del navegador.

El service worker se habilita en producción. `npm start` usa el modo de desarrollo y no demuestra la caché offline. Fuera de localhost, la PWA requiere HTTPS.

## Alcance y validación

Las pruebas cubren combinación de precios y stock, búsqueda sin tildes, filtro de disponibilidad, recuperación cuando fallan los precios y reintento ante errores. La prueba manual anterior verifica instalación y funcionamiento offline en un navegador real.

Entrega educativa sin afiliación comercial a Backus. Incluye carrito y pedidos locales. No incluye autenticación, pagos ni sincronización con inventario real.

## Flujo de tienda académica

La navegación incluye Inicio, Catálogo, Carrito y Mis pedidos. Los productos se agregan desde el catálogo; el carrito permite modificar cantidades, retirar artículos y vaciarlo. Los precios se interpretan como importes con IGV incluido: el resumen desglosa la base y el impuesto sin añadirlo por segunda vez.

Al registrar un pedido se requieren cliente y dirección, se validan stock y precios contra el catálogo cargado y se guarda una copia de las líneas con su precio histórico. IndexedDB (`backus-ventas`, almacén `tienda`) guarda el pedido y vacía el carrito en una misma transacción. Si la escritura falla, se conserva el carrito. Los pedidos tienen detalle desplegable, filtros y cancelación local.

No hay backend, pagos ni envío de pedidos: el estado es **Guardado localmente**, incluso cuando hay conexión. El inventario es de demostración y no se reserva ni se descuenta globalmente. Las existencias consultadas offline pueden estar desactualizadas. Los datos pertenecen al navegador y se pierden si se elimina su almacenamiento.

Para demostrarlo: agrega dos productos, ajusta cantidades, registra un pedido y abre su detalle en Mis pedidos. Recarga para comprobar la persistencia. Repite sin conexión después de preparar la caché de producción. Puedes cancelar un pedido desde su detalle.

