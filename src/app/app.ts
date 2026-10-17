import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CatalogoService, Producto } from './services/catalogo.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('backus-ventas-pwa');

  private catalogoService = inject(CatalogoService);

  productos = signal<Producto[]>([]);

  // Estado real de la conexión
  online = signal(navigator.onLine);

  constructor() {
    // Cargar catálogo
    this.catalogoService.obtenerCatalogo().subscribe({
      next: (datos) => {
        this.productos.set(datos);
      },
      error: (error) => {
        console.error('Error al cargar el catálogo:', error);
      }
    });

    // Detectar cuando vuelve Internet
    window.addEventListener('online', () => {
      this.online.set(true);
    });

    // Detectar cuando se pierde Internet
    window.addEventListener('offline', () => {
      this.online.set(false);
    });
  }
}