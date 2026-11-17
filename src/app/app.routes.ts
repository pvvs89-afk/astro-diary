import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { PbService } from './services/pb.service';

/** Only logged-in users can open the page. */
const authGuard: CanActivateFn = () => {
  const pbs = inject(PbService);
  const router = inject(Router);
  return pbs.isLoggedIn ? true : router.parseUrl('/login');
};

/** App start: login -> birth details (if not filled) -> home. */
const startGuard: CanActivateFn = async () => {
  const pbs = inject(PbService);
  const router = inject(Router);
  if (!pbs.isLoggedIn) return router.parseUrl('/login');
  try {
    const has = await pbs.hasBirthDetails();
    return router.parseUrl(has ? '/home' : '/birth-details');
  } catch {
    return router.parseUrl('/login');
  }
};

export const routes: Routes = [
  { path: '', pathMatch: 'full', canActivate: [startGuard], children: [] },
  {
    path: 'login',
    loadComponent: () => import('./login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'birth-details',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./birth-details/birth-details.page').then((m) => m.BirthDetailsPage),
  },
  {
    path: 'kundli',
    canActivate: [authGuard],
    loadComponent: () => import('./kundli/kundli.page').then((m) => m.KundliPage),
  },
  {
    path: 'home',
    canActivate: [authGuard],
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
  },
  { path: '**', redirectTo: '' },
];
