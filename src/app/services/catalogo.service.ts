import { Injectable, inject } from '@angular/core'; 
import { HttpClient } from '@angular/common/http'; 
import { Observable } from 'rxjs'; 
export interface Producto { 
id:number; nombre:string; categoria:string; precio:number; stock:number; 
}
@Injectable({providedIn:'root'}) 
export class CatalogoService { 
private http = inject(HttpClient); 
obtenerCatalogo(): Observable<Producto[]> { 
return this.http.get<Producto[]>('/data/catalogo.json'); 
} 
} 