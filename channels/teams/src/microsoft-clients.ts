import { DEV_PORTAL_BASE_URL, GRAPH_API_BASE_URL, LOGIN_BASE_URL } from './types';

/**
 * Thin fetch wrappers for the two Microsoft control planes the provider
 * provisions through — Microsoft Graph (Entra applications) and the Teams
 * Developer Portal (Bot Framework registrations) — plus a credential
 * validation helper against the Microsoft login endpoint.
 *
 * All calls are plain `fetch` with a 15s timeout so tests can intercept them
 * with undici's `MockAgent` (same pattern as `@mastra/telegram`'s client).
 */

const REQUEST_TIMEOUT_MS = 15_000;

async function request(
  url: string,
  init: RequestInit & { headers: Record<string, string> },
  label: string,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (cause) {
    throw Object.assign(new Error(`${label} request failed`, { cause }), { isTransportError: true });
  }
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`${label} failed: HTTP ${response.status}${body ? ` — ${truncate(body)}` : ''}`);
  }
  return response;
}

function truncate(text: string, max = 300): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function authJson(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}

// =============================================================================
// Microsoft Graph — Entra application provisioning
// =============================================================================

/** The subset of a Graph `application` resource the provider uses. */
export interface EntraApplication {
  /** Directory **object id** — used for subsequent Graph calls (addPassword, delete). */
  id: string;
  /** The application (client) id — the bot's Microsoft App ID. */
  appId: string;
}

/**
 * Create an Entra application for a per-agent bot.
 * @see https://learn.microsoft.com/graph/api/application-post-applications
 */
export async function createApplication(
  token: string,
  options: { displayName: string; signInAudience: 'AzureADMultipleOrgs' | 'AzureADMyOrg' },
  graphBaseUrl: string = GRAPH_API_BASE_URL,
): Promise<EntraApplication> {
  const response = await request(
    `${graphBaseUrl}/v1.0/applications`,
    {
      method: 'POST',
      headers: authJson(token),
      body: JSON.stringify({ displayName: options.displayName, signInAudience: options.signInAudience }),
    },
    'Graph application create',
  );
  const body = (await response.json()) as Partial<EntraApplication>;
  if (!body.id || !body.appId) {
    throw new Error('Graph application create returned an unexpected payload (missing id/appId)');
  }
  return { id: body.id, appId: body.appId };
}

/**
 * Mint a client secret on an Entra application. The secret text is only
 * returned by this call — it cannot be read back later.
 * @see https://learn.microsoft.com/graph/api/application-addpassword
 */
export async function addApplicationPassword(
  token: string,
  applicationObjectId: string,
  displayName: string,
  graphBaseUrl: string = GRAPH_API_BASE_URL,
): Promise<string> {
  const response = await request(
    `${graphBaseUrl}/v1.0/applications/${encodeURIComponent(applicationObjectId)}/addPassword`,
    {
      method: 'POST',
      headers: authJson(token),
      body: JSON.stringify({ passwordCredential: { displayName } }),
    },
    'Graph addPassword',
  );
  const body = (await response.json()) as { secretText?: string };
  if (!body.secretText) {
    throw new Error('Graph addPassword returned an unexpected payload (missing secretText)');
  }
  return body.secretText;
}

/**
 * Delete an Entra application. Used to clean up provisioned bots on
 * disconnect and to roll back a partially provisioned connect.
 * @see https://learn.microsoft.com/graph/api/application-delete
 */
export async function deleteApplication(
  token: string,
  applicationObjectId: string,
  graphBaseUrl: string = GRAPH_API_BASE_URL,
): Promise<void> {
  await request(
    `${graphBaseUrl}/v1.0/applications/${encodeURIComponent(applicationObjectId)}`,
    { method: 'DELETE', headers: { authorization: `Bearer ${token}` } },
    'Graph application delete',
  );
}

// =============================================================================
// Teams Developer Portal — Bot Framework registrations
// =============================================================================

/**
 * A Teams Developer Portal bot registration, as accepted by
 * `POST https://dev.teams.microsoft.com/api/botframework` (the same contract
 * Microsoft's Teams Toolkit CLI uses).
 */
export interface TeamsBotRegistration {
  /** The bot's Microsoft App (client) ID. */
  botId: string;
  name: string;
  description: string;
  iconUrl: string;
  messagingEndpoint: string;
  callingEndpoint: string;
}

/** Register a bot with the Teams Developer Portal. */
export async function createBotRegistration(
  token: string,
  registration: TeamsBotRegistration,
  devPortalBaseUrl: string = DEV_PORTAL_BASE_URL,
): Promise<void> {
  await request(
    `${devPortalBaseUrl}/api/botframework`,
    { method: 'POST', headers: authJson(token), body: JSON.stringify(registration) },
    'Dev Portal bot registration',
  );
}

/** Delete a Teams Developer Portal bot registration. */
export async function deleteBotRegistration(
  token: string,
  botId: string,
  devPortalBaseUrl: string = DEV_PORTAL_BASE_URL,
): Promise<void> {
  await request(
    `${devPortalBaseUrl}/api/botframework/${encodeURIComponent(botId)}`,
    { method: 'DELETE', headers: { authorization: `Bearer ${token}` } },
    'Dev Portal bot deletion',
  );
}

// =============================================================================
// Credential validation — Bot Framework client-credentials mint
// =============================================================================

/**
 * Validate a bot's `appId`/`appPassword` by minting a Bot Framework token via
 * the OAuth2 client-credentials grant — the same exchange the adapter performs
 * at runtime, so a success here means outbound sends will authenticate.
 * Multi-tenant bots exchange against the `botframework.com` tenant.
 *
 * Throws when Microsoft rejects the credentials; transport failures are
 * surfaced as-is (tagged `isTransportError`) so callers can tell connectivity
 * problems apart from bad credentials.
 */
export async function validateBotCredentials(
  options: { appId: string; appPassword: string; appTenantId?: string },
  loginBaseUrl: string = LOGIN_BASE_URL,
): Promise<void> {
  // Encoded: appTenantId can come from connect() options via the editor UI —
  // a value containing `/`, `?` or `#` must not redirect the secret elsewhere.
  const tenant = encodeURIComponent(options.appTenantId ?? 'botframework.com');
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: options.appId,
    client_secret: options.appPassword,
    scope: 'https://api.botframework.com/.default',
  });
  let response: Response;
  try {
    response = await fetch(`${loginBaseUrl}/${tenant}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (cause) {
    throw Object.assign(new Error('Bot credential validation request failed', { cause }), {
      isTransportError: true,
    });
  }
  if (!response.ok) {
    const detail = (await response.json().catch(() => null)) as { error_description?: string; error?: string } | null;
    throw new Error(
      `Microsoft rejected the bot credentials: ${detail?.error_description ?? detail?.error ?? `HTTP ${response.status}`}`,
    );
  }
}
