import { ApplicationConfig, isDevMode } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';
import { routes } from './app.routes';

/**
 * GUÍA — 1. CONFIGURACIÓN GENERAL
 * Los providers habilitan servicios disponibles mediante inject en toda la aplicación.
 * Flujo de arranque: main.ts inicia App utilizando esta configuración.
 *
 * PWA: ngsw-config.json define QUÉ se guarda en caché y con qué estrategia.
 * El manifiesto en public/manifest.webmanifest define nombre, iconos y modo instalado.
 * No añadimos comentarios a esos JSON porque su formato no los permite.
 *
 * assetGroups:
 * - app / prefetch: descarga la interfaz durante la instalación del service worker.
 * - assets / lazy: guarda imágenes y fuentes cuando se solicitan; prefetch en actualización.
 * dataGroups (runtime caching: se guarda al consultar):
 * - catálogo / performance: prioriza caché válida, hasta un día.
 * - precios / freshness: intenta red; tras 3 s usa caché válida, hasta una hora.
 * maxSize limita entradas y maxAge su vigencia; no son un respaldo permanente.
 *
 * Exposición: compilar con npm run build y servir la carpeta browser en localhost.
 * Abrir con Internet, consultar productos, esperar activación del worker y recargar.
 * Luego activar Offline en DevTools y recargar: comprobar interfaz y catálogo guardados.
 * Fuera de localhost se requiere HTTPS. npm start no activa este worker en desarrollo.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    // Preparado para rutas. Actualmente routes está vacío: App navega con la señal vista.
    provideRouter(routes),
    // Habilita HttpClient para consultar los archivos del catálogo y los precios.
    provideHttpClient(),
    // Se registra en producción. La caché offline necesita una primera visita con conexión.
    provideServiceWorker('ngsw-worker.js', { enabled: !isDevMode() }),
  ],
};
