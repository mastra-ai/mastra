import { serve } from "@hono/node-server";
import { timingSafeEqual } from "node:crypto";
import { readFile } from "node:fs/promises";
import { Hono, type Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { Landing, Login, Account, FinancialRequests } from "./views.js";
import {
  createSession,
  databaseUrl,
  deleteSession,
  ensureDatabaseDirectory,
  initializeDatabase,
  openDatabase,
  sessionById,
  verifyCustomer,
} from "./db.js";
import { issueBackendBridge, issueMessengerJwt } from "./bridge.js";
import { isLocalMode } from "../../config/app-mode.mjs";
import { localChatWidget } from "./local-chat-widget.js";

const cookieName = () =>
  isLocalMode() ? "northstar_local_session" : "northstar_session";
const identityKey = "northstar:customer-id";
const maxWebhookBytes = 256 * 1024;
const app = new Hono();
const configuredDatabaseUrl = databaseUrl();
// libSQL opens its file lazily today, but create the configured parent before
// creating the client so a future eager driver cannot break a clean seed/run.
await ensureDatabaseDirectory(configuredDatabaseUrl);
const client = openDatabase(configuredDatabaseUrl);
const styles = await readFile(new URL("./styles.css", import.meta.url), "utf8");
const backend = () =>
  (
    (isLocalMode()
      ? process.env.LOCAL_DEMO_BACKEND_URL
      : process.env.SUPPORT_BACKEND_URL) ?? "http://127.0.0.1:4111"
  ).replace(/\/$/, "");
const safeNext = () => "/conta";
const canonicalLoopbackHosts = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
]);

/** A local listener can still receive a DNS-rebound request. The request URL
 * and Host must both be canonical loopback values, and proxy metadata is a
 * denial signal because it cannot establish local authority. */
function isDirectCanonicalLoopbackRequest(request: Request) {
  const hostname = new URL(request.url).hostname.toLowerCase();
  if (!canonicalLoopbackHosts.has(hostname)) return false;
  const host = request.headers.get("host");
  if (host) {
    try {
      if (
        !canonicalLoopbackHosts.has(
          new URL(`http://${host}`).hostname.toLowerCase(),
        )
      )
        return false;
    } catch {
      return false;
    }
  }
  return ![...request.headers.keys()].some(
    (name) =>
      name === "forwarded" ||
      name === "via" ||
      name === "x-real-ip" ||
      name === "x-client-ip" ||
      name.startsWith("x-forwarded-") ||
      name.startsWith("x-proxy-"),
  );
}
function expiredPage() {
  return `try{localStorage.removeItem(${JSON.stringify(identityKey)})}catch(_){ }window.Intercom&&window.Intercom('shutdown');window.location.assign('/entrar');`;
}
async function current(c: { req: { raw: Request } }) {
  return sessionById(client, getCookie(c as never, cookieName()));
}
function originAllowed(request: Request) {
  const origin = request.headers.get("origin");
  const configured = isLocalMode() ? undefined : process.env.DEMO_PUBLIC_ORIGIN;
  const expected = configured
    ? new URL(configured).origin
    : new URL(request.url).origin;
  return !origin || origin === expected;
}
function secureCookies(request: Request) {
  return (
    !isLocalMode() &&
    (process.env.DEMO_PUBLIC_ORIGIN ?? request.url).startsWith("https:")
  );
}
function sameToken(actual: string, expected: string) {
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
function noStore(c: Context) {
  c.header("Cache-Control", "no-store");
  c.header("Pragma", "no-cache");
}
app.use("*", async (c, next) => {
  if (isLocalMode() && !isDirectCanonicalLoopbackRequest(c.req.raw))
    return c.text("Local demo requests require direct loopback.", 403);
  await next();
});
function scriptValue(value: unknown) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
function widget(
  customer: Parameters<typeof issueMessengerJwt>[0],
  expiresAt: string,
  openChat: boolean,
) {
  if (isLocalMode()) return localChatWidget(openChat, customer.id);
  const appId = process.env.INTERCOM_APP_ID;
  const jwt = issueMessengerJwt(customer, expiresAt);
  if (!appId || !jwt) return undefined;
  const settings = scriptValue({
    app_id: appId,
    user_id: customer.id,
    intercom_user_jwt: jwt,
    language_override: "en",
  });
  const identity = scriptValue(customer.id);
  const expiry = scriptValue(expiresAt);
  return `(function(){var key=${scriptValue(identityKey)},identity=${identity},expiresAt=${expiry},openChat=${scriptValue(openChat)},closed=false;function shutdown(){if(closed)return;closed=true;window.Intercom&&window.Intercom('shutdown');location.assign('/entrar')}try{var previous=localStorage.getItem(key);if(previous&&previous!==identity){window.Intercom&&window.Intercom('shutdown')}localStorage.setItem(key,identity)}catch(_){ }window.addEventListener('storage',function(event){if(event.key===key&&event.newValue!==identity)shutdown()});window.intercomSettings=${settings};var w=window;if(typeof w.Intercom==='function'){w.Intercom('boot',w.intercomSettings);if(openChat)w.Intercom('show')}else{var d=document,i=function(){i.c(arguments)};i.q=[];i.c=function(a){i.q.push(a)};w.Intercom=i;w.Intercom('boot',w.intercomSettings);if(openChat)w.Intercom('show');var l=function(){var s=d.createElement('script');s.async=true;s.src='https://widget.intercom.io/widget/'+encodeURIComponent(w.intercomSettings.app_id);d.head.appendChild(s)};if(d.readyState==='complete')l();else w.addEventListener('load',l)}var check=function(){fetch('/sessao',{credentials:'same-origin',cache:'no-store',headers:{'Cache-Control':'no-store'}}).then(function(r){if(!r.ok)shutdown()}).catch(function(){})};window.addEventListener('visibilitychange',function(){if(!document.hidden)check()});var remaining=Date.parse(expiresAt)-Date.now();window.setTimeout(shutdown,Math.max(0,remaining));window.setInterval(check,15000)})();`;
}
async function financialRequestsFor(
  customer: Parameters<typeof issueBackendBridge>[0],
  expiresAt: string,
): Promise<{
  available: boolean;
  requests: Array<{
    caseId: string;
    turnId: string;
    type: "refund" | "subscription_credit";
    amount: number;
    currency: string;
    status: string;
    requestedAt: string;
  }>;
}> {
  const token = issueBackendBridge(customer, expiresAt);
  if (!token) return { available: false, requests: [] };
  try {
    const response = await fetch(
      `${backend()}/support/customer/financial-requests`,
      {
        headers: { authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(3_000),
      },
    );
    if (!response.ok) return { available: false, requests: [] };
    const data = (await response.json()) as { requests?: unknown };
    return {
      available: Array.isArray(data.requests),
      requests: Array.isArray(data.requests)
        ? (data.requests as Array<{
            caseId: string;
            turnId: string;
            type: "refund" | "subscription_credit";
            amount: number;
            currency: string;
            status: string;
            requestedAt: string;
          }>)
        : [],
    };
  } catch {
    return { available: false, requests: [] };
  }
}
app.get("/", (c) => c.html(<Landing />));
app.get("/styles.css", (c) =>
  c.body(styles, 200, { "content-type": "text/css; charset=utf-8" }),
);
app.get("/atendimento", async (c) => {
  const session = await current(c);
  if (!session) return c.redirect("/entrar?next=/conta");
  noStore(c);
  return c.redirect("/conta?chat=open", 303);
});
app.get("/entrar", (c) => c.html(<Login next={safeNext()} />));
app.post("/entrar", async (c) => {
  if (!originAllowed(c.req.raw)) return c.text("Origin is not allowed.", 403);
  const form = await c.req.parseBody();
  const customer = await verifyCustomer(
    client,
    String(form.email ?? ""),
    String(form.password ?? ""),
  );
  const next = safeNext();
  if (!customer)
    return c.html(
      <Login error="Invalid email or password." next={next} />,
      401,
    );
  const session = await createSession(client, customer);
  noStore(c);
  setCookie(c, cookieName(), session.id, {
    httpOnly: true,
    sameSite: "Strict",
    secure: secureCookies(c.req.raw),
    path: "/",
    maxAge: 8 * 60 * 60,
  });
  return c.redirect(next, 303);
});
app.get("/sessao", async (c) => {
  noStore(c);
  const session = await current(c);
  return session
    ? c.json({ expiresAt: session.expiresAt, customerId: session.customer.id })
    : c.text("Session expired.", 401);
});
app.get("/solicitacoes", async (c) => {
  const session = await current(c);
  noStore(c);
  if (!session) return c.text("Session expired.", 401);
  const projection = await financialRequestsFor(
    session.customer,
    session.expiresAt,
  );
  return c.html(
    <FinancialRequests
      requests={projection.requests}
      requestsAvailable={projection.available}
    />,
  );
});
app.get("/chat/history", async (c) => {
  if (!isLocalMode()) return c.notFound();
  const session = await current(c);
  noStore(c);
  if (!session) return c.json({ error: "Session expired." }, 401);
  const token = issueBackendBridge(session.customer, session.expiresAt);
  if (!token) return c.json({ error: "Chat is unavailable." }, 503);
  let data: {
    cases?: Array<{
      externalId?: string;
      status?: string;
      updatedAt?: string;
      messages?: Array<{ author: string; body: string; createdAt: string }>;
    }>;
  };
  try {
    const response = await fetch(`${backend()}/support/cases`, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok)
      return c.json({ error: "Chat history is unavailable." }, 502);
    data = await response.json();
  } catch {
    return c.json({ error: "Chat history is temporarily unavailable." }, 503);
  }
  const conversation = `chat:${session.customer.id}`;
  const matching = (data.cases ?? [])
    .filter((item) => item.externalId?.startsWith(`${conversation}:`))
    .sort((left, right) =>
      String(left.updatedAt ?? "").localeCompare(String(right.updatedAt ?? "")),
    );
  const active = matching.at(-1);
  return c.json({
    customerId: session.customer.id,
    status: active?.status,
    messages: matching
      .flatMap((item) => item.messages ?? [])
      .filter(
        (message) =>
          message.author === "customer" || message.author === "agent",
      )
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .slice(-100),
  });
});
app.post("/chat/messages", async (c) => {
  if (!isLocalMode()) return c.notFound();
  if (!originAllowed(c.req.raw))
    return c.json({ error: "Origin is not allowed." }, 403);
  const session = await current(c);
  const raw = await limitedBody(c.req.raw, 16 * 1024);
  let body: { body?: unknown; eventId?: unknown } | undefined;
  try {
    body = raw ? JSON.parse(new TextDecoder().decode(raw)) : undefined;
  } catch {}
  if (
    !session ||
    !body ||
    typeof body.body !== "string" ||
    typeof body.eventId !== "string" ||
    !sameToken(c.req.header("x-csrf-token") ?? "", session.csrfToken)
  )
    return c.json({ error: "Session or CSRF protection is invalid." }, 403);
  if (
    !body.body.trim() ||
    body.body.length > 10_000 ||
    !/^[A-Za-z0-9_-]{16,200}$/.test(body.eventId)
  )
    return c.json({ error: "Invalid chat message." }, 400);
  const token = issueBackendBridge(session.customer, session.expiresAt);
  if (!token) return c.json({ error: "Chat is unavailable." }, 503);
  try {
    const response = await fetch(`${backend()}/support/inbound`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        externalId: `chat:${session.customer.id}:${body.eventId}`,
        conversationId: `chat:${session.customer.id}`,
        from: session.customer.email,
        fromName: session.customer.name,
        subject: "Customer chat",
        body: body.body.trim(),
        receivedAt: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const data = await response
      .json()
      .catch(() => ({ error: "Chat delivery failed." }));
    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  } catch {
    return c.json(
      { error: "Support is temporarily unavailable. Retry this message." },
      503,
    );
  }
});
app.post("/sair", async (c) => {
  if (!originAllowed(c.req.raw)) return c.text("Origin is not allowed.", 403);
  const id = getCookie(c, cookieName());
  const session = await sessionById(client, id);
  const form = await c.req.parseBody();
  if (
    !session ||
    typeof form.csrf !== "string" ||
    !sameToken(form.csrf, session.csrfToken)
  )
    return c.text("Session or CSRF protection is invalid.", 403);
  await deleteSession(client, id);
  noStore(c);
  setCookie(c, cookieName(), "", {
    httpOnly: true,
    sameSite: "Strict",
    path: "/",
    maxAge: 0,
  });
  return c.html(
    <html>
      <body>
        <script dangerouslySetInnerHTML={{ __html: expiredPage() }} />
      </body>
    </html>,
  );
});
app.get("/conta", async (c) => {
  const session = await current(c);
  if (!session) return c.redirect("/entrar?next=/conta");
  noStore(c);
  const chat = widget(
    session.customer,
    session.expiresAt,
    c.req.query("chat") === "open",
  );
  const projection = await financialRequestsFor(
    session.customer,
    session.expiresAt,
  );
  return c.html(
    <Account
      customer={session.customer}
      csrfToken={session.csrfToken}
      requests={projection.requests}
      requestsAvailable={projection.available}
      widget={chat}
      chatUnavailable={!chat}
    />,
  );
});
async function forwardWebhook(c: Context) {
  const url = new URL(c.req.url);
  const destination = `${backend()}${url.pathname}`;
  const declared = Number(c.req.header("content-length"));
  if (Number.isFinite(declared) && declared > maxWebhookBytes)
    return c.text("Webhook exceeds the accepted limit.", 413);
  const body = await limitedBody(c.req.raw, maxWebhookBytes);
  if (!body) return c.text("Webhook exceeds the accepted limit.", 413);
  const headers = new Headers();
  for (const name of [
    "content-type",
    "intercom-signature",
    "x-hub-signature",
    "stripe-signature",
    "user-agent",
  ]) {
    const value = c.req.header(name);
    if (value) headers.set(name, value);
  }
  const response = await fetch(destination, {
    method: "POST",
    headers,
    body,
    signal: AbortSignal.timeout(10_000),
  });
  return new Response(response.body, {
    status: response.status,
    headers: new Headers(response.headers),
  });
}
async function limitedBody(request: Request, maximum: number) {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maximum) {
        await reader.cancel();
        return undefined;
      }
      chunks.push(chunk.value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}
app.post("/support/webhooks/intercom", forwardWebhook);
app.post("/support/webhooks/stripe", forwardWebhook);
export { app, client };
if (process.env.VITEST !== "true") {
  await initializeDatabase(client);
  serve({
    fetch: app.fetch,
    hostname: "127.0.0.1",
    port: Number(process.env.DEMO_PORT ?? "3000"),
  });
}
