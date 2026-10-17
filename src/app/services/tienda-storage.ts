import { Injectable } from '@angular/core';
import { Producto } from './catalogo.service';

export interface LineaCarrito { producto: Producto; cantidad: number; }
export interface Pedido {
  id: string;
  fecha: string;
  cliente: string;
  direccion: string;
  lineas: LineaCarrito[];
  totalCentimos: number;
  estado: 'Guardado localmente' | 'Cancelado';
}
export interface EstadoTienda { carrito: LineaCarrito[]; pedidos: Pedido[]; }

@Injectable({ providedIn: 'root' })
export class TiendaStorage {
  private conexion?: Promise<IDBDatabase>;
  private abrir(): Promise<IDBDatabase> {
    return this.conexion ??= new Promise((resolve, reject) => {
      const solicitud = indexedDB.open('backus-ventas', 1);
      solicitud.onupgradeneeded = () => solicitud.result.createObjectStore('tienda');
      solicitud.onsuccess = () => resolve(solicitud.result);
      solicitud.onerror = () => reject(solicitud.error);
      solicitud.onblocked = () => reject(new Error('Base de datos bloqueada'));
    });
  }
  async cargar(): Promise<EstadoTienda> {
    const db = await this.abrir();
    return new Promise((resolve, reject) => {
      const solicitud = db.transaction('tienda').objectStore('tienda').get('estado');
      solicitud.onsuccess = () => resolve(solicitud.result ?? { carrito: [], pedidos: [] });
      solicitud.onerror = () => reject(solicitud.error);
    });
  }
  async guardar(estado: EstadoTienda): Promise<void> {
    const db = await this.abrir();
    return new Promise((resolve, reject) => {
      const transaccion = db.transaction('tienda', 'readwrite');
      transaccion.objectStore('tienda').put(estado, 'estado');
      transaccion.oncomplete = () => resolve();
      transaccion.onabort = () => reject(transaccion.error);
      transaccion.onerror = () => reject(transaccion.error);
    });
  }
}
