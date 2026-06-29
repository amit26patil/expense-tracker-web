import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import * as XLSX from 'xlsx';

import { environment } from '../../environments/environment';
import {
  Category,
  MonthDetail,
  MonthSummary,
  Transaction,
  TransactionCreate,
} from '../models/transaction.model';

export interface ExcelUploadResponse {
  filename: string;
  record_count: number;
  records: Record<string, any>[];
}

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

  uploadExcel(file: File): Observable<ExcelUploadResponse> {
    return new Observable((subscriber) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target!.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

          const HEADER_ROW = 12;
          if (rows.length <= HEADER_ROW) {
            subscriber.next({ filename: file.name, record_count: 0, records: [] });
            subscriber.complete();
            return;
          }

          const headers: string[] = rows[HEADER_ROW]
            .map((h: any) => (typeof h === 'string' ? h.trim() : String(h).trim()));

          const records: Record<string, any>[] = [];
          for (let r = HEADER_ROW + 1; r < rows.length; r++) {
            const rowVals = rows[r];
            const snoRaw = rowVals[1];
            const sno = String(snoRaw ?? '').trim();
            if (!sno) continue;
            if (isNaN(Number(sno))) break;

            const record: Record<string, any> = {};
            for (let c = 0; c < headers.length; c++) {
              const h = headers[c];
              if (!h) continue;
              let val = rowVals[c];
              if (h === 'S No.') {
                val = parseInt(sno, 10);
              } else if (
                h === 'Withdrawal Amount(INR)' ||
                h === 'Deposit Amount(INR)' ||
                h === 'Balance(INR)'
              ) {
                val = val ? parseFloat(val) : 0.0;
              }
              record[h] = val;
            }
            records.push(record);
          }

          subscriber.next({
            filename: file.name,
            record_count: records.length,
            records,
          });
          subscriber.complete();
        } catch (err) {
          subscriber.error(err);
        }
      };
      reader.onerror = () => subscriber.error(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }
}
