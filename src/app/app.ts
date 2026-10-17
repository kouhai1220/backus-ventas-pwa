import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CatalogoService, Producto } from './services/catalogo.service';
import { DatePipe } from '@angular/common';
import { TiendaService } from './services/tienda.service';

/**
 * GUÍA PARA EXPONER — 2. COMPONENTE PRINCIPAL
 * Un componente une lógica (este archivo), vista (app.html) y estilos (SCSS).
 * Es standalone: declara directamente FormsModule para ngModel y DatePipe para fechas.
 * Recorrido: main.ts → app.config.ts → App → servicios → plantilla.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule, DatePipe],
  templateUrl: './app.html',
  styleUrls: ['./app.scss', './tienda.scss', './responsive.scss'],
})
export class App {
  // La plantilla solo accede a miembros del componente: exponemos Math para el desglose del IGV.
  readonly Math = Math;
  readonly tienda = inject(TiendaService);
  // signal guarda un valor reactivo: se lee con vista() y se modifica con vista.set(...).
  // La navegación cambia este estado; no usa rutas ni cambia la URL del navegador.
  readonly vista = signal<'inicio' | 'catalogo' | 'carrito' | 'pedidos'>('inicio');
  readonly filtroPedidos = signal<'todos' | 'activos' | 'cancelados'>('todos');
  readonly cliente = signal('');
  readonly direccion = signal('');
  // computed deriva un resultado de otras señales y lo recalcula cuando cambian.
  // Filtra el historial sin borrar los pedidos que no coinciden con la pestaña elegida.
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
  // Los totales se calculan en céntimos; aquí se convierten a soles solo para mostrarlos.
  dinero(centimos: number): string {
    return 'S/ ' + (centimos / 100).toFixed(2);
  }
  // Compara el artículo guardado con el catálogo cargado. Si no existe, muestra su copia.
  // La validación definitiva de existencia y stock se realiza al registrar en TiendaService.
  productoActual(producto: Producto): Producto {
    return this.productos().find((p) => p.id === producto.id) ?? producto;
  }
  // El componente coordina el formulario; el servicio valida y guarda el pedido.
  // await espera el guardado: solo al terminar con éxito se limpia el formulario.
  async registrarPedido(): Promise<void> {
    if (this.cargando() || this.error() || !this.productos().length) return;
    if (await this.tienda.registrar(this.productos(), this.cliente(), this.direccion())) {
      this.cliente.set('');
      this.direccion.set('');
      this.vista.set('pedidos');
    }
  }
  // inject obtiene servicios administrados por Angular, sin crearlos manualmente con new.
  private readonly catalogoService = inject(CatalogoService);
  private readonly destroyRef = inject(DestroyRef);
  readonly productos = signal<Producto[]>([]);
  // Informa la conectividad del navegador; no garantiza que un servidor responda.
  readonly online = signal(navigator.onLine);
  readonly cargando = signal(false);
  readonly error = signal('');
  readonly aviso = signal('');
  readonly busqueda = signal('');
  readonly categoria = signal('');
  readonly soloDisponibles = signal(false);
  readonly orden = signal('nombre');
  // Favoritos solo en memoria: a diferencia del carrito, se reinician al recargar.
  readonly favoritos = signal<number[]>([]);
  readonly soloFavoritos = signal(false);
  readonly unidades = computed(() => this.productos().reduce((total, p) => total + p.stock, 0));
  readonly disponibles = computed(() => this.productos().filter((p) => p.stock > 0).length);
  alternarFavorito(id: number): void {
    this.favoritos.update((ids) =>
      ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id],
    );
  }
  // Set elimina categorías repetidas para construir las opciones del filtro.
  readonly categorias = computed(() =>
    [...new Set(this.productos().map((p) => p.categoria))].sort(),
  );
  // Búsqueda: NFD separa las tildes y la expresión regular las quita.
  // Así "cusquena" coincide con "Cusqueña". Luego se combinan filtros y ordenamiento.
  // filter crea un arreglo nuevo, por lo que sort no altera el catálogo original.
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

  // Al crear el componente se consulta el catálogo y se escuchan cambios de conexión.
  // DestroyRef retira los eventos al destruirlo para no dejar escuchadores activos.
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

  // Observable representa la consulta asíncrona. subscribe procesa éxito o error.
  // cargando bloquea solicitudes simultáneas; takeUntilDestroyed cancela la suscripción
  // si el componente desaparece antes de recibir la respuesta.
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

  // Restablece la vista del catálogo; no modifica productos, carrito ni favoritos guardados en memoria.
  limpiarFiltros(): void {
    this.busqueda.set('');
    this.categoria.set('');
    this.soloDisponibles.set(false);
    this.orden.set('nombre');
    this.soloFavoritos.set(false);
  }
}
