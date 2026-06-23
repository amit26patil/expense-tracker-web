import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ExpenseService } from '../../services/expense.service';
import { Category, Currency, TransactionType } from '../../models/transaction.model';

@Component({
  selector: 'app-transaction-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './transaction-form.component.html',
  styleUrl: './transaction-form.component.scss',
})
export class TransactionFormComponent implements OnChanges {
  @Input() open = false;
  @Input() selectedDate = '';
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  type: TransactionType = 'expense';
  category = '';
  amount: number | null = null;
  currency: Currency = 'INR';
  description = '';
  categories: Category[] = [];
  currencies: string[] = ['INR', 'USD'];
  saving = false;
  error = '';

  constructor(private expenseService: ExpenseService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue) {
      this.resetForm();
      this.loadCategories();
    }
  }

  onTypeChange(): void {
    this.category = '';
    this.loadCategories();
  }

  loadCategories(): void {
    this.expenseService.getCategories(this.type).subscribe({
      next: (cats) => {
        this.categories = cats;
        if (cats.length && !this.category) {
          this.category = cats[0].name;
        }
      },
    });
  }

  submit(): void {
    if (!this.selectedDate || !this.category || !this.amount || this.amount <= 0) {
      this.error = 'Please fill in all required fields.';
      return;
    }

    this.saving = true;
    this.error = '';

    this.expenseService
      .createTransaction({
        date: this.selectedDate,
        type: this.type,
        category: this.category,
        amount: this.amount,
        currency: this.currency,
        description: this.description.trim(),
      })
      .subscribe({
        next: () => {
          this.saving = false;
          this.saved.emit();
          this.close();
        },
        error: () => {
          this.saving = false;
          this.error = 'Failed to save. Please try again.';
        },
      });
  }

  close(): void {
    this.closed.emit();
  }

  private resetForm(): void {
    this.type = 'expense';
    this.amount = null;
    this.currency = 'INR';
    this.description = '';
    this.error = '';
    this.category = '';
  }
}
