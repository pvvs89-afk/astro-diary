import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { PbService } from './services/pb.service';

/** Only logged-in users can open the page. */
const authGuard: CanActivateFn = () => {
  const pbs = inject(PbService);
  const router = inject(Router);
  return pbs.isLoggedIn ? true : router.parseUrl('/login');
};

/** App start: login -> Home (today's star, quick actions, astrologers online). */
const startGuard: CanActivateFn = () => {
  const pbs = inject(PbService);
  const router = inject(Router);
  return router.parseUrl(pbs.isLoggedIn ? '/main' : '/login');
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
    path: 'main',
    canActivate: [authGuard],
    loadComponent: () => import('./start/start.page').then((m) => m.StartPage),
  },
  {
    path: 'wallet',
    canActivate: [authGuard],
    loadComponent: () => import('./start/wallet.page').then((m) => m.WalletPage),
  },
  {
    path: 'astrologer/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./comm/astrologer.page').then((m) => m.AstrologerPage),
  },
  {
    path: 'notifications',
    canActivate: [authGuard],
    loadComponent: () => import('./notify/notifications.page').then((m) => m.NotificationsPage),
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
