import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import {
  Category,
  MonthDetail,
  MonthSummary,
  Transaction,
  TransactionCreate,
} from '../models/transaction.model';

@Injectable({ providedIn: 'root' })
export class ExpenseService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getMonthSummary(year: number, month: number): Observable<MonthSummary> {
    const params = new HttpParams()
      .set('year', year)
      .set('month', month);
    return this.http.get<MonthSummary>(`${this.baseUrl}/transaction-summary/summary/month`, { params });
  }

  getMonthDetail(year: number, month: number): Observable<MonthDetail> {
    const params = new HttpParams()
      .set('year', year)
      .set('month', month);
    return this.http.get<MonthDetail>(`${this.baseUrl}/transaction-summary/detail/monthly`, { params });
  }

  getTransactions(year: number, month: number, day?: number): Observable<Transaction[]> {
    let params = new HttpParams().set('year', year).set('month', month);
    if (day) {
      params = params.set('day', day);
    }
    return this.http.get<Transaction[]>(`${this.baseUrl}/transactions`, { params });
  }

  createTransaction(payload: TransactionCreate): Observable<Transaction> {
    return this.http.post<Transaction>(`${this.baseUrl}/transactions`, payload);
  }

  deleteTransaction(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/transactions/${id}`);
  }

  getCategories(type?: string): Observable<Category[]> {
    let params = new HttpParams();
    if (type) {
      params = params.set('type', type);
    }
    return this.http.get<Category[]>(`${this.baseUrl}/categories`, { params });
  }

  getCurrencies(): Observable<string[]> {
    return this.http.get<string[]>(`${this.baseUrl}/currencies`);
  }

  uploadExcel(file: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post(`${this.baseUrl}/upload-excel`, formData);
  }
}
