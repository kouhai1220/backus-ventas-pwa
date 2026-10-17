import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// GUÍA — PUNTO DE ENTRADA: Angular crea App y lo muestra en <app-root> de index.html.
// bootstrapApplication inicia una aplicación standalone con los servicios de appConfig.
// Si el arranque falla, catch registra el error en la consola del navegador.
bootstrapApplication(App, appConfig).catch((err) => console.error(err));
