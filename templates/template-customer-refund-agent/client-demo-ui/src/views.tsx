import type { Child } from 'hono/jsx';
import type { DemoCustomer } from './types.js';

export function Layout(props: {
  title: string;
  children: Child;
  customer?: DemoCustomer;
  csrfToken?: string;
  widget?: string;
  requestsRefresh?: boolean;
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{props.title} · Northstar</title>
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body>
        <div class="shell">
          <nav class="nav">
            <a class="brand" href="/">
              <span class="mark">✦</span> Northstar
            </a>
            <div class="nav-links">
              {props.customer ? (
                <>
                  <span class="muted">{props.customer.name}</span>
                  <form method="post" action="/sair">
                    <input type="hidden" name="csrf" value={props.csrfToken ?? ''} />
                    <button class="button">Sign out</button>
                  </form>
                </>
              ) : (
                <a class="button" href="/entrar">
                  Sign in
                </a>
              )}
            </div>
          </nav>
          {props.children}
        </div>
        {props.widget ? <script dangerouslySetInnerHTML={{ __html: props.widget }} /> : null}
        {props.requestsRefresh ? (
          <script
            dangerouslySetInnerHTML={{
              __html:
                "(function(){var target=document.getElementById('financial-requests');if(!target)return;var refresh=function(){fetch('/solicitacoes',{credentials:'same-origin',cache:'no-store',headers:{'Cache-Control':'no-store'}}).then(function(response){if(!response.ok)return;return response.text()}).then(function(html){if(html)target.innerHTML=html}).catch(function(){})};window.setInterval(refresh,30000)})();",
            }}
          />
        ) : null}
      </body>
    </html>
  );
}
export function Landing() {
  return (
    <Layout title="Support that keeps up with you">
      <main class="hero">
        <div class="eyebrow">Northstar support</div>
        <h1>Your work keeps moving. We take care of the rest.</h1>
        <p class="lead">Track your requests and contact support in one place.</p>
        <div class="actions">
          <a class="button primary" href="/entrar">
            Access my account
          </a>
          <a class="button" href="/atendimento">
            Contact support
          </a>
        </div>
      </main>
      <section class="grid">
        <article class="card">
          <h2>Request status</h2>
          <p class="muted">See what has already been recorded and the actual status of each request.</p>
        </article>
        <article class="card">
          <h2>Support with context</h2>
          <p class="muted">Support starts with your authenticated account, without making you repeat information.</p>
        </article>
        <article class="card">
          <h2>Next invoice</h2>
          <p class="muted">When a credit is approved, it will be available for your next invoice.</p>
        </article>
      </section>
    </Layout>
  );
}
export function Login(props: { error?: string; next?: string }) {
  return (
    <Layout title="Sign in">
      <main class="auth">
        <div class="eyebrow">Northstar account</div>
        <h1>Sign in to track your requests.</h1>
        {props.error ? <p class="error">{props.error}</p> : null}
        <form method="post" action="/entrar">
          <input type="hidden" name="next" value={props.next ?? '/conta'} />
          <label class="field">
            Email
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <label class="field">
            Password
            <input name="password" type="password" autoComplete="current-password" required />
          </label>
          <button class="button primary" type="submit">
            Sign in to your account
          </button>
        </form>
      </main>
    </Layout>
  );
}
type SupportCase = {
  caseId: string;
  turnId: string;
  type: 'refund' | 'subscription_credit';
  amount: number;
  currency: string;
  status: string;
};
function money(amountMinor: number, currency: string) {
  return (amountMinor / 100).toLocaleString('en-US', {
    style: 'currency',
    currency,
  });
}
function calendarDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}
const labels: Record<string, string> = {
  pending_approval: 'Awaiting approval',
  rejected: 'Not approved',
  processing: 'Processing',
  executed: 'Completed',
  failed: 'Needs attention',
  unknown: 'Under review',
};
export function Account(props: {
  customer: DemoCustomer;
  csrfToken: string;
  requests: SupportCase[];
  requestsAvailable: boolean;
  widget?: string;
  chatUnavailable: boolean;
}) {
  const purchases = [
    props.customer.purchasePaid
      ? {
          title: props.customer.purchase?.product ?? 'Purchase',
          detail: props.customer.purchase
            ? `One-time purchase · ${money(props.customer.purchase.amountMinor, props.customer.purchase.currency)}`
            : 'Purchase details are unavailable for this historical record.',
          date: props.customer.purchase ? calendarDate(props.customer.purchase.purchasedAt) : undefined,
          state: 'Payment confirmed',
        }
      : undefined,
    props.customer.subscriptionId
      ? {
          title: props.customer.subscription?.plan ?? 'Subscription',
          detail: props.customer.subscription
            ? `${money(props.customer.subscription.amountMinor, props.customer.subscription.currency)} per ${props.customer.subscription.interval}`
            : 'Subscription details are unavailable for this historical record.',
          date: props.customer.subscription ? calendarDate(props.customer.subscription.renewsAt) : undefined,
          state: 'Active subscription',
        }
      : undefined,
  ].filter(Boolean) as Array<{
    title: string;
    detail: string;
    date?: string;
    state: string;
  }>;
  return (
    <Layout
      title="My account"
      customer={props.customer}
      csrfToken={props.csrfToken}
      widget={props.widget}
      requestsRefresh
    >
      <main class="account">
        <div class="account-header">
          <div>
            <div class="eyebrow">My account</div>
            <h1>Hello, {props.customer.name}.</h1>
            <p class="muted">Track your products and support requests.</p>
          </div>
          <a class="button primary" href="/atendimento">
            Contact support
          </a>
        </div>
        {props.chatUnavailable ? (
          <p class="notice">
            Authenticated chat is not configured in this environment yet. Come back when support is available.
          </p>
        ) : null}
        <section class="section">
          <h2>Products</h2>
          <div class="stack">
            {purchases.length ? (
              purchases.map(purchase => (
                <article class="card row">
                  <div>
                    <h3>{purchase.title}</h3>
                    <p class="muted">{purchase.detail}</p>
                    {purchase.date ? (
                      <p class="muted">
                        {purchase.state === 'Payment confirmed'
                          ? `Purchased ${purchase.date}`
                          : `Renews ${purchase.date}`}
                      </p>
                    ) : null}
                  </div>
                  <span class="status">{purchase.state}</span>
                </article>
              ))
            ) : (
              <div class="empty">No products are available for this account.</div>
            )}
          </div>
        </section>
        <section class="section">
          <h2>Requests</h2>
          <div id="financial-requests" aria-live="polite">
            <FinancialRequests requests={props.requests} requestsAvailable={props.requestsAvailable} />
          </div>
        </section>
        <section class="section">
          <article class="card">
            <h2>Address</h2>
            <p class="muted">
              To update your address for future purchases, contact support through the chat. The team will confirm your
              details and guide you through the next steps.
            </p>
          </article>
        </section>
      </main>
    </Layout>
  );
}
export function FinancialRequests(props: { requests: SupportCase[]; requestsAvailable: boolean }) {
  return (
    <div class="stack">
      {!props.requestsAvailable ? (
        <div class="empty">We could not retrieve your requests right now. Try again shortly.</div>
      ) : props.requests.length ? (
        props.requests.map(request => (
          <article class="card row">
            <div>
              <h3>{request.type === 'subscription_credit' ? 'Credit for your next invoice' : 'Refund request'}</h3>
              <p class="muted">
                {request.amount.toLocaleString('en-US', {
                  style: 'currency',
                  currency: request.currency,
                })}
                {request.type === 'subscription_credit' && request.status === 'executed'
                  ? ' · Credit available for a future invoice.'
                  : ''}
              </p>
            </div>
            <span class="status">{labels[request.status] ?? request.status}</span>
          </article>
        ))
      ) : (
        <div class="empty">There are no requests recorded for this account yet.</div>
      )}
    </div>
  );
}
