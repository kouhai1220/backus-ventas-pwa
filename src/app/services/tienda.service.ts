import { Injectable, computed, inject, signal } from '@angular/core';
import { EstadoTienda, LineaCarrito, TiendaStorage } from './tienda-storage';
import { Producto } from './catalogo.service';

// GUÍA — 4. REGLAS DE LA TIENDA
// Se redondea cada precio a céntimos antes de multiplicarlo por la cantidad.
// Esto evita acumular errores de decimales binarios al sumar dinero.
export const importe = (lineas: LineaCarrito[]) =>
  lineas.reduce(
    (total, linea) => total + Math.round(linea.producto.precio * 100) * linea.cantidad,
    0,
  );

// providedIn: 'root' permite compartir una instancia del servicio en la aplicación.
// App presenta los datos; este servicio gestiona cantidades, validaciones y pedidos.
@Injectable({ providedIn: 'root' })
export class TiendaService {
  private readonly storage = inject(TiendaStorage);
  // Un estado común mantiene carrito e historial juntos para guardarlos en una transacción.
  private readonly estado = signal<EstadoTienda>({ carrito: [], pedidos: [] });
  readonly carrito = computed(() => this.estado().carrito);
  readonly pedidos = computed(() => this.estado().pedidos);
  readonly cantidad = computed(() => this.carrito().reduce((total, l) => total + l.cantidad, 0));
  readonly total = computed(() => importe(this.carrito()));
  // listo evita operar antes de recuperar IndexedDB; ocupado bloquea escrituras simultáneas
  // desde esta instancia. No representa un bloqueo entre varias pestañas del navegador.
  readonly listo = signal(false);
  readonly ocupado = signal(false);
  readonly mensaje = signal('');

  constructor() {
    void this.iniciar();
  }
  // Recupera el estado tras recargar la página. try/catch/finally controla fallos
  // y libera siempre el indicador de trabajo, incluso si el navegador bloquea IndexedDB.
  async iniciar(): Promise<void> {
    this.ocupado.set(true);
    try {
      this.estado.set(await this.storage.cargar());
      this.listo.set(true);
      this.mensaje.set('');
    } catch {
      this.mensaje.set(
        'No se pudo abrir el almacenamiento del dispositivo. Habilítalo y recarga para usar el carrito.',
      );
    } finally {
      this.ocupado.set(false);
    }
  }
  // Primero se escribe en disco y después se actualiza la pantalla.
  // Si falla el guardado, se mantiene el estado anterior y se informa al usuario.
  private async persistir(estado: EstadoTienda, mensaje: string): Promise<boolean> {
    if (!this.listo() || this.ocupado()) return false;
    this.ocupado.set(true);
    try {
      await this.storage.guardar(estado);
      this.estado.set(estado);
      this.mensaje.set(mensaje);
      return true;
    } catch {
      this.mensaje.set(
        'No se pudo guardar el cambio. Tus datos anteriores se mantienen. Intenta de nuevo.',
      );
      return false;
    } finally {
      this.ocupado.set(false);
    }
  }
  cantidadDe(id: number): number {
    return this.carrito().find((l) => l.producto.id === id)?.cantidad ?? 0;
  }
  // cantidad es el TOTAL deseado de ese producto, no las unidades adicionales.
  // Se admiten enteros entre cero y stock; cero elimina la línea.
  // La copia con ...producto evita compartir el objeto mutable del catálogo.
  async cambiar(producto: Producto, cantidad: number): Promise<void> {
    if (!Number.isInteger(cantidad) || cantidad < 0 || cantidad > producto.stock) {
      this.mensaje.set('La cantidad supera el stock disponible.');
      return;
    }
    const carrito = this.carrito().filter((l) => l.producto.id !== producto.id);
    if (cantidad) carrito.push({ producto: { ...producto }, cantidad });
    await this.persistir(
      { ...this.estado(), carrito },
      cantidad ? 'Carrito actualizado.' : 'Producto retirado.',
    );
  }
  async vaciar(): Promise<void> {
    await this.persistir({ ...this.estado(), carrito: [] }, 'Carrito vacío.');
  }
  /**
   * REGISTRO: formulario → validación → copia de líneas → guardado.
   * Compara con el catálogo cargado, que puede venir de caché; no es inventario en vivo.
   * Los precios ya incluyen IGV: el formulario lo desglosa sin sumarlo otra vez.
   * Es una simulación académica: no cobra, no envía al servidor ni reserva stock.
   */
  async registrar(productos: Producto[], cliente: string, direccion: string): Promise<boolean> {
    if (!cliente.trim() || !direccion.trim() || !this.carrito().length) {
      this.mensaje.set('Completa el cliente y la dirección de entrega.');
      return false;
    }
    const lineas: LineaCarrito[] = [];
    for (const linea of this.carrito()) {
      const actual = productos.find((p) => p.id === linea.producto.id);
      if (!actual || linea.cantidad > actual.stock) {
        this.mensaje.set('El stock cambió. Revisa las cantidades del carrito.');
        return false;
      }
      if (Math.round(actual.precio * 100) !== Math.round(linea.producto.precio * 100)) {
        this.mensaje.set(
          'Un precio cambió. Actualiza el producto en el carrito antes de confirmar.',
        );
        return false;
      }
      lineas.push({ producto: { ...actual }, cantidad: linea.cantidad });
    }
    // UUID identifica el pedido; ISO conserva la fecha; las copias mantienen el precio histórico.
    const pedido = {
      id: crypto.randomUUID(),
      fecha: new Date().toISOString(),
      cliente: cliente.trim(),
      direccion: direccion.trim(),
      lineas,
      totalCentimos: importe(lineas),
      estado: 'Guardado localmente' as const,
    };
    // Pedido nuevo y carrito vacío se guardan juntos: no hay un paso intermedio separado.
    return this.persistir(
      { carrito: [], pedidos: [pedido, ...this.pedidos()] },
      'Pedido registrado en este dispositivo.',
    );
  }
  // Cambia el estado local sin borrar el historial ni contactar con una tienda real.
  async cancelar(id: string): Promise<void> {
    await this.persistir(
      {
        ...this.estado(),
        pedidos: this.pedidos().map((p) => (p.id === id ? { ...p, estado: 'Cancelado' } : p)),
      },
      'Pedido cancelado localmente.',
    );
  }
}
