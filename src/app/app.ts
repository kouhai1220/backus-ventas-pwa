import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CatalogoService, Producto } from './services/catalogo.service';
import { DatePipe } from '@angular/common';
import { TiendaService } from './services/tienda.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule, DatePipe],
  templateUrl: './app.html',
  styleUrls: ['./app.scss', './tienda.scss', './responsive.scss'],
})
export class App {
  readonly Math = Math;
  readonly tienda = inject(TiendaService);
  readonly vista = signal<'inicio' | 'catalogo' | 'carrito' | 'pedidos'>('inicio');
  readonly filtroPedidos = signal<'todos' | 'activos' | 'cancelados'>('todos');
  readonly cliente = signal('');
  readonly direccion = signal('');
  readonly pedidosVisibles = computed(() =>
    this.tienda
      .pedidos()
      .filter(
        (p) =>
          this.filtroPedidos() === 'todos' ||
          (this.filtroPedidos() === 'activos'
            ? p.estado !== 'Cancelado'
            : p.estado === 'Cancelado'),
      ),
  );
  dinero(centimos: number): string {
    return 'S/ ' + (centimos / 100).toFixed(2);
  }
  productoActual(producto: Producto): Producto {
    return this.productos().find((p) => p.id === producto.id) ?? producto;
  }
  async registrarPedido(): Promise<void> {
    if (this.cargando() || this.error() || !this.productos().length) return;
    if (await this.tienda.registrar(this.productos(), this.cliente(), this.direccion())) {
      this.cliente.set('');
      this.direccion.set('');
      this.vista.set('pedidos');
    }
  }
  private readonly catalogoService = inject(CatalogoService);
  private readonly destroyRef = inject(DestroyRef);
  readonly productos = signal<Producto[]>([]);
  readonly online = signal(navigator.onLine);
  readonly cargando = signal(false);
  readonly error = signal('');
  readonly aviso = signal('');
  readonly busqueda = signal('');
  readonly categoria = signal('');
  readonly soloDisponibles = signal(false);
  readonly orden = signal('nombre');
  readonly favoritos = signal<number[]>([]);
  readonly soloFavoritos = signal(false);
  readonly unidades = computed(() => this.productos().reduce((total, p) => total + p.stock, 0));
  readonly disponibles = computed(() => this.productos().filter((p) => p.stock > 0).length);
  alternarFavorito(id: number): void {
    this.favoritos.update((ids) =>
      ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id],
    );
  }
  readonly categorias = computed(() =>
    [...new Set(this.productos().map((p) => p.categoria))].sort(),
  );
  readonly filtrados = computed(() => {
    const normalizar = (texto: string) =>
      texto
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    const texto = normalizar(this.busqueda().trim());
    return this.productos()
      .filter(
        (p) =>
          normalizar(p.nombre).includes(texto) &&
          (!this.categoria() || p.categoria === this.categoria()) &&
          (!this.soloDisponibles() || p.stock > 0) &&
          (!this.soloFavoritos() || this.favoritos().includes(p.id)),
      )
      .sort((a, b) =>
        this.orden() === 'precio' ? a.precio - b.precio : a.nombre.localeCompare(b.nombre, 'es'),
      );
  });

  constructor() {
    const conectar = () => {
      this.online.set(true);
      this.cargarCatalogo();
    };
    const desconectar = () => this.online.set(false);
    window.addEventListener('online', conectar);
    window.addEventListener('offline', desconectar);
    this.destroyRef.onDestroy(() => {
      window.removeEventListener('online', conectar);
      window.removeEventListener('offline', desconectar);
    });
    this.cargarCatalogo();
  }

  cargarCatalogo(): void {
    if (this.cargando()) return;
    this.cargando.set(true);
    this.error.set('');
    this.aviso.set('');
    this.catalogoService
      .obtenerCatalogo()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultado) => {
          this.productos.set(resultado.productos);
          if (!resultado.preciosActualizados) {
            this.aviso.set(
              'No se pudieron obtener todos los precios y stock. Se muestran los datos del catálogo guardado.',
            );
          }
          this.cargando.set(false);
        },
        error: () => {
          this.error.set(
            'No se pudo cargar el catálogo. Revisa tu conexión y vuelve a intentarlo.',
          );
          this.cargando.set(false);
        },
      });
  }

  limpiarFiltros(): void {
    this.busqueda.set('');
    this.categoria.set('');
    this.soloDisponibles.set(false);
    this.orden.set('nombre');
    this.soloFavoritos.set(false);
  }
}
