import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import {
  CreateMLCEngine,
  MLCEngine,
  prebuiltAppConfig,
  hasModelInCache,
  deleteModelInCache,
  AppConfig,
} from '@mlc-ai/web-llm';
import { dummyTransactions, categories }  from './dummy_transactions';
import { Category } from '../models/transaction.model';

export type ModelState = 'idle' | 'loading' | 'ready' | 'error';

export interface CategorizedTransaction {
  index: number;
  category: string;
  type: 'income' | 'expense';
}

interface LlmCategoryResult {
  index: number;
  category: string;
  type: string;
}

const MODEL_ID = 'Qwen2.5-3B-Instruct-q4f16_1-MLC';//'TinyLlama-1.1B-Chat-v1.0-q4f16_1-MLC';
const BATCH_SIZE = 5;

const appConfig: AppConfig = {
  ...prebuiltAppConfig,
  cacheBackend: 'indexeddb',
};

@Injectable({ providedIn: 'root' })
export class WebllmService {
  private engine: MLCEngine | null = null;

  private modelState$ = new BehaviorSubject<ModelState>('idle');
  private progress$ = new BehaviorSubject<{ progress: number; text: string }>({ progress: 0, text: '' });

  modelState = this.modelState$.asObservable();
  progress = this.progress$.asObservable();

  constructor(private zone: NgZone) {console.log(dummyTransactions);}

  async isModelCached(): Promise<boolean> {
    try {
      return await hasModelInCache(MODEL_ID, appConfig);
    } catch {
      return false;
    }
  }

  async clearModelCache(): Promise<void> {
    try {
      await deleteModelInCache(MODEL_ID, appConfig);
      console.log('Model cache cleared.');
    } catch (err) {
      console.error('Failed to clear model cache:', err);
    }
  }

  async loadModel(): Promise<void> {
    if (this.modelState$.value === 'ready' || this.modelState$.value === 'loading') {
      console.log('Model is already loaded or loading. Current state:', this.modelState$.value);
      return;
    }
    console.log('Loading WebLLM model...');
    this.modelState$.next('loading');
    this.progress$.next({ progress: 0, text: 'Starting model load...' });

    try {
      const cached = await this.isModelCached();
      if (cached) {
        console.log('Model found in IndexedDB cache. Loading from cache...');
        this.zone.run(() => {
          this.progress$.next({ progress: 0, text: 'Model found in cache. Loading...' });
        });
      } else {
        console.log('Model not in cache. Downloading...');
      }

      this.engine = await CreateMLCEngine(MODEL_ID, {
        appConfig,
        initProgressCallback: (report) => {
          this.zone.run(() => {
            this.progress$.next({
              progress: report.progress,
              text: report.text || `Loading model... ${Math.round(report.progress * 100)}%`,
            });
          });
        },
      });
      this.zone.run(() => {
        this.modelState$.next('ready');
        this.progress$.next({ progress: 1, text: 'Model ready' });
      });
    } catch (err) {
      console.error('Failed to load WebLLM model:', err);
      this.zone.run(() => {
        this.modelState$.next('error');
        this.progress$.next({ progress: 0, text: 'Failed to load model' });
      });
      throw err;
    }
  }

  async categorizeTransactions(
    records: Record<string, any>[],
    categories: Category[],
  ): Promise<CategorizedTransaction[]> {
    if (!this.engine || this.modelState$.value !== 'ready') {
      throw new Error('Model not loaded. Call loadModel() first.');
    }

    const categoryList = categories.map((c) => `${c.name} (${c.type})`).join(', ');
    const results: CategorizedTransaction[] = [];

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const batchResults = await this.categorizeBatch(batch, categoryList, i);
      results.push(...batchResults);
    }

    return results;
  }

  private async categorizeBatch(
    batch: Record<string, any>[],
    categoryList: string,
    startIndex: number,
  ): Promise<CategorizedTransaction[]> {
    var temp = batch.map((r, idx) => {
        const withdrawal = r['Withdrawal Amount(INR)'] || 0;
        const remarks = r['Transaction Remarks'] || r['Description'] || '';
        if(withdrawal <= 0) {
            return null;
        }
        if(remarks.startsWith("UPI")) {
            var comments = remarks.split('/');
            if(comments.length > 3) {
              var to =comments[2];
              var comments = comments[3].toLowerCase();
              return {id: idx+1, to, comments};
            }
        }
        else if(remarks.indexOf("AMAZON") != -1) {
            return {id: idx+1, to: '', comments: 'amazon'};
        }
        else if(remarks.startsWith("ACH") || remarks.indexOf("ZERODHA") != -1) {
            return {id: idx+1, to: '', comments: 'investment'};
        }
        return {id: idx+1, to: remarks, comments: remarks.toLowerCase()};
    }).filter((r) => r !== null).map((r) => {
        return `${r.id}. "${r.comments}"`;
    }).join('\n');
    const transactionLines = batch
      .map((r, idx) => {
        const remarks = r['Transaction Remarks'] || r['Description'] || '';
        const withdrawal = r['Withdrawal Amount(INR)'] || 0;
        const deposit = r['Deposit Amount(INR)'] || 0;
        const amount = withdrawal > 0 ? withdrawal : deposit;
        return `${idx + 1}. "${remarks}" (Amount: ${amount})`;
      })
      .join('\n');

    const prompt = `You are a bank transaction categorizer. Categorize each transaction by its remarks/description into one of these categories: ${JSON.stringify(categories)}.

For each transaction, determine:
1. The most appropriate category from the list
2. Whether it is "income" or "expense"

Transactions:
${JSON.stringify(dummyTransactions, null, 2)}

Return ONLY a JSON array (no markdown, no explanation). Each element must have:
- "index": the transaction number (1-based)
- "category": the category name (exact match from the list) 

Example output:
[{"index":1,"category":"Food"},{"index":2,"category":"Health"}]`;
    console.log('LLM prompt for batch starting at index', startIndex, ':\n', prompt);

    try {
      const response = await this.engine!.chat.completions.create({
        model: MODEL_ID,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 4096*2,
      });
      console.log('LLM response for batch starting at index', startIndex, ':', response);
      const content = response.choices[0]?.message?.content || '[]';
      console.log('LLM content for batch starting at index', startIndex, ':', content);
      return this.parseLlmResponse(content, batch.length, startIndex);
    } catch (err) {
      console.error('LLM categorization failed for batch:', err);
      return batch.map((_, idx) => ({
        index: startIndex + idx,
        category: 'Other Expense',
        type: 'expense' as const,
      }));
    }
  }

  private parseLlmResponse(
    content: string,
    batchSize: number,
    startIndex: number,
  ): CategorizedTransaction[] {
    try {
      const cleaned = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const parsed = JSON.parse(cleaned);

      let items: LlmCategoryResult[];
      if (Array.isArray(parsed)) {
        items = parsed;
      } else if (parsed.transactions && Array.isArray(parsed.transactions)) {
        items = parsed.transactions;
      } else if (parsed.results && Array.isArray(parsed.results)) {
        items = parsed.results;
      } else {
        items = Object.values(parsed).find(Array.isArray) as LlmCategoryResult[] || [];
      }

      const results: CategorizedTransaction[] = [];
      for (let i = 0; i < batchSize; i++) {
        const item = items.find((p) => p.index === i + 1);
        if (item && item.category) {
          results.push({
            index: startIndex + i,
            category: item.category,
            type: 'expense',
          });
        } else {
          results.push({
            index: startIndex + i,
            category: 'Other Expense',
            type: 'expense',
          });
        }
      }
      return results;
    } catch {
      return Array.from({ length: batchSize }, (_, i) => ({
        index: startIndex + i,
        category: 'Other Expense',
        type: 'expense' as const,
      }));
    }
  }

  resetModel(): void {
    this.engine = null;
    this.modelState$.next('idle');
    this.progress$.next({ progress: 0, text: '' });
  }
}
