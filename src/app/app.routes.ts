import { Routes } from '@angular/router';
import { MonthViewComponent } from './components/month-view/month-view.component';
import { MonthDetailComponent } from './components/month-detail/month-detail.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', component: MonthViewComponent, canActivate: [authGuard] },
  { path: 'monthly-detail', component: MonthDetailComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: '' },
];
