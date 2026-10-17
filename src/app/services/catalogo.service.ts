import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, forkJoin, map, of, timeout } from 'rxjs';

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
  preciosActualizados: boolean;
}

@Injectable({ providedIn: 'root' })
export class CatalogoService {
  private readonly http = inject(HttpClient);

  obtenerCatalogo(): Observable<CatalogoResultado> {
    return forkJoin({
      productos: this.http.get<Producto[]>('data/catalogo.json').pipe(timeout(8000)),
      precios: this.http.get<Precio[]>('data/precios.json').pipe(
        timeout(5000),
        catchError(() => of(null)),
      ),
    }).pipe(map(({ productos, precios }) => ({
      productos: productos.map(producto => {
        const precio = precios?.find(item => item.productoId === producto.id);
        return precio ? { ...producto, precio: precio.precio, stock: precio.stock } : producto;
      }),
      preciosActualizados: precios !== null && productos.every(producto =>
        precios.some(precio => precio.productoId === producto.id)),
    })));
  }
}
