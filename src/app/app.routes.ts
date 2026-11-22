import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { PbService } from './services/pb.service';

/** Only logged-in users can open the page. */
const authGuard: CanActivateFn = () => {
  const pbs = inject(PbService);
  const router = inject(Router);
  return pbs.isLoggedIn ? true : router.parseUrl('/login');
};

/** App start: login -> home, where the customer picks My Kundli or Match Making. */
const startGuard: CanActivateFn = () => {
  const pbs = inject(PbService);
  const router = inject(Router);
  return router.parseUrl(pbs.isLoggedIn ? '/home' : '/login');
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
    path: 'tarabalam',
    canActivate: [authGuard],
    loadComponent: () => import('./tarabalam/tarabalam.page').then((m) => m.TarabalamPage),
  },
  {
    path: 'astrologers',
    canActivate: [authGuard],
    loadComponent: () => import('./comm/astrologers.page').then((m) => m.AstrologersPage),
  },
  {
    path: 'messages',
    canActivate: [authGuard],
    loadComponent: () => import('./comm/messages.page').then((m) => m.MessagesPage),
  },
  {
    path: 'messages/:staff',
    canActivate: [authGuard],
    loadComponent: () => import('./comm/messages.page').then((m) => m.MessagesPage),
  },
  {
    path: 'my-location',
    canActivate: [authGuard],
    loadComponent: () => import('./comm/location.page').then((m) => m.LocationPage),
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () => import('./comm/profile.page').then((m) => m.ProfilePage),
  },
  {
    path: 'matches',
    canActivate: [authGuard],
    loadComponent: () => import('./matches/matches.page').then((m) => m.MatchesPage),
  },
  {
    path: 'match-new',
    canActivate: [authGuard],
    loadComponent: () => import('./match-new/match-new.page').then((m) => m.MatchNewPage),
  },
  {
    path: 'match/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./match/match.page').then((m) => m.MatchPage),
  },
  {
    path: 'payment/:planId',
    canActivate: [authGuard],
    loadComponent: () => import('./payment/payment.page').then((m) => m.PaymentPage),
  },
  {
    path: 'home',
    canActivate: [authGuard],
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
  },
  { path: '**', redirectTo: '' },
];
