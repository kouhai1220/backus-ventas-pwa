import { Injectable } from '@angular/core';
import { Producto } from './catalogo.service';

// GUÍA — 5. PERSISTENCIA LOCAL
// Las interfaces describen la forma de los datos para TypeScript; no validan JSON en ejecución.
export interface LineaCarrito {
  producto: Producto;
  cantidad: number;
}
export interface Pedido {
  id: string;
  fecha: string;
  cliente: string;
  direccion: string;
  lineas: LineaCarrito[];
  totalCentimos: number;
  estado: 'Guardado localmente' | 'Cancelado';
}
export interface EstadoTienda {
  carrito: LineaCarrito[];
  pedidos: Pedido[];
}

/**
 * IndexedDB es una base de datos asíncrona del navegador: conserva carrito y pedidos
 * entre recargas y funciona sin Internet. No es un servidor ni sincroniza dispositivos.
 * Diferencia clave: el service worker almacena archivos y respuestas HTTP en caché;
 * este servicio almacena los datos que genera el usuario.
 * Para mostrarlo: DevTools → Application → IndexedDB → backus-ventas → tienda.
 */
@Injectable({ providedIn: 'root' })
export class TiendaStorage {
  private conexion?: Promise<IDBDatabase>;
  // Reutiliza la promesa de conexión. El número 1 es la versión del esquema de la base.
  // onupgradeneeded crea el almacén al abrir por primera vez esta versión.
  private abrir(): Promise<IDBDatabase> {
    return (this.conexion ??= new Promise((resolve, reject) => {
      const solicitud = indexedDB.open('backus-ventas', 1);
      solicitud.onupgradeneeded = () => solicitud.result.createObjectStore('tienda');
      solicitud.onsuccess = () => resolve(solicitud.result);
      solicitud.onerror = () => reject(solicitud.error);
      solicitud.onblocked = () => reject(new Error('Base de datos bloqueada'));
    }));
  }
  // Lectura de la clave "estado"; si aún no hay datos, devuelve un carrito e historial vacíos.
  async cargar(): Promise<EstadoTienda> {
    const db = await this.abrir();
    return new Promise((resolve, reject) => {
      const solicitud = db.transaction('tienda').objectStore('tienda').get('estado');
      solicitud.onsuccess = () => resolve(solicitud.result ?? { carrito: [], pedidos: [] });
      solicitud.onerror = () => reject(solicitud.error);
    });
  }
  // readwrite permite escribir; put crea o reemplaza el registro con la clave "estado".
  // oncomplete confirma la transacción completa, no solo la solicitud de escritura.
  // Un aborto rechaza la promesa y evita confirmar el cambio en TiendaService.
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
