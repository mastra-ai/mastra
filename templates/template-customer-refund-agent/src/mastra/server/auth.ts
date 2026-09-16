import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { CaseMetadata } from "../domain/support-case";
import { MastraAuthProvider } from "@mastra/core/server";
import { resourceIdForOwner } from "../domain/support-case";
import { currentTrustedCaseReadScope } from "../lib/trusted-run-scope";
import { appMode, isLocalMode } from "../../../config/app-mode.mjs";

/** The local mode intentionally has only synthetic identities.  Passwords are
 * accepted only by the login route; every subsequent request uses a signed,
 * expiring server-verifiable session token. */
export type SupportRole = "customer" | "support-agent" | "approver" | "admin";
export interface SupportPrincipal {
  id: string;
  email: string;
  tenantId: string;
  roles: SupportRole[];
  expiresAt: string;
  /** Only present on a server-signed demo bridge session. This is a stable
   * Intercom contact binding, never a browser supplied authorization field. */
  intercomContactId?: string;
  stripeCustomerId?: string;
}

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const SESSION_COOKIE_NAME = "mastra-token";
const signingKey = () => {
  const value = process.env.LOCAL_AUTH_SIGNING_KEY;
  if (!value || value.length < 32)
    throw new Error(
      "LOCAL_AUTH_SIGNING_KEY must contain at least 32 characters.",
    );
  return value;
};
const seeded = [
  {
    id: "customer-alex",
    email: "alex@example.com",
    password: "local-customer-alex",
    tenantId: "local-demo",
    roles: ["customer"] as SupportRole[],
  },
  {
    id: "customer-jordan",
    email: "jordan@example.com",
    password: "local-customer-jordan",
    tenantId: "local-demo",
    roles: ["customer"] as SupportRole[],
  },
  {
    id: "support-agent-demo",
    email: "agent@local.test",
    password: "local-support-agent",
    tenantId: "local-demo",
    roles: ["support-agent"] as SupportRole[],
  },
  {
    id: "approver-demo",
    email: "approver@local.test",
    password: "local-approver",
    tenantId: "local-demo",
    roles: ["approver"] as SupportRole[],
  },
  {
    id: "admin-demo",
    email: "admin@local.test",
    password: "local-admin",
    tenantId: "local-demo",
    roles: ["admin"] as SupportRole[],
  },
  {
    id: "other-tenant-agent",
    email: "agent@other.test",
    password: "local-other-agent",
    tenantId: "other-tenant",
    roles: ["support-agent"] as SupportRole[],
  },
] as const;

function encoded(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}
function signature(payload: string) {
  return createHmac("sha256", signingKey()).update(payload).digest("base64url");
}
function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
function demoBridgeSigningKey() {
  const value = process.env.DEMO_AUTH_BRIDGE_SIGNING_KEY;
  return value && value.length >= 32 ? value : undefined;
}
/** The Hono demo keeps this signed assertion on its server and sends it only
 * to the loopback support API. It exists so the main service can retain its
 * own exact owner checks without receiving demo passwords or sessions. */
export function verifyDemoBridgeSession(
  token: string,
): SupportPrincipal | undefined {
  const signingKey = demoBridgeSigningKey();
  if (!signingKey) return undefined;
  const [payload, provided] = token.split(".");
  if (!payload || !provided) return undefined;
  const expected = createHmac("sha256", signingKey)
    .update(payload)
    .digest("base64url");
  if (!safeEqual(expected, provided)) return undefined;
  try {
    const value = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as {
      id?: string;
      email?: string;
      tenantId?: string;
      roles?: string[];
      expiresAt?: string;
      intercomContactId?: string;
      stripeCustomerId?: string;
      appMode?: string;
    };
    const expires = Date.parse(value.expiresAt ?? "");
    if (
      !value.id ||
      !value.email ||
      !value.tenantId ||
      (value.appMode !== undefined && value.appMode !== appMode()) ||
      (value.appMode === undefined && appMode() === "local") ||
      !Number.isFinite(expires) ||
      expires <= Date.now()
    )
      return undefined;
    if (value.roles?.length !== 1 || value.roles[0] !== "customer")
      return undefined;
    return {
      id: value.id,
      email: value.email,
      tenantId: value.tenantId,
      roles: ["customer"],
      expiresAt: new Date(expires).toISOString(),
      intercomContactId: value.intercomContactId,
      stripeCustomerId: value.stripeCustomerId,
    };
  } catch {
    return undefined;
  }
}

export function issueLocalSession(
  identity: Pick<SupportPrincipal, "id">,
  expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString(),
) {
  // Claims are never capability-bearing: tenant and roles are looked up from
  // the local identity registry on every request.
  const payload = encoded({
    id: identity.id,
    expiresAt,
    appMode: appMode(),
    nonce: randomUUID(),
  });
  return `${payload}.${signature(payload)}`;
}
export function verifyLocalSession(
  token: string,
): SupportPrincipal | undefined {
  const [payload, provided] = token.split(".");
  if (!payload || !provided || !safeEqual(signature(payload), provided))
    return undefined;
  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { id?: string; expiresAt?: string; appMode?: string };
    const expires = Date.parse(parsed.expiresAt ?? "");
    if (
      !parsed.id ||
      !Number.isFinite(expires) ||
      expires <= Date.now() ||
      (parsed.appMode !== undefined && parsed.appMode !== appMode()) ||
      (parsed.appMode === undefined && appMode() === "local")
    )
      return undefined;
    const identity = seeded.find((entry) => entry.id === parsed.id);
    if (!identity) return undefined;
    return {
      id: identity.id,
      email: identity.email,
      tenantId: identity.tenantId,
      roles: [...identity.roles],
      expiresAt: new Date(expires).toISOString(),
    };
  } catch {
    return undefined;
  }
}
export function authenticateSeededCredentials(email: string, password: string) {
  const identity = seeded.find(
    (entry) =>
      entry.email.toLowerCase() === email.toLowerCase() &&
      entry.password === password,
  );
  return identity ? issueLocalSession({ id: identity.id }) : undefined;
}
export function ownerIdForCustomer(tenantId: string, email: string) {
  return seeded.find(
    (entry) =>
      entry.tenantId === tenantId &&
      entry.roles.includes("customer") &&
      entry.email.toLowerCase() === email.toLowerCase(),
  )?.id;
}
export function activePrincipalHasRole(
  id: string,
  tenantId: string,
  role: SupportRole,
) {
  return seeded.some(
    (entry) =>
      entry.id === id &&
      entry.tenantId === tenantId &&
      entry.roles.includes(role),
  );
}
export function principalFromHeaders(
  headers: Headers,
): SupportPrincipal | undefined {
  const value = headers.get("authorization");
  if (!value?.startsWith("Bearer ")) return undefined;
  const token = value.slice("Bearer ".length);
  return verifyLocalSession(token) ?? verifyDemoBridgeSession(token);
}

function sessionFromCookie(headers: Headers) {
  const cookie = headers.get("cookie");
  if (!cookie) return undefined;
  const token = cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(`${SESSION_COOKIE_NAME}=`))
    ?.slice(`${SESSION_COOKIE_NAME}=`.length);
  return token ? verifyLocalSession(token) : undefined;
}

/**
 * Built-in Studio sends credentials with cookies. Custom support routes keep
 * using principalFromHeaders(), so they remain explicit-Bearer APIs.
 * An Authorization header always wins, including when it is invalid: callers
 * cannot turn a bad Bearer credential into a cookie fallback.
 */
export function studioPrincipalFromHeaders(
  headers: Headers,
  token?: string,
): SupportPrincipal | undefined {
  if (headers.has("authorization")) return principalFromHeaders(headers);
  if (token?.trim())
    return verifyLocalSession(token.replace(/^Bearer\s+/i, ""));
  return sessionFromCookie(headers);
}

function hasSessionCookie(headers: Headers) {
  return headers
    .get("cookie")
    ?.split(";")
    .some((value) => value.trim().startsWith(`${SESSION_COOKIE_NAME}=`));
}

/** Reject a supplied foreign Origin for cookie-backed mutations. Missing
 * Origin remains usable for non-browser local tooling; Bearer requests retain
 * their existing API semantics. Credential login/logout receive the same
 * browser protection even before a session cookie exists. */
export function isForeignCookieMutation(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase()))
    return false;
  if (request.headers.has("authorization")) return false;
  const path = new URL(request.url).pathname;
  const isCredentialEndpoint =
    path === "/api/auth/credentials/sign-in" || path === "/api/auth/logout";
  if (!hasSessionCookie(request.headers) && !isCredentialEndpoint) return false;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin !== new URL(request.url).origin;
  } catch {
    return true;
  }
}

function sessionCookie(token: string, request: Request) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=${SESSION_TTL_MS / 1000}${secure}`;
}

function foreignOriginError() {
  return Object.assign(new Error("Cross-origin cookie mutation denied."), {
    status: 403,
  });
}
export function canAccessCase(
  principal: SupportPrincipal,
  supportCase: {
    customer: { email: string };
    metadata: CaseMetadata;
  },
) {
  const binding = supportCase.metadata.providerBinding;
  if (binding?.tenantId !== principal.tenantId) return false;
  if (
    principal.roles.some(
      (role) =>
        role === "admin" || role === "support-agent" || role === "approver",
    )
  )
    return true;
  return (
    supportCase.metadata.ownerId === principal.id ||
    (principal.intercomContactId !== undefined &&
      supportCase.metadata.ownerId ===
        `intercom:${principal.tenantId}:contact:${principal.intercomContactId}`)
  );
}
export function hasRole(principal: SupportPrincipal, role: SupportRole) {
  return principal.roles.includes(role);
}

/**
 * The generated Mastra CLI sets both values only for its child `dev` process.
 * Requiring the pair prevents a manually supplied development flag from
 * disabling authentication on a `start` or deployed server.
 */
export function isLocalStudioDevMode() {
  return (
    isLocalMode() &&
    process.env.MASTRA_DEV === "true" &&
    process.env.MASTRA_TELEMETRY_COMMAND === "dev"
  );
}

/** The bounded principal used only by the loopback development Studio. */
export function localDemoStudioPrincipal(): SupportPrincipal {
  const identity = seeded.find((entry) => entry.id === "support-agent-demo");
  if (!identity)
    throw new Error("The local Studio principal is not configured.");
  return {
    id: identity.id,
    email: identity.email,
    tenantId: identity.tenantId,
    roles: [...identity.roles],
    // This principal is process-local and never serialized into a session.
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  };
}

/**
 * A proxied request can reach a loopback listener, so URL loopback is a
 * necessary but insufficient signal. Forwarding headers and a non-loopback
 * Host are denial signals only; they never establish local authority.
 */
export function isDirectCanonicalLoopbackRequest(request: Request) {
  const hostname = new URL(request.url).hostname.toLowerCase();
  if (!new Set(["localhost", "127.0.0.1", "::1"]).has(hostname)) return false;
  const host = request.headers.get("host");
  if (host) {
    try {
      const parsed = new URL(`http://${host}`).hostname.toLowerCase();
      if (!new Set(["localhost", "127.0.0.1", "::1"]).has(parsed)) return false;
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

/**
 * Resolves Studio identity without allowing a stale cookie to affect local
 * development. An explicit Authorization header always remains authoritative:
 * invalid, customer, approver, and foreign-tenant tokens cannot fall back to
 * the demo principal.
 */
export function studioPrincipalForRequest(request: Request) {
  if (
    isLocalStudioDevMode() &&
    !request.headers.has("authorization") &&
    isDirectCanonicalLoopbackRequest(request)
  )
    return localDemoStudioPrincipal();
  return studioPrincipalFromHeaders(request.headers);
}

export type BuiltInStudioRequest = {
  method: string;
  path: string;
};

const nativeSupervisorRoute =
  /^\/(?:api\/)?agents\/support-supervisor\/(?:generate|stream|send-message|signals|threads\/subscribe)$/;
const scopedStudioMemoryRoute = (path: string, method: string) =>
  (method === "GET" &&
    /^\/(?:api\/)?memory\/(?:status|config|threads(?:\/[^/]+(?:\/messages)?)?)$/.test(
      path,
    )) ||
  (method === "POST" && /^\/(?:api\/)?memory\/threads$/.test(path));

/**
 * The Studio-only allowlist is deliberately data-free: middleware supplies
 * tenant and case scope before the framework handlers read memory or history.
 * Keeping it pure lets the configured auth provider and login-free local mode
 * enforce exactly the same registry and execution boundary.
 */
export function canAccessBuiltInStudioRoute(
  user: SupportPrincipal,
  request: BuiltInStudioRequest,
) {
  const expires = Date.parse(user.expiresAt);
  if (!Number.isFinite(expires) || expires <= Date.now()) return false;
  const method = request.method.toUpperCase();
  const { path } = request;
  const isLocalStaff =
    user.tenantId === "local-demo" &&
    user.roles.some((role) => role === "support-agent" || role === "admin");
  if (!isLocalStaff) return false;
  if (method === "POST" && nativeSupervisorRoute.test(path)) return true;
  if (scopedStudioMemoryRoute(path, method)) return true;
  if (
    method === "GET" &&
    /^\/(?:api\/)?workflows\/(?:ingestSupportCaseWorkflow|resolveSupportCaseWorkflow|indexSupportKnowledgeWorkflow|ingest-support-case|resolve-support-case|index-support-knowledge)\/runs(?:\/[^/]+)?$/.test(
      path,
    )
  )
    return true;
  const studioChromeMetadata = new Set([
    "/api/agents/providers",
    "/api/editor/builder/settings",
    "/api/editor/builder/models/available",
    "/api/system/packages",
    "/api/scores/scorers",
  ]);
  if (method === "GET" && studioChromeMetadata.has(path)) return true;
  const studioRegistryIds = {
    agents: new Set([
      "triage-agent",
      "response-agent",
      "support-supervisor",
      "refund-execution-agent",
    ]),
    tools: new Set([
      "search_support_knowledge",
      "lookup_order",
      "lookup_subscription",
      "lookup_customer_refund_history",
      "issue_refund",
      "issue_subscription_credit",
      "schedule_subscription_cancellation",
    ]),
    workflows: new Set([
      "ingestSupportCaseWorkflow",
      "resolveSupportCaseWorkflow",
      "indexSupportKnowledgeWorkflow",
      "ingest-support-case",
      "resolve-support-case",
      "index-support-knowledge",
    ]),
  };
  const metadataRoute = path.match(
    /^(?:\/api)?\/(agents|tools|workflows)(?:\/([^/]+))?$/,
  );
  return (
    method === "GET" &&
    metadataRoute !== null &&
    (metadataRoute[2] === undefined ||
      studioRegistryIds[metadataRoute[1] as keyof typeof studioRegistryIds].has(
        metadataRoute[2],
      ))
  );
}

export class LocalSupportAuthProvider extends MastraAuthProvider<SupportPrincipal> {
  constructor() {
    super({
      name: "local-support-auth",
      protected: ["/*"],
      public: [
        "/health",
        "/support/auth/login",
        "/support/webhooks/intercom",
        "/support/webhooks/stripe",
      ],
    });
  }
  async authenticateToken(token: string, request: { headers: Headers }) {
    return studioPrincipalFromHeaders(request.headers, token) ?? null;
  }
  async signIn(email: string, password: string, request: Request) {
    // Framework-public credential routes intentionally bypass server middleware,
    // so this provider performs the same Origin check before issuing a cookie.
    if (isForeignCookieMutation(request)) throw foreignOriginError();
    const token = authenticateSeededCredentials(email, password);
    const user = token ? verifyLocalSession(token) : undefined;
    if (!token || !user) throw new Error("Invalid local credentials.");
    return { user, token, cookies: [sessionCookie(token, request)] };
  }
  async getCurrentUser(request: Request) {
    return studioPrincipalFromHeaders(request.headers) ?? null;
  }
  getClearSessionHeaders() {
    return {
      "Set-Cookie": `${SESSION_COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0`,
    };
  }
  getLogoutUrl(_redirectUri: string, request?: Request) {
    // Logout is also framework-public. Throwing a status-bearing error prevents
    // its handler from clearing a same-site session after a foreign POST.
    if (request && isForeignCookieMutation(request)) throw foreignOriginError();
    return null;
  }
  isSignUpEnabled() {
    return false;
  }
  async authorizeUser(user: SupportPrincipal, request: unknown) {
    const rawRequest =
      typeof request === "object" && request !== null && "raw" in request
        ? request.raw
        : request;
    const requestUrl =
      typeof rawRequest === "object" &&
      rawRequest !== null &&
      "url" in rawRequest
        ? String(rawRequest.url)
        : "/";
    const path = new URL(requestUrl, "http://local").pathname;
    // Custom support routes enforce their own tenant/owner checks and remain
    // explicit-Bearer APIs; Studio's cookie session has no authority there.
    const requestHeaders =
      typeof rawRequest === "object" &&
      rawRequest !== null &&
      "headers" in rawRequest &&
      rawRequest.headers instanceof Headers
        ? rawRequest.headers
        : undefined;
    if (path.startsWith("/support/")) {
      const bearerPrincipal = requestHeaders
        ? principalFromHeaders(requestHeaders)
        : undefined;
      return bearerPrincipal?.id === user.id;
    }
    const method =
      typeof rawRequest === "object" &&
      rawRequest !== null &&
      "method" in rawRequest
        ? String(rawRequest.method).toUpperCase()
        : "GET";
    return canAccessBuiltInStudioRoute(user, { method, path });
  }
  mapUserToResourceId(user: SupportPrincipal) {
    const studioScope = currentTrustedCaseReadScope();
    if (studioScope && studioScope.tenantId === user.tenantId)
      return resourceIdForOwner(studioScope.ownerId, studioScope.tenantId);
    return resourceIdForOwner(user.id, user.tenantId);
  }
}
