import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app';
import { TiendaStorage } from './services/tienda-storage';

const productos = [
  { id: 1, nombre: 'Cristal', categoria: 'Cerveza', precio: 3.4, stock: 10 },
  { id: 2, nombre: 'Cusqueña', categoria: 'Cerveza', precio: 4.1, stock: 0 },
];
describe('Catálogo', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: TiendaStorage,
          useValue: { cargar: async () => ({ carrito: [], pedidos: [] }), guardar: async () => {} },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('permite agregar al carrito y consultar el detalle de un pedido', async () => {
    const fixture = TestBed.createComponent(App);
    http.expectOne('data/catalogo.json').flush(productos);
    http.expectOne('data/precios.json').flush([]);
    await fixture.whenStable();
    const app = fixture.componentInstance;
    const cantidad = fixture.nativeElement.querySelector('#cantidad-1') as HTMLInputElement;
    cantidad.value = '2';
    cantidad.dispatchEvent(new Event('input', { bubbles: true }));
    await fixture.whenStable();
    const agregar = fixture.nativeElement.querySelector(
      '.buy-actions .primary',
    ) as HTMLButtonElement;
    expect(agregar.disabled).toBe(false);
    agregar.click();
    await fixture.whenStable();
    expect(app.tienda.cantidad()).toBe(2);
    app.vista.set('carrito');
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Carrito de compras');
    expect(fixture.nativeElement.textContent).toContain('S/ 6.80');
    app.cliente.set('Cliente de prueba');
    app.direccion.set('Dirección de prueba');
    await app.registrarPedido();
    await fixture.whenStable();
    expect(app.vista()).toBe('pedidos');
    expect(fixture.nativeElement.querySelector('details').textContent).toContain('2 × Cristal');
    expect(fixture.nativeElement.textContent).toContain('Guardado localmente');
  });

  it('muestra los precios y stock del archivo de precios', async () => {
    const fixture = TestBed.createComponent(App);
    http.expectOne('data/catalogo.json').flush(productos);
    http.expectOne('data/precios.json').flush([{ productoId: 1, precio: 5, stock: 3 }]);
    await fixture.whenStable();
    expect(fixture.componentInstance.productos()[0].precio).toBe(5);
    expect(fixture.componentInstance.productos()[0].stock).toBe(3);
    expect(fixture.nativeElement.querySelector('h1').textContent).toContain('Backus Ventas');
  });

  it('busca sin tildes y filtra los productos agotados', () => {
    const fixture = TestBed.createComponent(App);
    http.expectOne('data/catalogo.json').flush(productos);
    http.expectOne('data/precios.json').flush([]);
    const app = fixture.componentInstance;
    app.busqueda.set('cusquena');
    expect(app.filtrados().length).toBe(1);
    app.soloDisponibles.set(true);
    expect(app.filtrados().length).toBe(0);
    app.limpiarFiltros();
    expect(app.filtrados().length).toBe(2);
  });

  it('conserva el catálogo y avisa si fallan los precios', () => {
    const fixture = TestBed.createComponent(App);
    http.expectOne('data/catalogo.json').flush(productos);
    http.expectOne('data/precios.json').flush('Error', { status: 503, statusText: 'Unavailable' });
    expect(fixture.componentInstance.productos().length).toBe(2);
    expect(fixture.componentInstance.aviso()).toBeTruthy();
    expect(fixture.componentInstance.cargando()).toBe(false);
  });

  it('permite reintentar después de un error del catálogo', () => {
    const fixture = TestBed.createComponent(App);
    http.expectOne('data/precios.json').flush([]);
    http.expectOne('data/catalogo.json').flush('Error', { status: 503, statusText: 'Unavailable' });
    expect(fixture.componentInstance.error()).toBeTruthy();
    fixture.componentInstance.cargarCatalogo();
    http.expectOne('data/catalogo.json').flush(productos);
    http.expectOne('data/precios.json').flush([]);
    expect(fixture.componentInstance.error()).toBe('');
    expect(fixture.componentInstance.productos().length).toBe(2);
  });
});
