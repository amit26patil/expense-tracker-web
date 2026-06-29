import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { ExpenseService } from '../../services/expense.service';
import { DaySummary, MonthSummary, Transaction } from '../../models/transaction.model';
import { TransactionFormComponent } from '../transaction-form/transaction-form.component';

interface ExcelUploadResponse {
  filename: string;
  record_count: number;
  records: any[];
}

interface CalendarDay {
  date: Date;
  inMonth: boolean;
  iso: string;
  income: Record<string, number>;
  expense: Record<string, number>;
  hasActivity: boolean;
}

@Component({
  selector: 'app-month-view',
  standalone: true,
  imports: [CommonModule, TransactionFormComponent],
  templateUrl: './month-view.component.html',
  styleUrl: './month-view.component.scss',
})
export class MonthViewComponent implements OnInit {
  today = new Date();
  viewYear = this.today.getFullYear();
  viewMonth = this.today.getMonth() + 1;

  summary: MonthSummary | null = null;
  calendarDays: CalendarDay[] = [];
  selectedDay: DaySummary | null = null;
  selectedDate = '';
  showForm = false;
  loading = true;
  weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  todayIso = '';

  constructor(
    private expenseService: ExpenseService,
    private router: Router,
  ) {
    this.todayIso = this.toIsoDate(this.today);
  }

  ngOnInit(): void {
    this.loadMonth();
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
    this.loadMonth();
  }

  nextMonth(): void {
    if (this.viewMonth === 12) {
      this.viewMonth = 1;
      this.viewYear++;
    } else {
      this.viewMonth++;
    }
    this.loadMonth();
  }

  goToToday(): void {
    this.viewYear = this.today.getFullYear();
    this.viewMonth = this.today.getMonth() + 1;
    this.loadMonth();
  }

  loadMonth(): void {
    this.loading = true;
    this.selectedDay = null;
    this.expenseService.getMonthSummary(this.viewYear, this.viewMonth).subscribe({
      next: (summary) => {
        this.summary = summary;
        this.buildCalendar(summary);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  buildCalendar(summary: MonthSummary): void {
    const first = new Date(this.viewYear, this.viewMonth - 1, 1);
    const startOffset = first.getDay();
    const daysInMonth = new Date(this.viewYear, this.viewMonth, 0).getDate();
    const dayMap = new Map(summary.days.map((d) => [d.date, d]));

    const cells: CalendarDay[] = [];

    for (let i = 0; i < startOffset; i++) {
      const d = new Date(this.viewYear, this.viewMonth - 1, -(startOffset - i - 1));
      cells.push(this.makeCalendarDay(d, false, dayMap));
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(this.viewYear, this.viewMonth - 1, day);
      cells.push(this.makeCalendarDay(d, true, dayMap));
    }

    while (cells.length % 7 !== 0) {
      const last = cells[cells.length - 1].date;
      const d = new Date(last);
      d.setDate(d.getDate() + 1);
      cells.push(this.makeCalendarDay(d, false, dayMap));
    }

    this.calendarDays = cells;
  }

  makeCalendarDay(
    date: Date,
    inMonth: boolean,
    dayMap: Map<string, DaySummary>,
  ): CalendarDay {
    const iso = this.toIsoDate(date);
    const dayData = dayMap.get(iso);
    const income = dayData?.income ?? {};
    const expense = dayData?.expense ?? {};
    const hasActivity =
      Object.values(income).some((v) => v > 0) ||
      Object.values(expense).some((v) => v > 0);

    return { date, inMonth, iso, income, expense, hasActivity };
  }

  selectDay(day: CalendarDay): void {
    if (!day.inMonth) {
      return;
    }
    this.selectedDate = day.iso;
    this.selectedDay =
      this.summary?.days.find((d) => d.date === day.iso) ?? {
        date: day.iso,
        income: day.income,
        expense: day.expense,
        transactions: [],
      };
  }

  isToday(day: CalendarDay): boolean {
    return day.iso === this.toIsoDate(this.today);
  }

  isSelected(day: CalendarDay): boolean {
    return day.iso === this.selectedDate;
  }

  openForm(): void {
    if (!this.selectedDate) {
      this.selectedDate = this.toIsoDate(this.today);
    }
    this.showForm = true;
  }

  onTransactionSaved(): void {
    this.loadMonth();
    if (this.selectedDate) {
      const iso = this.selectedDate;
      setTimeout(() => {
        const match = this.summary?.days.find((d) => d.date === iso);
        if (match) {
          this.selectedDay = match;
        }
      }, 300);
    }
  }

  deleteTransaction(tx: Transaction): void {
    if (!confirm('Delete this transaction?')) {
      return;
    }
    this.expenseService.deleteTransaction(tx.id).subscribe({
      next: () => this.onTransactionSaved(),
    });
  }

  formatAmounts(totals: Record<string, number>): string[] {
    return Object.entries(totals)
      .filter(([, v]) => v > 0)
      .map(([currency, amount]) => `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`);
  }

  currencySymbol(currency: string): string {
    return currency === 'INR' ? '₹' : '$';
  }

  viewDetails(): void {
    this.router.navigate(['/monthly-detail'], {
      queryParams: { year: this.viewYear, month: this.viewMonth },
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    this.loading = true;

    this.expenseService.uploadExcel(file).subscribe({
      next: (response: ExcelUploadResponse) => {
        this.loading = false;
        this.router.navigate(['/transaction-review'], {
          state: { records: response.records, filename: response.filename },
        });
      },
      error: (err) => {
        this.loading = false;
        console.error('Upload failed:', err);
      },
    });

    input.value = '';
  }

  private toIsoDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
