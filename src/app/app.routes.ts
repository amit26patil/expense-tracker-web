import { Routes } from '@angular/router';
import { MonthViewComponent } from './components/month-view/month-view.component';
import { MonthDetailComponent } from './components/month-detail/month-detail.component';

export const routes: Routes = [
  { path: '', component: MonthViewComponent },
  { path: 'monthly-detail', component: MonthDetailComponent },
  { path: '**', redirectTo: '' },
];
