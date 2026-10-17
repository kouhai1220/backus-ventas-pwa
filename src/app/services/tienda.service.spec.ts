import { TestBed } from '@angular/core/testing';
import { Producto } from './catalogo.service';
import { EstadoTienda, TiendaStorage } from './tienda-storage';
import { TiendaService } from './tienda.service';

const producto: Producto = { id: 1, nombre: 'Cristal', categoria: 'Cerveza', precio: 3.4, stock: 5 };
describe('Tienda y pedidos locales', () => {
  let disco: EstadoTienda;
  let fallar: boolean;
  let servicio: TiendaService;
  beforeEach(async () => {
    disco = { carrito: [], pedidos: [] };
    fallar = false;
    TestBed.configureTestingModule({ providers: [{ provide: TiendaStorage, useValue: {
      cargar: async () => structuredClone(disco),
      guardar: async (estado: EstadoTienda) => {
        if (fallar) throw new Error('Sin espacio');
        disco = structuredClone(estado);
      },
    } }] });
    servicio = TestBed.inject(TiendaService);
    await Promise.resolve();
  });
  it('guarda cantidades y calcula importes en céntimos', async () => {
    await servicio.cambiar(producto, 3);
    expect(servicio.cantidad()).toBe(3);
    expect(servicio.total()).toBe(1020);
    expect(disco.carrito[0].cantidad).toBe(3);
    await servicio.cambiar(producto, 0);
    expect(servicio.carrito()).toEqual([]);
  });
  it('rechaza cantidades negativas, fraccionarias y superiores al stock', async () => {
    for (const cantidad of [-1, 1.5, 6]) await servicio.cambiar(producto, cantidad);
    expect(servicio.carrito()).toEqual([]);
  });
  it('registra el pedido y vacía el carrito en una sola escritura', async () => {
    await servicio.cambiar(producto, 2);
    expect(await servicio.registrar([producto], 'Bodega Lima', 'Av. Lima 123')).toBe(true);
    expect(servicio.carrito()).toEqual([]);
    expect(disco.pedidos[0].totalCentimos).toBe(680);
    expect(disco.pedidos[0].estado).toBe('Guardado localmente');
    expect(disco.pedidos[0].lineas[0].cantidad).toBe(2);
    expect(await servicio.registrar([producto], 'Bodega Lima', 'Av. Lima 123')).toBe(false);
    expect(disco.pedidos.length).toBe(1);
  });
  it('no registra si faltan datos o cambian precios y stock', async () => {
    await servicio.cambiar(producto, 2);
    expect(await servicio.registrar([producto], ' ', 'Lima')).toBe(false);
    expect(await servicio.registrar([{ ...producto, stock: 1 }], 'Cliente', 'Lima')).toBe(false);
    expect(await servicio.registrar([{ ...producto, precio: 4 }], 'Cliente', 'Lima')).toBe(false);
    expect(servicio.pedidos()).toEqual([]);
    expect(servicio.cantidad()).toBe(2);
  });
  it('conserva el carrito si falla el guardado del pedido', async () => {
    await servicio.cambiar(producto, 2);
    fallar = true;
    expect(await servicio.registrar([producto], 'Cliente', 'Lima')).toBe(false);
    expect(servicio.cantidad()).toBe(2);
    expect(servicio.pedidos()).toEqual([]);
    expect(disco.carrito.length).toBe(1);
    expect(servicio.mensaje()).toContain('No se pudo guardar');
  });
  it('recupera los pedidos guardados y conserva sus precios históricos', async () => {
    await servicio.cambiar(producto, 2);
    await servicio.registrar([producto], 'Cliente', 'Lima');
    await servicio.cambiar({ ...producto, precio: 8 }, 1);
    await servicio.iniciar();
    expect(servicio.pedidos()[0].lineas[0].producto.precio).toBe(3.4);
    expect(servicio.carrito()[0].producto.precio).toBe(8);
    await servicio.cancelar(servicio.pedidos()[0].id);
    expect(disco.pedidos[0].estado).toBe('Cancelado');
  });
});
