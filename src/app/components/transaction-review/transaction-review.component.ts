import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { ExpenseService } from '../../services/expense.service';
import { WebllmService, ModelState, CategorizedTransaction } from '../../services/webllm.service';
import { TransactionDbService, StoredTransaction } from '../../services/transaction-db.service';
import { Category } from '../../models/transaction.model';

interface ReviewRow {
  index: number;
  date: string;
  remarks: string;
  withdrawal: number;
  deposit: number;
  selectedCategory: string;
  selectedType: 'income' | 'expense';
  originalCategory: string;
  originalType: 'income' | 'expense';
}

@Component({
  selector: 'app-transaction-review',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './transaction-review.component.html',
  styleUrl: './transaction-review.component.scss',
})
export class TransactionReviewComponent implements OnInit {
  rows: ReviewRow[] = [];
  categories: Category[] = [];
  modelState: ModelState = 'idle';
  progressText = '';
  progressPercent = 0;
  saving = false;
  saved = false;
  autoSave = false;
  error = '';
  filename = '';

  constructor(
    private router: Router,
    private expenseService: ExpenseService,
    private webllmService: WebllmService,
    private transactionDb: TransactionDbService,
  ) {}

  ngOnInit(): void {
    const nav = this.router.getCurrentNavigation();
    const state = history.state as { records?: Record<string, any>[]; filename?: string };

    if (!state?.records?.length) {
      this.router.navigate(['/']);
      return;
    }

    this.filename = state.filename || 'transactions';
    this.loadCategories(state.records);
  }

  private loadCategories(records: Record<string, any>[]): void {
    this.expenseService.getCategories().subscribe({
      next: (cats) => {
        this.categories = cats;
        this.processRecords(records);
      },
      error: () => {
        this.error = 'Failed to load categories.';
      },
    });
  }

  private async processRecords(records: Record<string, any>[]): Promise<void> {
    try {
      await this.webllmService.loadModel();
    } catch {
      this.error = 'Failed to load AI model. Please try again.';
      return;
    }

    this.webllmService.modelState.subscribe((state) => {
      this.modelState = state;
    });

    this.webllmService.progress.subscribe((p) => {
      this.progressText = p.text;
      this.progressPercent = Math.round(p.progress * 100);
    });

    try {
      const categorized = await this.webllmService.categorizeTransactions(records, this.categories);
      this.buildRows(records, categorized);

      if (this.autoSave) {
        await this.saveAll();
      }
    } catch {
      this.error = 'Failed to categorize transactions.';
    }
  }

  private buildRows(records: Record<string, any>[], results: CategorizedTransaction[]): void {
    this.rows = records.map((r, i) => {
      const cat = results.find((c) => c.index === i);
      const dateVal = r['Value Date'] || r['Transaction Date'] || '';
      const dateStr = this.parseDate(dateVal);
      const withdrawal = parseFloat(r['Withdrawal Amount(INR)']) || 0;
      const deposit = parseFloat(r['Deposit Amount(INR)']) || 0;

      return {
        index: i,
        date: dateStr,
        remarks: r['Transaction Remarks'] || '',
        withdrawal,
        deposit,
        selectedCategory: cat?.category || 'Other Expense',
        selectedType: (cat?.type || 'expense') as 'income' | 'expense',
        originalCategory: cat?.category || 'Other Expense',
        originalType: (cat?.type || 'expense') as 'income' | 'expense',
      };
    });
  }

  private parseDate(dateVal: any): string {
    if (!dateVal) return '';
    if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateVal)) {
      return dateVal.substring(0, 10);
    }
    try {
      const d = new Date(dateVal);
      if (!isNaN(d.getTime())) {
        return d.toISOString().substring(0, 10);
      }
    } catch {}
    return String(dateVal);
  }

  onCategoryChange(row: ReviewRow, newCategory: string): void {
    row.selectedCategory = newCategory;
    const cat = this.categories.find((c) => c.name === newCategory);
    if (cat) {
      row.selectedType = cat.type as 'income' | 'expense';
    }
  }

  onTypeChange(row: ReviewRow, newType: 'income' | 'expense'): void {
    row.selectedType = newType;
    const validCats = this.categories.filter((c) => c.type === newType);
    if (validCats.length && !validCats.some((c) => c.name === row.selectedCategory)) {
      row.selectedCategory = validCats[0].name;
    }
  }

  getCategoriesForType(type: string): Category[] {
    return this.categories.filter((c) => c.type === type);
  }

  get incomeCount(): number {
    return this.rows.filter((r) => r.selectedType === 'income').length;
  }

  get expenseCount(): number {
    return this.rows.filter((r) => r.selectedType === 'expense').length;
  }

  get hasChanges(): boolean {
    return this.rows.some(
      (r) => r.selectedCategory !== r.originalCategory || r.selectedType !== r.originalType,
    );
  }

  async saveAll(): Promise<void> {
    if (!this.rows.length) return;

    this.saving = true;
    this.error = '';

    try {
      const txs: Omit<StoredTransaction, 'id'>[] = this.rows.map((row) => ({
        date: row.date,
        type: row.selectedType,
        category: row.selectedCategory,
        amount: row.withdrawal > 0 ? row.withdrawal : row.deposit,
        currency: 'INR' as const,
        description: row.remarks,
        source: 'excel-upload' as const,
        createdAt: new Date().toISOString(),
      }));

      await this.transactionDb.addBulkTransactions(txs);
      this.saved = true;
    } catch {
      this.error = 'Failed to save transactions. Please try again.';
    } finally {
      this.saving = false;
    }
  }

  goBack(): void {
    this.router.navigate(['/']);
  }

  viewMonthly(): void {
    const now = new Date();
    this.router.navigate(['/monthly-detail'], {
      queryParams: { year: now.getFullYear(), month: now.getMonth() + 1 },
    });
  }

  formatAmount(val: number): string {
    return val > 0 ? val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
  }
}
