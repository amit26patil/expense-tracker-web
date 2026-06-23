import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';

import { ExpenseService } from '../../services/expense.service';
import { CategoryDetail, MonthDetail, Transaction } from '../../models/transaction.model';

@Component({
  selector: 'app-month-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './month-detail.component.html',
  styleUrl: './month-detail.component.scss',
})
export class MonthDetailComponent implements OnInit {
  detail: MonthDetail | null = null;
  loading = true;
  viewYear = 0;
  viewMonth = 0;
  expandedCategories = new Set<string>();

  constructor(
    private expenseService: ExpenseService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    const year = Number(this.route.snapshot.queryParamMap.get('year'));
    const month = Number(this.route.snapshot.queryParamMap.get('month'));
    const today = new Date();
    this.viewYear = year || today.getFullYear();
    this.viewMonth = month || today.getMonth() + 1;
    this.loadDetail();
  }

  get monthLabel(): string {
    return new Date(this.viewYear, this.viewMonth - 1, 1).toLocaleString('default', {
      month: 'long',
      year: 'numeric',
    });
  }

  prevMonth(): void {
    if (this.viewMonth === 1) {
      this.viewMonth = 12;
      this.viewYear--;
    } else {
      this.viewMonth--;
    }
    this.loadDetail();
  }

  nextMonth(): void {
    if (this.viewMonth === 12) {
      this.viewMonth = 1;
      this.viewYear++;
    } else {
      this.viewMonth++;
    }
    this.loadDetail();
  }

  goBack(): void {
    this.router.navigate(['/'], { queryParams: { year: this.viewYear, month: this.viewMonth } });
  }

  loadDetail(): void {
    this.loading = true;
    this.expenseService.getMonthDetail(this.viewYear, this.viewMonth).subscribe({
      next: (detail) => {
        this.detail = detail;
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  toggleCategory(key: string): void {
    if (this.expandedCategories.has(key)) {
      this.expandedCategories.delete(key);
    } else {
      this.expandedCategories.add(key);
    }
  }

  isExpanded(key: string): boolean {
    return this.expandedCategories.has(key);
  }

  get expenseCategories(): CategoryDetail[] {
    return this.detail?.by_category.filter((c) => c.type === 'expense') ?? [];
  }

  get incomeCategories(): CategoryDetail[] {
    return this.detail?.by_category.filter((c) => c.type === 'income') ?? [];
  }

  formatAmounts(totals: Record<string, number>): string[] {
    return Object.entries(totals)
      .filter(([, v]) => v > 0)
      .map(
        ([currency, amount]) =>
          `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`,
      );
  }

  currencySymbol(currency: string): string {
    return currency === 'INR' ? '₹' : '$';
  }

  categoryTotal(cat: CategoryDetail): string {
    return this.formatAmounts(cat.totals).join(' · ') || '—';
  }

  percentage(cat: CategoryDetail): number {
    if (!this.detail) return 0;
    const totalExpense = Object.values(this.detail.total_expense).reduce((s, v) => s + v, 0);
    if (totalExpense === 0) return 0;
    const catTotal = Object.values(cat.totals).reduce((s, v) => s + v, 0);
    return Math.round((catTotal / totalExpense) * 100);
  }
}
