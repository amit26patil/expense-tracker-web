import { Injectable } from '@angular/core';
import { openDB, IDBPDatabase } from 'idb';
import { TransactionType, Currency } from '../models/transaction.model';

export interface StoredTransaction {
  id?: number;
  date: string;
  type: TransactionType;
  category: string;
  amount: number;
  currency: Currency;
  description: string;
  source: 'excel-upload' | 'manual';
  createdAt: string;
}

interface ExpenseTrackerDB {
  transactions: {
    key: number;
    value: StoredTransaction;
    indexes: {
      'by-date': string;
      'by-category': string;
      'by-type': TransactionType;
    };
  };
}

const DB_NAME = 'expense-tracker';
const DB_VERSION = 1;
const STORE_NAME = 'transactions';

@Injectable({ providedIn: 'root' })
export class TransactionDbService {
  private dbPromise: Promise<IDBPDatabase<ExpenseTrackerDB>>;

  constructor() {
    this.dbPromise = openDB<ExpenseTrackerDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('by-date', 'date');
        store.createIndex('by-category', 'category');
        store.createIndex('by-type', 'type');
      },
    });
  }

  async addTransaction(tx: Omit<StoredTransaction, 'id'>): Promise<number> {
    const db = await this.dbPromise;
    return db.add(STORE_NAME, tx as StoredTransaction) as Promise<number>;
  }

  async addBulkTransactions(txs: Omit<StoredTransaction, 'id'>[]): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction(STORE_NAME, 'readwrite');
    for (const item of txs) {
      tx.store.add(item as StoredTransaction);
    }
    await tx.done;
  }

  async getAllTransactions(): Promise<StoredTransaction[]> {
    const db = await this.dbPromise;
    return db.getAll(STORE_NAME);
  }

  async getTransactionsByMonth(year: number, month: number): Promise<StoredTransaction[]> {
    const db = await this.dbPromise;
    const all = await db.getAllFromIndex(STORE_NAME, 'by-date');
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    return all.filter((tx) => tx.date.startsWith(prefix));
  }

  async getTransactionById(id: number): Promise<StoredTransaction | undefined> {
    const db = await this.dbPromise;
    return db.get(STORE_NAME, id);
  }

  async updateTransaction(tx: StoredTransaction): Promise<void> {
    const db = await this.dbPromise;
    await db.put(STORE_NAME, tx);
  }

  async deleteTransaction(id: number): Promise<void> {
    const db = await this.dbPromise;
    await db.delete(STORE_NAME, id);
  }

  async clearAll(): Promise<void> {
    const db = await this.dbPromise;
    const tx = db.transaction(STORE_NAME, 'readwrite');
    await tx.store.clear();
    await tx.done;
  }

  async getCount(): Promise<number> {
    const db = await this.dbPromise;
    return db.count(STORE_NAME);
  }
}
