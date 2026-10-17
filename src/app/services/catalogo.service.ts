import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, forkJoin, map, of, timeout } from 'rxjs';

// GUÍA — 3. CATÁLOGO Y CONSULTAS HTTP
// Los archivos de public/data simulan dos recursos de una API para la entrega.
export interface Producto {
  id: number;
  nombre: string;
  categoria: string;
  precio: number;
  stock: number;
}
export interface Precio {
  productoId: number;
  precio: number;
  stock: number;
  actualizado: string;
}
export interface CatalogoResultado {
  productos: Producto[];
  // Significa que la respuesta de precios contiene todos los productos.
  // No garantiza datos recién descargados: el service worker puede responder desde caché.
  preciosActualizados: boolean;
}

@Injectable({ providedIn: 'root' })
export class CatalogoService {
  private readonly http = inject(HttpClient);

  // HttpClient devuelve Observables. forkJoin consulta ambos archivos en paralelo
  // y espera a que terminen; timeout limita la espera de cada consulta.
  obtenerCatalogo(): Observable<CatalogoResultado> {
    return forkJoin({
      productos: this.http.get<Producto[]>('data/catalogo.json').pipe(timeout(8000)),
      precios: this.http.get<Precio[]>('data/precios.json').pipe(
        timeout(5000),
        // Si fallan los precios, of(null) permite seguir usando los valores base.
        // El catálogo sí es obligatorio: su error se propaga al componente.
        catchError(() => of(null)),
      ),
    }).pipe(
      map(({ productos, precios }) => ({
        // map transforma la respuesta: se relacionan id y productoId y se sustituyen precio y stock.
        productos: productos.map((producto) => {
          const precio = precios?.find((item) => item.productoId === producto.id);
          return precio ? { ...producto, precio: precio.precio, stock: precio.stock } : producto;
        }),
        preciosActualizados:
          precios !== null &&
          productos.every((producto) =>
            precios.some((precio) => precio.productoId === producto.id),
          ),
      })),
    );
  }
}
