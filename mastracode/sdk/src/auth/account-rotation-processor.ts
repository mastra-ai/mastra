/**
 * Error-driven rotation across a provider's OAuth account registry.
 *
 * When the active account cannot serve a request (rate limit, quota
 * exhaustion, dead token, persistent outage), the next account in insertion
 * order is activated in storage and the request retried — the OAuth fetch
 * wrappers re-read `auth.json` per HTTP request, so the retried attempt picks
 * the newly active account up with no model re-resolution. Every switch is
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
import type { ProcessAPIErrorArgs, ProcessInputArgs, ProcessInputResult, Processor } from '@mastra/core/processors';

import { ProviderAuthRequiredError, PROVIDER_AUTH_REQUIRED_ERROR } from './provider-auth-error.js';
import type { CredentialStore } from './types.js';

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
    | 'starting-on-account';
  at: string;
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
  forceRefreshActiveAccount?(providerId: string): Promise<string | undefined>;
};

const KNOWN_PROVIDER_IDS = new Set(['anthropic', 'openai-codex', 'github-copilot', 'kimi-for-coding', 'xai']);

/** Hostname suffixes → provider ids, for `APICallError.url`. */
const PROVIDER_HOST_PATTERNS: Array<[RegExp, string]> = [
  [/(^|\.)api\.anthropic\.com$/i, 'anthropic'],
  [/(^|\.)api\.kimi\.com$/i, 'kimi-for-coding'],
  [/(^|\.)api\.x\.ai$/i, 'xai'],
  [/chatgpt\.com$/i, 'openai-codex'],
  [/backend-api\.codex\.ai$/i, 'openai-codex'],
  [/(^|\.)api\.githubcopilot\.com$/i, 'github-copilot'],
  [/(^|\.)api\.github\.com$/i, 'github-copilot'],
];

/**
 * Provider usage/quota-limit wording (locked Q7 bucket 1). Statuses 429/402
 * are matched before this; some providers deliver quota errors as plain 400s,
 * which only the message reveals.
 */
const USAGE_LIMIT_MESSAGE_PATTERN =
  /usage (?:limit|cap)|quota (?:exceeded|exhausted|reached)|rate limit (?:exceeded|reached)|exceeded your [a-z ]*limit|weekly limit|monthly limit/i;

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

export type RotationClassification =
  | { kind: 'rotate'; reason: 'rate-limit' | 'quota-exhausted' | 'auth-failed' }
  | { kind: 'hop' }
  | { kind: 'never' };

function isErrorWithCode(error: unknown): error is { code?: unknown } {
  return typeof error === 'object' && error !== null && 'code' in error;
}

function readErrorStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const { statusCode, status } = error as { statusCode?: unknown; status?: unknown };
  if (typeof statusCode === 'number') return statusCode;
  if (typeof status === 'number') return status;
  return undefined;
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
  if (
    error instanceof ProviderAuthRequiredError ||
    (error instanceof Error && error.name === PROVIDER_AUTH_REQUIRED_ERROR)
  ) {
    return { kind: 'rotate', reason: 'auth-failed' };
  }

  const status = readErrorStatus(error);

  if (status === 429) return { kind: 'rotate', reason: 'rate-limit' };
  if (status === 402) return { kind: 'rotate', reason: 'quota-exhausted' };
  if (status === 401 || status === 403) return { kind: 'rotate', reason: 'auth-failed' };
  if (status !== undefined && status >= 500 && status < 600) return { kind: 'hop' };

  if (USAGE_LIMIT_MESSAGE_PATTERN.test(collectErrorText(error))) {
    return { kind: 'rotate', reason: 'quota-exhausted' };
  }
  if (isNetworkErrorLike(error)) return { kind: 'hop' };

  return { kind: 'never' };
}

/** Provider id off a router model id: `mastracode/<provider>/<model>` or `<provider>/<model>`. */
export function providerFromModelId(modelId: string): string | undefined {
  const segments = modelId.replace(/^mastracode\//, '').split('/');
  const providerId = segments[0];
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
  let current: unknown = error;
  for (let depth = 0; current && depth < MAX_CAUSE_DEPTH; depth++) {
    if (typeof current !== 'object') break;
    const url = (current as { url?: unknown }).url ?? (current as { requestURL?: unknown }).requestURL;
    if (typeof url === 'string') {
      try {
        const providerId = providerFromHost(new URL(url).hostname);
        if (providerId) return providerId;
      } catch {
        // Not a parseable URL — keep walking.
      }
    }
    const modelId = (current as { modelId?: unknown }).modelId;
    if (typeof modelId === 'string') {
      const providerId = providerFromModelId(modelId);
      if (providerId) return providerId;
    }
    current = (current as { cause?: unknown }).cause;
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

function getForcedRefreshProviders(state: Record<string, unknown>): Set<string> {
  const existing = state.forcedAuthRefresh;
  if (existing instanceof Set) return existing;
  const created = new Set<string>();
  state.forcedAuthRefresh = created;
  return created;
}

/** Friendly names for the part/notice copy (display only — never auth data). */
const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
  anthropic: 'Anthropic',
  'kimi-for-coding': 'Kimi',
  'openai-codex': 'Codex',
  'github-copilot': 'GitHub Copilot',
  xai: 'xAI',
};

const REASON_TEXT: Record<string, string> = {
  'rate-limit': 'rate limit',
  'quota-exhausted': 'quota exhausted',
  'auth-failed': 'auth failed',
  'pool-exhausted': 'pool exhausted',
  'persistent-outage': 'persistent outage',
};

/**
 * One-line transcript copy for a switch part. Shared by the live `info`
 * controller event (the TUI shows controller `info` events as transcript
 * lines, and no message event carries data parts mid-run) and by the TUI's
 * history rendering of the persisted part — one formatter, identical text.
 */
export function accountSwitchNoticeText(data: AccountSwitchPartData): string {
  const provider = PROVIDER_DISPLAY_NAMES[data.provider] ?? data.provider;
  const reason = REASON_TEXT[data.reason] ?? data.reason;
  if (data.reason === 'starting-on-account' && data.to) {
    return `Starting on ${provider} account: ${data.to.label}`;
  }
  if (data.to === null) {
    return `All ${provider} accounts unavailable (${reason})`;
  }
  const from = data.from?.label ?? 'unknown';
  return `Switched ${provider} account: ${from} → ${data.to.label} (${reason})`;
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
export class AccountRotationProcessor implements Processor {
  readonly id = 'mastracode-account-rotation' as const;

  constructor(private readonly options: { credentialStore: RotationCredentialStore; maxProcessorRetries: number }) {}

  async processAPIError(args: ProcessAPIErrorArgs): Promise<{ retry: boolean }> {
    // Core runs error processors even after the shared retry budget is spent
    // and silently discards `retry: true` then (llm-execution-step.ts
    // canRetryError) — rotating the cursor or emitting a switch part for a
    // retry that will never run would lie to both auth.json and the
    // transcript. `retry: false` still lets core advance a model fallback
    // chain, which is the honest outcome at budget exhaustion.
    if (args.retryCount >= this.options.maxProcessorRetries) return { retry: false };

    const { error, state } = args;

    const providerId = providerFromError(error) ?? providerFromSession(args);
    if (!providerId) return { retry: false };

    const classification = classifyRotationError(error);
    if (classification.kind === 'never') return { retry: false };

    const store = this.options.credentialStore;
    const accounts = store.listAccounts?.(providerId) ?? [];

    // Q7 bucket 2: force one refresh of the active instance before rotating.
    // A 401 usually means a fresh-but-rejected token; the forced refresh
    // covers server-side clock skew and refresh-token races. Success retries
    // the same account — no rotation, no part.
    if (classification.kind === 'rotate' && classification.reason === 'auth-failed') {
      const forced = getForcedRefreshProviders(state);
      if (!forced.has(providerId) && typeof store.forceRefreshActiveAccount === 'function') {
        forced.add(providerId);
        const token = await store.forceRefreshActiveAccount(providerId);
        if (token !== undefined) {
          return { retry: true };
        }
      }
    }

    if (classification.kind === 'hop') {
      return this.declarePoolUnavailable(args, providerId, 'persistent-outage');
    }

    if (accounts.length < 2) return { retry: false };

    const tried = getTriedInstances(state);
    const active = store.getActiveAccount?.(providerId) ?? accounts.find(account => account.active);
    if (active) tried.add(active.id);
    if (tried.size >= accounts.length) {
      return this.declarePoolUnavailable(args, providerId, 'pool-exhausted');
    }

    const next = store.activateAccount?.(providerId);
    if (!next) {
      return this.declarePoolUnavailable(args, providerId, 'pool-exhausted');
    }
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
   * Pool done for this request: every instance recorded in the tried-set and
   * a `to: null` part emitted. Returns `retry: false`, which today surfaces
   * the error as before; segment 03's fallback chain turns this exact return
   * into a pack hop. Silent (no part) when the provider has no registry at
   * all — there are no accounts to declare unavailable.
   */
  private async declarePoolUnavailable(
    args: ProcessAPIErrorArgs,
    providerId: string,
    reason: 'pool-exhausted' | 'persistent-outage',
  ): Promise<{ retry: boolean }> {
    const accounts = this.options.credentialStore.listAccounts?.(providerId) ?? [];
    if (accounts.length === 0) return { retry: false };

    const tried = getTriedInstances(args.state);
    for (const account of accounts) tried.add(account.id);

    const active =
      this.options.credentialStore.getActiveAccount?.(providerId) ?? accounts.find(account => account.active);

    await emitAccountSwitchPart(args, {
      provider: providerId,
      from: active ? { id: active.id, label: active.label } : null,
      to: null,
      reason,
      at: new Date().toISOString(),
    });

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

    const providerId = providerFromSession(args);
    if (!providerId) return args.messageList;

    const accounts = this.options.credentialStore.listAccounts?.(providerId) ?? [];
    if (accounts.length < 2) return args.messageList;

    const active = this.options.credentialStore.getActiveAccount?.(providerId);
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
