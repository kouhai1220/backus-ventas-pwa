import { Injectable, computed, inject, signal } from '@angular/core';
import { EstadoTienda, LineaCarrito, TiendaStorage } from './tienda-storage';
import { Producto } from './catalogo.service';

export const importe = (lineas: LineaCarrito[]) => lineas.reduce((total, linea) =>
  total + Math.round(linea.producto.precio * 100) * linea.cantidad, 0);

@Injectable({ providedIn: 'root' })
export class TiendaService {
  private readonly storage = inject(TiendaStorage);
  private readonly estado = signal<EstadoTienda>({ carrito: [], pedidos: [] });
  readonly carrito = computed(() => this.estado().carrito);
  readonly pedidos = computed(() => this.estado().pedidos);
  readonly cantidad = computed(() => this.carrito().reduce((total, l) => total + l.cantidad, 0));
  readonly total = computed(() => importe(this.carrito()));
  readonly listo = signal(false);
  readonly ocupado = signal(false);
  readonly mensaje = signal('');

  constructor() { void this.iniciar(); }
  async iniciar(): Promise<void> {
    this.ocupado.set(true);
    try {
      this.estado.set(await this.storage.cargar());
      this.listo.set(true);
      this.mensaje.set('');
    } catch {
      this.mensaje.set('No se pudo abrir el almacenamiento del dispositivo. Habilítalo y recarga para usar el carrito.');
    } finally { this.ocupado.set(false); }
  }
  private async persistir(estado: EstadoTienda, mensaje: string): Promise<boolean> {
    if (!this.listo() || this.ocupado()) return false;
    this.ocupado.set(true);
    try {
      await this.storage.guardar(estado);
      this.estado.set(estado);
      this.mensaje.set(mensaje);
      return true;
    } catch {
      this.mensaje.set('No se pudo guardar el cambio. Tus datos anteriores se mantienen. Intenta de nuevo.');
      return false;
    } finally { this.ocupado.set(false); }
  }
  cantidadDe(id: number): number { return this.carrito().find(l => l.producto.id === id)?.cantidad ?? 0; }
  async cambiar(producto: Producto, cantidad: number): Promise<void> {
    if (!Number.isInteger(cantidad) || cantidad < 0 || cantidad > producto.stock) {
      this.mensaje.set('La cantidad supera el stock disponible.'); return;
    }
    const carrito = this.carrito().filter(l => l.producto.id !== producto.id);
    if (cantidad) carrito.push({ producto: { ...producto }, cantidad });
    await this.persistir({ ...this.estado(), carrito }, cantidad ? 'Carrito actualizado.' : 'Producto retirado.');
  }
  async vaciar(): Promise<void> {
    await this.persistir({ ...this.estado(), carrito: [] }, 'Carrito vacío.');
  }
  async registrar(productos: Producto[], cliente: string, direccion: string): Promise<boolean> {
    if (!cliente.trim() || !direccion.trim() || !this.carrito().length) {
      this.mensaje.set('Completa el cliente y la dirección de entrega.'); return false;
    }
    const lineas: LineaCarrito[] = [];
    for (const linea of this.carrito()) {
      const actual = productos.find(p => p.id === linea.producto.id);
      if (!actual || linea.cantidad > actual.stock) {
        this.mensaje.set('El stock cambió. Revisa las cantidades del carrito.'); return false;
      }
      if (Math.round(actual.precio * 100) !== Math.round(linea.producto.precio * 100)) {
        this.mensaje.set('Un precio cambió. Actualiza el producto en el carrito antes de confirmar.'); return false;
      }
      lineas.push({ producto: { ...actual }, cantidad: linea.cantidad });
    }
    const pedido = { id: crypto.randomUUID(), fecha: new Date().toISOString(), cliente: cliente.trim(),
      direccion: direccion.trim(), lineas, totalCentimos: importe(lineas), estado: 'Guardado localmente' as const };
    return this.persistir({ carrito: [], pedidos: [pedido, ...this.pedidos()] }, 'Pedido registrado en este dispositivo.');
  }
  async cancelar(id: string): Promise<void> {
    await this.persistir({ ...this.estado(), pedidos: this.pedidos().map(p => p.id === id ? { ...p, estado: 'Cancelado' } : p) }, 'Pedido cancelado localmente.');
  }
}
