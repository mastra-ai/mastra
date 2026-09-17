export interface DemoCustomer {
  id: string;
  name: string;
  email: string;
  tenantId: string;
  stripeCustomerId: string;
  intercomContactId: string;
  checkoutSessionId?: string;
  subscriptionId?: string;
  invoiceId?: string;
  paymentIntentId?: string;
  purchasePaid?: boolean;
  purchase?: {
    product: string;
    amountMinor: number;
    currency: string;
    purchasedAt: string;
  };
  subscription?: {
    plan: string;
    amountMinor: number;
    currency: string;
    interval: string;
    startedAt?: string;
    renewsAt: string;
  };
}

export interface DemoSession {
  id: string;
  customer: DemoCustomer;
  csrfToken: string;
  expiresAt: string;
}
