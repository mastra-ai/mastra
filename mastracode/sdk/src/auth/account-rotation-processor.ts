/**
 * Error-driven rotation across a provider's OAuth account registry.
 *
 * When the active account cannot serve a request (rate limit, quota
 * exhaustion, dead token, persistent outage), the next account in insertion
 * order is selected for the request and the request retried. OAuth fetch
 * wrappers read that request-scoped selection on every HTTP attempt, so
 * concurrent runs can't swap each other's credentials. Every switch is
 * persisted as a non-transient `data-mastracode-account-switch` part so it
 * shows in the transcript and survives history reload.
 *
 * Two classes, two lanes — the split is load-bearing. The processor runner
 * walks `[...inputProcessors, ...outputProcessors, ...errorProcessors]` when
 * running `processAPIError`, so a processor registered in the input lane that
 * also implemented `processAPIError` would run BEFORE
 * `StreamErrorRetryProcessor` and hop on 5xx errors before transient retries
 * had a chance. `AccountRotationProcessor` therefore implements
 * `processAPIError` only and is registered in `errorProcessors` after
 * `StreamErrorRetryProcessor`; `AccountStartNoticeProcessor` implements
 * `processInput` only and is registered in `inputProcessors`.
 */
import { TripWire } from '@mastra/core/agent';
import type { ProcessAPIErrorArgs, ProcessInputArgs, ProcessInputResult, Processor } from '@mastra/core/processors';

import { resolveCredentialStore } from '../agents/credential-resolver.js';
import { resolveModel, resolveRequestThinkingLevel } from '../agents/model.js';
import {
  getRequestAccountSelection,
  isRequestAccountRoutingExhausted,
  markRequestAccountRoutingExhausted,
  setRequestAccountSelection,
} from './account-routing-context.js';
import { ProviderAuthRequiredError, PROVIDER_AUTH_REQUIRED_ERROR } from './provider-auth-error.js';
import { getOAuthProviders } from './storage.js';
import type { CredentialStore, OAuthAccountRecord } from './types.js';

export const ACCOUNT_SWITCH_PART_TYPE = 'data-mastracode-account-switch';

/** Labels and instance ids only — never token material (do-not list). */
export interface AccountSwitchPartData {
  provider: string;
  from: { id: string; label: string } | null;
  to: { id: string; label: string } | null;
  reason:
    | 'rate-limit'
    | 'quota-exhausted'
    | 'auth-failed'
    | 'pool-exhausted'
    | 'persistent-outage'
    | 'preferred-routing'
    | 'starting-on-account';
  at: string;
  /**
   * Set on a `to: null` part when a route pinned to a single account reported
   * that account unusable. The provider's other subscriptions were never
   * consulted (A12), so "all accounts unavailable" would misreport what
   * happened.
   */
  exclusive?: boolean;
}

/** The store surface rotation needs; `AuthStorage` satisfies it structurally. */
export type RotationCredentialStore = CredentialStore & {
  /**
   * Force one refresh of the active account's tokens regardless of expiry
   * (401/403 path — a rejected-but-unexpired token usually means clock skew
   * or a refresh race). `AuthStorage` provides it; deployed per-tenant stores
   * don't, and the auth path degrades to plain rotation (which itself no-ops
   * without registry methods).
   */
  forceRefreshActiveAccount?(providerId: string, accountInstanceId?: string): Promise<string | undefined>;
};

/** Rotatable providers = the OAuth provider registry; API-key-only providers never rotate. */
const KNOWN_PROVIDER_IDS = new Set(getOAuthProviders().map(provider => provider.id));

/** Hostname suffixes → provider ids, for `APICallError.url`. */
const PROVIDER_HOST_PATTERNS: Array<[RegExp, string]> = [
  [/(^|\.)api\.anthropic\.com$/i, 'anthropic'],
  [/(^|\.)api\.kimi\.com$/i, 'kimi-for-coding'],
  [/(^|\.)api\.x\.ai$/i, 'xai'],
  [/(^|\.)chatgpt\.com$/i, 'openai-codex'],
  [/(^|\.)backend-api\.codex\.ai$/i, 'openai-codex'],
  [/(^|\.)githubcopilot\.com$/i, 'github-copilot'],
  [/(^|\.)api\.github\.com$/i, 'github-copilot'],
];

/**
 * Provider usage/quota-limit wording (locked Q7 bucket 1). Statuses 429/402
 * are matched before this; some providers deliver quota errors as plain 400s,
 * which only the message reveals. Deliberately restricted to unambiguous
 * quota phrases — a generic "exceeded your … limit" can appear on non-quota
 * client errors (request size, context length) that must never rotate.
 */
const USAGE_LIMIT_MESSAGE_PATTERN =
  /usage (?:limit|cap)|insufficient[_ ]quota|quota (?:exceeded|exhausted|reached)|exceeded (?:your )?current quota|insufficient (?:balance|credits?)|credits? exhausted|rate limit (?:exceeded|reached)|weekly limit|monthly limit/i;

const NETWORK_ERROR_CODES = new Set([
  'ECONNRESET',
  'EPIPE',
  'ECONNREFUSED',
  'ENOTFOUND',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET',
]);

const NETWORK_MESSAGE_PATTERN =
  /fetch failed|network error|socket hang up|getaddrinfo|econnrefused|enotfound|etimedout|connection (?:refused|reset|closed|timed out)|other side closed|write epipe/i;

const MAX_CAUSE_DEPTH = 4;

/** Persisted data-part type for a model-route hop. */
export const MODEL_FALLBACK_PART_TYPE = 'data-mastracode-model-fallback' as const;

/** Non-secret transcript payload for a model-route hop. */
export interface ModelFallbackPartData {
  from: { entryId: string; label: string };
  to: { entryId: string; label: string };
  reason: 'pool-exhausted' | 'persistent-outage';
  at: string;
}

/** Session-state key set when account rotation advances the model route. */
export const MODEL_FALLBACK_STATE_KEY = 'mastracodePendingModelFallback' as const;

/** Payload written to session state under MODEL_FALLBACK_STATE_KEY. */
export interface PendingModelFallback {
  fromEntryId: string;
  toEntryId: string;
  toModelId: string;
  threadId?: string;
  reason: 'pool-exhausted' | 'persistent-outage';
  at: string;
}

export type RotationClassification =
  | { kind: 'rotate'; reason: 'rate-limit' | 'quota-exhausted' | 'auth-failed' }
  | { kind: 'hop' }
  | { kind: 'never' };

function isErrorWithCode(error: unknown): error is { code?: unknown } {
  return typeof error === 'object' && error !== null && 'code' in error;
}

function readErrorStatus(error: unknown): number | undefined {
  let current: unknown = error;
  for (let depth = 0; current && depth < MAX_CAUSE_DEPTH; depth++) {
    if (typeof current !== 'object') break;
    const { statusCode, status } = current as { statusCode?: unknown; status?: unknown };
    if (typeof statusCode === 'number') return statusCode;
    if (typeof status === 'number') return status;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

function isProviderAuthRequiredError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; current && depth < MAX_CAUSE_DEPTH; depth++) {
    if (
      current instanceof ProviderAuthRequiredError ||
      (current instanceof Error && current.name === PROVIDER_AUTH_REQUIRED_ERROR)
    ) {
      return true;
    }
    if (typeof current !== 'object') break;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/** Concatenate the error's message with its cause chain (bounded). */
function collectErrorText(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; current && depth < MAX_CAUSE_DEPTH; depth++) {
    if (current instanceof Error) {
      parts.push(current.message);
      current = current.cause;
    } else if (typeof current === 'object' && 'message' in current) {
      const message = (current as { message?: unknown }).message;
      if (typeof message === 'string') parts.push(message);
      current = (current as { cause?: unknown }).cause;
    } else {
      break;
    }
  }
  return parts.join(' | ');
}

function isNetworkErrorLike(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; current && depth < MAX_CAUSE_DEPTH; depth++) {
    if (
      isErrorWithCode(current) &&
      typeof current.code === 'string' &&
      NETWORK_ERROR_CODES.has(current.code.toUpperCase())
    ) {
      return true;
    }
    if (current instanceof Error) {
      if (NETWORK_MESSAGE_PATTERN.test(current.message)) return true;
      current = current.cause;
    } else if (typeof current === 'object') {
      current = (current as { cause?: unknown }).cause;
    } else {
      break;
    }
  }
  return false;
}

/**
 * The locked Q7 taxonomy. 429/402/usage-limit rotate immediately (429 is not
 * covered by any transient matcher, so it arrives here on first occurrence);
 * 401/403 and `ProviderAuthRequiredError` rotate after one forced refresh;
 * 5xx/network hop only when the transient retry budget is already spent (they
 * reach this processor because `StreamErrorRetryProcessor` declined); 400 and
 * everything unknown never touch the registry.
 */
export function classifyRotationError(error: unknown): RotationClassification {
  if (isProviderAuthRequiredError(error)) {
    return { kind: 'rotate', reason: 'auth-failed' };
  }

  const status = readErrorStatus(error);

  if (status === 429) return { kind: 'rotate', reason: 'rate-limit' };
  if (status === 402) return { kind: 'rotate', reason: 'quota-exhausted' };
  if (status === 401 || status === 403) return { kind: 'rotate', reason: 'auth-failed' };
  if (status !== undefined && status >= 500 && status < 600) return { kind: 'hop' };

  // Quota wording only rotates when it co-occurs with a statusless or 400
  // error — the shapes providers actually use for message-only quota
  // failures. Any other status keeps its own classification above (401/403
  // auth, 5xx outage hop, 404/422 never), so limit-ish text riding a
  // non-quota client error can no longer burn the whole pool.
  if (status === undefined || status === 400) {
    if (USAGE_LIMIT_MESSAGE_PATTERN.test(collectErrorText(error))) {
      return { kind: 'rotate', reason: 'quota-exhausted' };
    }
  }
  if (isNetworkErrorLike(error)) return { kind: 'hop' };

  return { kind: 'never' };
}

/** Provider id off a router model id: `mastracode/<provider>/<model>` or `<provider>/<model>`. */
export function providerFromModelId(modelId: string): string | undefined {
  const segments = modelId.replace(/^mastracode\//, '').split('/');
  const providerId = segments[0];
  if (providerId === 'openai') return 'openai-codex';
  return providerId && KNOWN_PROVIDER_IDS.has(providerId) ? providerId : undefined;
}

function providerFromHost(hostname: string): string | undefined {
  for (const [pattern, providerId] of PROVIDER_HOST_PATTERNS) {
    if (pattern.test(hostname)) return providerId;
  }
  return undefined;
}

/**
 * Identify the provider an error came from: the request URL's hostname
 * (`APICallError.url`, cause chain included), falling back to the router
 * model id. Unknown → undefined (caller treats as never-rotate).
 */
export function providerFromError(error: unknown): string | undefined {
  const causeChain: object[] = [];
  let current: unknown = error;
  for (let depth = 0; current && depth < MAX_CAUSE_DEPTH; depth++) {
    if (typeof current !== 'object') break;
    causeChain.push(current);
    current = (current as { cause?: unknown }).cause;
  }

  // A request URL identifies the provider that actually handled the failed
  // call. Check every supported URL field throughout the cause chain before
  // falling back to router model metadata, which may describe the original
  // session model rather than the active cascade entry.
  for (const item of causeChain) {
    const urls = [
      (item as { url?: unknown }).url,
      (item as { requestURL?: unknown }).requestURL,
      (item as { requestUrl?: unknown }).requestUrl,
    ];
    for (const url of urls) {
      if (typeof url !== 'string') continue;
      try {
        const providerId = providerFromHost(new URL(url).hostname);
        if (providerId) return providerId;
      } catch {
        // Not a parseable URL — try the other fields and causes.
      }
    }
  }

  for (const item of causeChain) {
    const modelId = (item as { modelId?: unknown }).modelId;
    if (typeof modelId !== 'string') continue;
    const providerId = providerFromModelId(modelId);
    if (providerId) return providerId;
  }
  return undefined;
}

function getTriedInstances(state: Record<string, unknown>): Set<string> {
  const existing = state.triedInstances;
  if (existing instanceof Set) return existing;
  const created = new Set<string>();
  state.triedInstances = created;
  return created;
}

function getForcedRefreshInstances(state: Record<string, unknown>): Set<string> {
  const existing = state.forcedAuthRefresh;
  if (existing instanceof Set) return existing;
  const created = new Set<string>();
  state.forcedAuthRefresh = created;
  return created;
}

/** Friendly names for the part/notice copy (display only — never auth data). */
export const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  anthropic: 'Anthropic',
  'kimi-for-coding': 'Kimi',
  'openai-codex': 'Codex',
  'github-copilot': 'GitHub Copilot',
  xai: 'xAI',
};

const REASON_TEXT: Record<Exclude<AccountSwitchPartData['reason'], 'starting-on-account'>, string> = {
  'rate-limit': 'rate limit',
  'quota-exhausted': 'quota exhausted',
  'auth-failed': 'auth failed',
  'pool-exhausted': 'pool exhausted',
  'persistent-outage': 'persistent outage',
  'preferred-routing': 'subscription routing',
};

/** Validates untrusted `reason` values (e.g. persisted message parts). */
export function isAccountSwitchReason(value: unknown): value is AccountSwitchPartData['reason'] {
  return (
    value === 'starting-on-account' ||
    // Own-property check: `in` would accept prototype names like 'toString',
    // which would then interpolate the inherited function into the notice text.
    (typeof value === 'string' && Object.prototype.hasOwnProperty.call(REASON_TEXT, value))
  );
}

/**
 * One-line transcript copy for a switch part. Shared by the live `info`
 * controller event (the TUI shows controller `info` events as transcript
 * lines, and no message event carries data parts mid-run) and by the TUI's
 * history rendering of the persisted part — one formatter, identical text.
 */
export function accountSwitchNoticeText(data: AccountSwitchPartData): string {
  const provider = PROVIDER_DISPLAY_NAMES[data.provider] ?? data.provider;
  if (data.reason === 'starting-on-account' && data.to) {
    return `Starting on ${provider} account: ${data.to.label}`;
  }
  const reason = data.reason === 'starting-on-account' ? data.reason : REASON_TEXT[data.reason];
  if (data.to === null) {
    // A12: a targeted route reports *its* account, not the pool — the other
    // subscriptions were never tried, so "all accounts unavailable" would be
    // wrong and would read as if the pool had been walked.
    if (data.exclusive) {
      return `Pinned ${provider} account unavailable (${reason})`;
    }
    return `All ${provider} accounts unavailable (${reason})`;
  }
  const from = data.from?.label ?? 'unknown';
  return `Switched ${provider} account: ${from} → ${data.to.label} (${reason})`;
}

/** Transcript line for a model-route hop; shared by the live info event and the TUI's history render. */
export function modelFallbackNoticeText(data: ModelFallbackPartData): string {
  const reason = REASON_TEXT[data.reason] ?? data.reason;
  return `Switched model route: ${data.from.label} → ${data.to.label} (${reason})`;
}

/**
 * Whether a persisted model-fallback reason is one this build understands.
 * `REASON_TEXT` also covers the account-switch reasons, so the notice text
 * alone would happily render a foreign value such as `rate-limit` as a
 * model-fallback reason; history parsed from another build's part must be
 * rejected instead.
 */
export function isModelFallbackReason(value: unknown): value is ModelFallbackPartData['reason'] {
  return value === 'pool-exhausted' || value === 'persistent-outage';
}

async function emitAccountSwitchPart(
  args: Pick<ProcessAPIErrorArgs, 'writer' | 'requestContext'> | Pick<ProcessInputArgs, 'writer' | 'requestContext'>,
  data: AccountSwitchPartData,
): Promise<void> {
  // Non-transient on purpose (contrast the transient tool-progress parts):
  // switches must persist into the assistant message and render from history.
  await args.writer?.custom({
    type: ACCOUNT_SWITCH_PART_TYPE,
    data,
  });
  // Data parts surface in the TUI only on history reload; emit the same line
  // as a controller `info` event so the switch is visible live (precedent:
  // emitTransientRetry emits controller events from the retry matcher).
  const controllerContext = args.requestContext?.get('controller') as
    | { emitEvent?: (event: { type: 'info'; message: string }) => void }
    | undefined;
  controllerContext?.emitEvent?.({ type: 'info', message: accountSwitchNoticeText(data) });
}

/**
 * Provider of the model the controller session is currently running — the
 * fallback identification path for errors that carry neither a request URL
 * nor a model id (e.g. `ProviderAuthRequiredError` thrown by a fetch wrapper
 * before any HTTP request exists).
 */
function providerFromSession(
  args: Pick<ProcessAPIErrorArgs, 'requestContext'> | Pick<ProcessInputArgs, 'requestContext'>,
): string | undefined {
  const controller = args.requestContext?.get('controller') as { session?: { modelId?: unknown } } | undefined;
  const modelId = controller?.session?.modelId;
  return typeof modelId === 'string' ? providerFromModelId(modelId) : undefined;
}

/**
 * Rotates the active OAuth account on classified API errors.
 *
 * Registered in `errorProcessors` AFTER `StreamErrorRetryProcessor` — a
 * transient error reaching this processor means the transient budget is
 * spent, which is exactly the hop condition. Implements `processAPIError`
 * ONLY (see the file header for the runner-order rationale).
 */
/** Cached per-request model route cascade. */
interface ModelRouteCascade {
  entries: Array<{ id: string; label: string; modelId: string; accountId?: string }>;
  position: number;
}

interface AccountRoute {
  entryId: string;
  modelId: string;
  providerId: string;
  accountId?: string;
}

type RoutingProcessorArgs = Pick<ProcessAPIErrorArgs, 'requestContext' | 'state' | 'writer'> | ProcessInputArgs;

export type RoutingControllerContext = {
  session?: { modelId?: unknown; modeId?: unknown };
  threadId?: unknown;
  getState?: () => Record<string, unknown>;
  setState?: (updates: Record<string, unknown>) => Promise<void>;
  getThreadSetting?: (key: string) => Promise<unknown>;
  setThreadSetting?: (setting: { key: string; value: unknown }) => Promise<void>;
  isThreadActive?: () => boolean;
};

function getRoutingController(
  args: Pick<RoutingProcessorArgs, 'requestContext'>,
): RoutingControllerContext | undefined {
  return args.requestContext?.get('controller') as RoutingControllerContext | undefined;
}

/** A targeted route is exclusive; an entry without accountId uses automatic pool rotation. */
function getRouteTargetAccountId(route: AccountRoute | null): string | undefined {
  return route?.accountId;
}

function getRequestActiveAccount(
  args: Pick<RoutingProcessorArgs, 'requestContext'>,
  store: CredentialStore,
  providerId: string,
) {
  if (isRequestAccountRoutingExhausted(args.requestContext, providerId)) return undefined;
  const selectedId = getRequestAccountSelection(args.requestContext, providerId);
  if (selectedId) return store.listAccounts?.(providerId).find(account => account.id === selectedId);
  return store.getActiveAccount?.(providerId) ?? store.listAccounts?.(providerId).find(account => account.active);
}

function resolveAccountRoute(
  args: Pick<RoutingProcessorArgs, 'requestContext'>,
  explicit?: { id: string; modelId: string; accountId?: string },
): AccountRoute | null {
  const controller = getRoutingController(args);
  const state = controller?.getState?.();
  const pending = state?.mastracodePendingModelFallback as
    | { toEntryId?: unknown; toModelId?: unknown; threadId?: unknown }
    | null
    | undefined;
  const pendingMatchesThread =
    pending &&
    typeof pending.toEntryId === 'string' &&
    typeof pending.toModelId === 'string' &&
    (pending.threadId === undefined || pending.threadId === controller?.threadId);
  const routeEntries = Array.isArray((state?.modelRoute as { entries?: unknown } | undefined)?.entries)
    ? ((state?.modelRoute as { entries: Array<{ id?: unknown; modelId?: unknown; accountId?: unknown }> }).entries ??
      [])
    : [];
  const entry = explicit
    ? explicit
    : pendingMatchesThread
      ? routeEntries.find(candidate => candidate.id === pending.toEntryId && candidate.modelId === pending.toModelId)
      : routeEntries.find(candidate => candidate.modelId === controller?.session?.modelId);
  if (!entry || typeof entry.id !== 'string' || typeof entry.modelId !== 'string') return null;
  const providerId = providerFromModelId(entry.modelId);
  if (!providerId) return null;
  return {
    entryId: entry.id,
    modelId: entry.modelId,
    providerId,
    ...(typeof entry.accountId === 'string' ? { accountId: entry.accountId } : {}),
  };
}

/**
 * A14: `Automatic` rotation starts *at* the persisted active account and walks
 * insertion order from there, wrapping once. The active account is the cursor
 * rotation last left at, so a turn that starts at index 0 regardless would
 * re-activate and re-try an account the previous turn already moved past —
 * which is the whole job the removed sticky-exclusion set was doing badly.
 * With no persisted active account the order is plain insertion order.
 */
function orderAccountsFromActive(accounts: OAuthAccountRecord[], activeId: string | undefined) {
  const index = activeId === undefined ? -1 : accounts.findIndex(account => account.id === activeId);
  if (index <= 0) return accounts;
  return [...accounts.slice(index), ...accounts.slice(0, index)];
}

async function applyPreferredAccountRoute(
  args: RoutingProcessorArgs,
  store: CredentialStore,
  route: AccountRoute,
): Promise<boolean> {
  store.reload();
  const preferredId = getRouteTargetAccountId(route);
  const accounts = store.listAccounts?.(route.providerId) ?? [];
  if (accounts.length === 0 && preferredId === undefined) return false;
  const tried = getTriedInstances(args.state);
  const unavailable = new Set(accounts.filter(account => tried.has(account.id)).map(account => account.id));
  const active = getRequestActiveAccount(args, store, route.providerId) ?? store.getActiveAccount?.(route.providerId);
  const selected = // A12: a targeted route may use only the account it names. `Automatic`
    // keeps insertion order with full pool rotation (A10), starting from the
    // account the cursor already points at (A14).
    (
      preferredId
        ? accounts.filter(account => account.id === preferredId)
        : orderAccountsFromActive(accounts, active?.id)
    ).find(account => !unavailable.has(account.id));

  for (const accountId of unavailable) tried.add(accountId);
  if (!selected) {
    markRequestAccountRoutingExhausted(args.requestContext, route.providerId);
    return false;
  }

  if (active?.id === selected.id) {
    setRequestAccountSelection(args.requestContext, route.providerId, selected.id);
    return false;
  }
  // Activate before recording the request-scoped selection: a failed
  // activation must not leave the selection claiming an account that never
  // became the provider's active credential.
  const activated = store.activateAccount ? store.activateAccount(route.providerId, selected.id) : selected;
  if (!activated) {
    // Only a targeted route is out of options here. The exhausted marker is
    // request-wide and fails every credential read closed, so setting it for
    // `Automatic` would stop error recovery from retrying on a survivor.
    if (preferredId !== undefined) markRequestAccountRoutingExhausted(args.requestContext, route.providerId);
    return false;
  }
  setRequestAccountSelection(args.requestContext, route.providerId, activated.id);

  // Applying an explicit account choice is routine, not a failover notice.
  if (preferredId === undefined) {
    await emitAccountSwitchPart(args, {
      provider: route.providerId,
      from: active ? { id: active.id, label: active.label } : null,
      to: { id: activated.id, label: activated.label },
      reason: 'preferred-routing',
      at: new Date().toISOString(),
    });
  }
  return true;
}

export class AccountRotationProcessor implements Processor {
  readonly id = 'mastracode-account-rotation' as const;

  constructor(
    private readonly options: {
      credentialStore: RotationCredentialStore;
      maxProcessorRetries: number;
      settingsPath?: string;
    },
  ) {}

  async processAPIError(args: ProcessAPIErrorArgs): Promise<{ retry: boolean }> {
    const { error, state } = args;

    // Core runs error processors even after the shared retry budget is spent
    // and silently discards `retry: true` then (llm-execution-step.ts
    // canRetryError) — rotating the cursor or emitting a switch part for a
    // retry that will never run would lie to both auth.json and the
    // transcript. With a fallback chain configured, a bare `retry: false`
    // here would silently advance the route for an error we never classified, so the
    // chain gate surfaces the error instead.
    if (args.retryCount >= this.options.maxProcessorRetries) {
      await this.gateChainHop(args, error);
      return { retry: false };
    }

    // Classify before attributing: an error from a provider outside the OAuth
    // registry (API-key/router providers are valid route entries) still hops on
    // rotate/hop classes — there is just no account cursor to advance.
    const classification = classifyRotationError(error);
    // Q14: 400/unknown errors never rotate and never advance routes. With a chain
    // active, core's fallback array would still advance on a bare
    // `retry: false` (it advances on any thrown non-TripWire error), so the
    // gate converts that into a surfaced error instead of a silent hop.
    if (classification.kind === 'never') {
      await this.gateChainHop(args, error);
      return { retry: false };
    }

    const cascade = await this.getModelRouteCascade(args);
    const currentEntry = cascade?.entries[cascade.position];
    const providerId =
      providerFromError(error) ??
      (currentEntry ? providerFromModelId(currentEntry.modelId) : undefined) ??
      (cascade ? undefined : providerFromSession(args));
    if (!providerId) {
      await this.emitModelFallbackPart(args, classification.kind === 'hop' ? 'persistent-outage' : 'pool-exhausted');
      return { retry: false };
    }

    // Deployed requests resolve the tenant-scoped store; local mode keeps the
    // host storage. Reading the host registry here would rotate or announce
    // host accounts for a tenant request. Annotated as the rotation surface:
    // `resolveCredentialStore` returns a plain CredentialStore, and the 401
    // path below uses the optional `forceRefreshActiveAccount` when the host
    // provides it.
    const store: RotationCredentialStore = resolveCredentialStore(args.requestContext) ?? this.options.credentialStore;
    store.reload();
    const accounts = store.listAccounts?.(providerId) ?? [];
    const active = getRequestActiveAccount(args, store, providerId);
    const route = currentEntry ? resolveAccountRoute(args, currentEntry) : resolveAccountRoute(args);

    // Q7 bucket 2: force one refresh of the active instance before rotating.
    // A 401 usually means a fresh-but-rejected token; the forced refresh
    // covers server-side clock skew and refresh-token races. Success retries
    // the same account — no rotation, no part. With no active account (e.g.
    // `ProviderAuthRequiredError` from an empty registry) a refresh can never
    // succeed, so skip it and fall through to the retry:false surface below,
    // which rethrows the original auth error instead of a generic pool
    // exhaustion message.
    if (classification.kind === 'rotate' && classification.reason === 'auth-failed' && active) {
      const forced = getForcedRefreshInstances(state);
      const refreshKey = `${providerId}:${active?.id ?? 'active'}`;
      if (!forced.has(refreshKey) && typeof store.forceRefreshActiveAccount === 'function') {
        forced.add(refreshKey);
        const token = await store.forceRefreshActiveAccount(providerId, active?.id);
        if (token !== undefined) {
          return { retry: true };
        }
      }
    }

    // A12: only a pin on the provider that actually failed makes this failure
    // exclusive. `route.providerId` is derived from the route's model while
    // `providerId` comes from the failed request's URL, which during a cascade
    // can still describe the session model rather than the entry being retried;
    // when they differ the pin belongs to an unrelated route, so the provider
    // that failed keeps its normal pool handling.
    const targetAccountId = route?.providerId === providerId ? getRouteTargetAccountId(route) : undefined;

    if (classification.kind === 'hop') {
      return this.declarePoolUnavailable(args, providerId, 'persistent-outage', targetAccountId !== undefined);
    }

    // A12: a targeted route never activates a sibling subscription. A
    // rotate-classified failure on the account the route selected proceeds to
    // the model route instead — the request hops, it does not spill
    // onto another subscription's quota. A targeted route has nothing to
    // rotate to at any pool size. A stale id for an account the user removed
    // reads the same way: fail closed rather than silently land on a sibling.
    if (targetAccountId !== undefined) {
      return this.declarePoolUnavailable(args, providerId, 'pool-exhausted', true);
    }

    // Count only this provider's instances: `tried` spans the whole request
    // (a cascade can visit several providers), so comparing its raw size to
    // this provider's account count would falsely report exhaustion when an
    // earlier provider in the same request already used up accounts.
    const tried = getTriedInstances(state);
    if (active) tried.add(active.id);
    // The tried-set is request-global and shared across providers after a
    // route hop, so exhaustion must count only this provider's ids.
    const triedForProvider = accounts.filter(account => tried.has(account.id)).length;
    if (triedForProvider >= accounts.length) {
      return this.declarePoolUnavailable(args, providerId, 'pool-exhausted');
    }

    // If the selected account was removed elsewhere, even a single survivor
    // is still untried. Resume from the freshly loaded global cursor.
    const candidates = active ? accounts : orderAccountsFromActive(accounts, store.getActiveAccount?.(providerId)?.id);
    const nextCandidate = candidates.find(account => !tried.has(account.id));

    const next = nextCandidate ? store.activateAccount?.(providerId, nextCandidate.id) : undefined;
    if (!next) {
      return this.declarePoolUnavailable(args, providerId, 'pool-exhausted');
    }
    setRequestAccountSelection(args.requestContext, providerId, next.id);
    tried.add(next.id);

    // The retry replays the request from scratch (Q10): rotate the assistant
    // message id so the retried response starts a fresh message instead of
    // appending to the partially streamed one.
    args.rotateResponseMessageId?.();

    await emitAccountSwitchPart(args, {
      provider: providerId,
      from: active ? { id: active.id, label: active.label } : null,
      to: { id: next.id, label: next.label },
      reason: classification.reason,
      at: new Date().toISOString(),
    });

    return { retry: true };
  }

  /**
   * Resolve the request's host-supplied model route once and cache the reachable
   * prefix in processor state. Resolution mirrors getDynamicModel so a hop is
   * never announced for an entry core cannot reach.
   */
  private async getModelRouteCascade(args: ProcessAPIErrorArgs): Promise<ModelRouteCascade | null> {
    if (args.state.modelRouteCascade !== undefined) {
      return (args.state.modelRouteCascade as ModelRouteCascade | null) ?? null;
    }
    const controller = getRoutingController(args);
    const state = controller?.getState?.();
    const route = (
      state?.modelRoute as
        | { entries?: Array<{ id?: unknown; label?: unknown; modelId?: unknown; accountId?: unknown }> }
        | undefined
    )?.entries;
    const pending = state?.mastracodePendingModelFallback as
      | { toEntryId?: unknown; threadId?: unknown }
      | null
      | undefined;
    const pendingMatchesThread =
      pending &&
      typeof pending.toEntryId === 'string' &&
      (pending.threadId === undefined || pending.threadId === controller?.threadId);
    const startIndex = pendingMatchesThread
      ? route?.findIndex(entry => entry.id === pending.toEntryId)
      : route?.findIndex(entry => entry.modelId === controller?.session?.modelId);
    if (!route || startIndex === undefined || startIndex < 0 || route.length - startIndex < 2) {
      args.state.modelRouteCascade = null;
      return null;
    }

    const thinkingLevel = resolveRequestThinkingLevel(
      {
        state: { thinkingLevel: state?.thinkingLevel },
        session: { modeId: typeof controller?.session?.modeId === 'string' ? controller.session.modeId : 'build' },
      },
      this.options.settingsPath,
    );
    const entries: ModelRouteCascade['entries'] = [];
    for (const entry of route.slice(startIndex)) {
      if (
        typeof entry.id !== 'string' ||
        entry.id.length === 0 ||
        typeof entry.modelId !== 'string' ||
        entry.modelId.length === 0
      ) {
        break;
      }
      if (entries.length > 0) {
        try {
          resolveModel(entry.modelId, {
            thinkingLevel,
            remapForCodexOAuth: true,
            requestContext: args.requestContext,
          });
        } catch {
          break;
        }
      }
      entries.push({
        id: entry.id,
        label: typeof entry.label === 'string' && entry.label.length > 0 ? entry.label : entry.id,
        modelId: entry.modelId,
        ...(typeof entry.accountId === 'string' ? { accountId: entry.accountId } : {}),
      });
    }
    if (entries.length < 2) {
      args.state.modelRouteCascade = null;
      return null;
    }
    const cascade: ModelRouteCascade = { entries, position: 0 };
    args.state.modelRouteCascade = cascade;
    return cascade;
  }

  /**
   * Q14 gate: 400/unknown/unattributable errors never advance routes. Core's
   * fallback array advances on ANY thrown error except TripWire
   * (llm-execution-step.ts), so when the session route has another entry and the
   * current entry is non-last, a bare `retry: false` would silently hop on an
   * error class the user excluded from hop triggers. TripWire is the only
   * no-advance escape: the runner rethrows it and the fallback loop declines
   * to advance. No chain (or already on the last entry) → return and let the
   * plain `retry: false` surface the error exactly as before.
   */
  private async gateChainHop(args: ProcessAPIErrorArgs, error: unknown): Promise<void> {
    const cascade = await this.getModelRouteCascade(args);
    if (!cascade) return;
    if (cascade.position >= cascade.entries.length - 1) return;
    const reason = error instanceof Error ? error.message : String(error);
    throw new TripWire(reason, {}, this.id);
  }

  /** Announce and persist the next model-route hop before core advances. */
  private async emitModelFallbackPart(
    args: ProcessAPIErrorArgs,
    reason: 'pool-exhausted' | 'persistent-outage',
  ): Promise<void> {
    const cascade = await this.getModelRouteCascade(args);
    if (!cascade) return;

    const from = cascade.entries[cascade.position];
    const to = cascade.entries[cascade.position + 1];
    if (!from || !to) return;

    const controller = args.requestContext?.get('controller') as
      | {
          threadId?: unknown;
          setState?: (updates: Record<string, unknown>) => Promise<void>;
          setThreadSetting?: (setting: { key: string; value: unknown }) => Promise<void>;
          emitEvent?: (event: { type: 'info'; message: string }) => void;
        }
      | undefined;
    const at = new Date().toISOString();
    const threadId = typeof controller?.threadId === 'string' ? controller.threadId : undefined;
    const pending = {
      fromEntryId: from.id,
      toEntryId: to.id,
      toModelId: to.modelId,
      ...(threadId ? { threadId } : {}),
      reason,
      at,
    } satisfies PendingModelFallback;
    await controller?.setThreadSetting?.({ key: MODEL_FALLBACK_STATE_KEY, value: pending });
    const data: ModelFallbackPartData = {
      from: { entryId: from.id, label: from.label },
      to: { entryId: to.id, label: to.label },
      reason,
      at,
    };
    try {
      await args.writer?.custom({ type: MODEL_FALLBACK_PART_TYPE, data });
    } catch (error) {
      await controller?.setThreadSetting?.({ key: MODEL_FALLBACK_STATE_KEY, value: undefined });
      throw error;
    }
    await controller?.setState?.({ [MODEL_FALLBACK_STATE_KEY]: pending });
    args.state.startNoticeEmitted = false;
    const targetRoute = resolveAccountRoute(args, to);
    if (targetRoute) {
      const store = resolveCredentialStore(args.requestContext) ?? this.options.credentialStore;
      await applyPreferredAccountRoute(args, store, targetRoute).catch(() => undefined);
    }
    controller?.emitEvent?.({ type: 'info', message: modelFallbackNoticeText(data) });
    cascade.position++;
  }

  /**
   * Pool done for this request: every instance recorded in the tried-set and
   * a `to: null` part emitted. Returns `retry: false` so core's fallback
   * array can hop to the next route entry (announced by `emitModelFallbackPart`).
   * Silent on the account part when the provider has no registry at all —
   * there are no accounts to declare unavailable, but the hop still applies.
   */
  private async declarePoolUnavailable(
    args: ProcessAPIErrorArgs,
    providerId: string,
    reason: 'pool-exhausted' | 'persistent-outage',
    exclusive = false,
  ): Promise<{ retry: boolean }> {
    const store = resolveCredentialStore(args.requestContext) ?? this.options.credentialStore;
    const accounts = store.listAccounts?.(providerId) ?? [];
    if (accounts.length === 0) {
      // No account registry (API-key-only provider): nothing rotated, but the
      // hop still happens — announce the model fallback before core advances.
      await this.emitModelFallbackPart(args, reason);
      return { retry: false };
    }

    const tried = getTriedInstances(args.state);
    for (const account of accounts) tried.add(account.id);

    const active = getRequestActiveAccount(args, store, providerId);

    await emitAccountSwitchPart(args, {
      provider: providerId,
      from: active ? { id: active.id, label: active.label } : null,
      to: null,
      reason,
      at: new Date().toISOString(),
      ...(exclusive ? { exclusive: true } : {}),
    });

    await this.emitModelFallbackPart(args, reason);

    return { retry: false };
  }
}

/**
 * Emits the "starting on a non-default account" notice (Q19) once per
 * request when the active registry account is not the first entry.
 *
 * TYPE CONSTRAINT: this class must NEVER implement `processAPIError`. It
 * lives in `inputProcessors`; the runner walks input processors first when
 * running `processAPIError`, so adding the method here would classify and
 * rotate errors BEFORE `StreamErrorRetryProcessor`'s transient retries run.
 */
export class AccountStartNoticeProcessor implements Processor {
  readonly id = 'mastracode-account-start-notice' as const;

  constructor(private readonly options: { credentialStore: CredentialStore }) {}

  async processInput(args: ProcessInputArgs): Promise<ProcessInputResult> {
    if (args.state.startNoticeEmitted) return args.messageList;

    // Deployed requests resolve the tenant-scoped store so host accounts are
    // never listed, activated, or announced for a tenant run. Local mode keeps
    // the constructor's storage.
    const store = resolveCredentialStore(args.requestContext) ?? this.options.credentialStore;

    const route = resolveAccountRoute(args);
    if (route) {
      const switched = await applyPreferredAccountRoute(args, store, route);
      if (switched || getRouteTargetAccountId(route) !== undefined) {
        args.state.startNoticeEmitted = true;
        return args.messageList;
      }
    } else {
      store.reload();
    }

    // A14: a route whose accounts are all unavailable is not a pre-emptive
    // abort. `applyPreferredAccountRoute` marks the provider on the request so
    // credential reads fail closed rather than falling through to the active
    // account, and the request then runs and fails at the provider — which is
    // what lets the error lane classify it and hand the turn to the route's
    // configured fallback chain. The removed persisted set threw here instead,
    // before any socket opened, so the chain was never reached.
    const providerId = route?.providerId ?? providerFromSession(args);
    if (!providerId) return args.messageList;

    const accounts = store.listAccounts?.(providerId) ?? [];
    if (accounts.length < 2) return args.messageList;

    const active = store.getActiveAccount?.(providerId);
    const first = accounts[0];
    if (!active || !first || active.id === first.id) return args.messageList;

    args.state.startNoticeEmitted = true;

    await emitAccountSwitchPart(args, {
      provider: providerId,
      from: null,
      to: { id: active.id, label: active.label },
      reason: 'starting-on-account',
      at: new Date().toISOString(),
    });

    return args.messageList;
  }
}
