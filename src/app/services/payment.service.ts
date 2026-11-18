import { Injectable, inject } from '@angular/core';
import { RecordModel } from 'pocketbase';
import { PbService, PlanOffer } from './pb.service';

/**
 * Payment gateway settings.
 *
 * TO ENABLE RAZORPAY LATER:
 *  1. Put your Razorpay **Key ID** below (starts with rzp_test_ / rzp_live_). The Key ID is
 *     public and safe in the app. The **Key Secret** must NEVER be put here - it goes only in
 *     C:\pocketbase\pb_hooks\astro_config.js on the server.
 *  2. Add the two server routes (POST /api/astro/payments/order and /verify).
 *  3. Set `enabled: true`.
 * Until then the payment screen works fully but shows "online payment not available yet".
 */
export const PAYMENT_CONFIG = {
  enabled: false,
  gateway: 'razorpay' as const,
  razorpayKeyId: '',
  /** Shown at the top of the Razorpay window. */
  businessName: 'Astro Diary',
  themeColor: '#13245e',
};

export type PayResult =
  | { status: 'success'; subscription: RecordModel | null }
  | { status: 'cancelled' }
  | { status: 'failed'; message: string }
  | { status: 'not_ready' };

/** What the server returns when it creates a Razorpay order (amount in paise / cents). */
interface OrderResponse {
  order_id: string;
  amount: number;
  currency: string;
  payment_id: string;
}

interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay?: any;
  }
}

const CHECKOUT_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private pbs = inject(PbService);

  get ready(): boolean {
    return PAYMENT_CONFIG.enabled && !!PAYMENT_CONFIG.razorpayKeyId;
  }

  /**
   * Full payment flow:
   *  server creates the order (price is decided on the server, never trusted from the app)
   *  -> Razorpay window -> server checks the signature and activates the subscription.
   */
  async pay(plan: PlanOffer): Promise<PayResult> {
    if (!this.ready) return { status: 'not_ready' };

    const order = await this.pbs.pb.send<OrderResponse>('/api/astro/payments/order', {
      method: 'POST',
      body: { plan: plan.id },
    });
    await this.loadCheckout();

    const user = this.pbs.user;
    return new Promise<PayResult>((resolve) => {
      let done = false;
      const finish = (r: PayResult) => {
        if (!done) {
          done = true;
          resolve(r);
        }
      };
      const rzp = new window.Razorpay({
        key: PAYMENT_CONFIG.razorpayKeyId,
        order_id: order.order_id,
        amount: order.amount,
        currency: order.currency,
        name: PAYMENT_CONFIG.businessName,
        description: plan.name,
        prefill: {
          name: (user?.['name'] as string) || '',
          email: (user?.['email'] as string) || '',
          contact: (user?.['phone'] as string) || '',
        },
        notes: { payment_id: order.payment_id, plan: plan.id },
        theme: { color: PAYMENT_CONFIG.themeColor },
        handler: async (res: RazorpaySuccess) => {
          try {
            const sub = await this.pbs.pb.send<RecordModel>('/api/astro/payments/verify', {
              method: 'POST',
              body: { ...res, payment_id: order.payment_id },
            });
            finish({ status: 'success', subscription: sub });
          } catch (e) {
            finish({ status: 'failed', message: e instanceof Error ? e.message : '' });
          }
        },
        modal: { ondismiss: () => finish({ status: 'cancelled' }) },
      });
      rzp.on('payment.failed', (r: { error?: { description?: string } }) =>
        finish({ status: 'failed', message: r?.error?.description || '' }),
      );
      rzp.open();
    });
  }

  /** Loads Razorpay's checkout script once. */
  private loadCheckout(): Promise<void> {
    if (window.Razorpay) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = CHECKOUT_SCRIPT;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Could not load the payment window. Check your internet.'));
      document.body.appendChild(s);
    });
  }
}
