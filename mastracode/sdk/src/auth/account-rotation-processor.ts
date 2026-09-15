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
import { TripWire } from '@mastra/core/agent';
import type { ProcessAPIErrorArgs, ProcessInputArgs, ProcessInputResult, Processor } from '@mastra/core/processors';

import { resolveCredentialStore } from '../agents/credential-resolver.js';
import { listResolvableModePacks, resolveModel } from '../agents/model.js';
import { resolveModePackFallbackChain } from '../onboarding/packs.js';
import { findModePackForModel, loadSettings, resolveModePackModels } from '../onboarding/settings.js';
import { ProviderAuthRequiredError, PROVIDER_AUTH_REQUIRED_ERROR } from './provider-auth-error.js';
import { getOAuthProviders } from './storage.js';
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

/** Persisted data-part type for a fallback-pack hop. */
export const PACK_FALLBACK_PART_TYPE = 'data-mastracode-pack-fallback' as const;

/**
 * Payload of a pack-fallback part: the pack the cascade is leaving, the pack
 * core's fallback array advances to, and why. Labels and pack ids only —
 * never credential material.
 */
export interface PackFallbackPartData {
  from: { packId: string; label: string };
  to: { packId: string; label: string };
  reason: 'pool-exhausted' | 'persistent-outage';
  at: string;
}

/**
 * Session-state key the processor sets when a pack hop happens. The TUI
 * listens for it on the typed `state_changed` controller event (data parts
 * never ride controller message events) and applies thread stickiness.
 */
export const PACK_FALLBACK_STATE_KEY = 'mastracodePendingPackFallback' as const;

/** Payload written to session state under PACK_FALLBACK_STATE_KEY. */
export interface PendingPackFallback {
  fromPackId: string;
  toPackId: string;
  /** Landed pack's model for the mode the cascade is serving. */
  toModelId: string;
  /** Originating thread. Absent only on pending hops written by older clients. */
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
    return `All ${provider} accounts unavailable (${reason})`;
  }
  const from = data.from?.label ?? 'unknown';
  return `Switched ${provider} account: ${from} → ${data.to.label} (${reason})`;
}

/** Transcript line for a pack-fallback hop; shared by the live info event and the TUI's history render. */
export function packFallbackNoticeText(data: PackFallbackPartData): string {
  const reason = REASON_TEXT[data.reason] ?? data.reason;
  return `Switched model pack: ${data.from.label} → ${data.to.label} (${reason})`;
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
/** Cached per-request pack cascade (state.packCascade). */
interface PackCascade {
  packs: Array<{ packId: string; label: string }>;
  models: Record<string, Record<string, string>>;
  modeId: string;
  position: number;
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
    // here would silently hop packs for an error we never classified, so the
    // chain gate surfaces the error instead.
    if (args.retryCount >= this.options.maxProcessorRetries) {
      await this.gateChainHop(args, error);
      return { retry: false };
    }

    // Classify before attributing: an error from a provider outside the OAuth
    // registry (API-key/router providers are valid pack members) still hops on
    // rotate/hop classes — there is just no account cursor to advance.
    const classification = classifyRotationError(error);
    // Q14: 400/unknown errors never rotate and never hop packs. With a chain
    // active, core's fallback array would still advance on a bare
    // `retry: false` (it advances on any thrown non-TripWire error), so the
    // gate converts that into a surfaced error instead of a silent hop.
    if (classification.kind === 'never') {
      await this.gateChainHop(args, error);
      return { retry: false };
    }

    const cascade = await this.getPackCascade(args);
    const currentPack = cascade?.packs[cascade.position];
    const cascadeModelId = currentPack ? cascade.models[currentPack.packId]?.[cascade.modeId] : undefined;
    const providerId =
      providerFromError(error) ??
      (typeof cascadeModelId === 'string' ? providerFromModelId(cascadeModelId) : undefined) ??
      (cascade ? undefined : providerFromSession(args));
    if (!providerId) {
      await this.emitPackFallbackPart(args, classification.kind === 'hop' ? 'persistent-outage' : 'pool-exhausted');
      return { retry: false };
    }

    // Deployed requests resolve the tenant-scoped store; local mode keeps the
    // host storage. Reading the host registry here would rotate or announce
    // host accounts for a tenant request. Annotated as the rotation surface:
    // `resolveCredentialStore` returns a plain CredentialStore, and the 401
    // path below uses the optional `forceRefreshActiveAccount` when the host
    // provides it.
    const store: RotationCredentialStore = resolveCredentialStore(args.requestContext) ?? this.options.credentialStore;
    const accounts = store.listAccounts?.(providerId) ?? [];
    const active = store.getActiveAccount?.(providerId) ?? accounts.find(account => account.active);

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
        const token = await store.forceRefreshActiveAccount(providerId);
        if (token !== undefined) {
          return { retry: true };
        }
      }
    }

    if (classification.kind === 'hop') {
      return this.declarePoolUnavailable(args, providerId, 'persistent-outage');
    }

    // A pool smaller than 2 has nothing to rotate to — it is exhausted by
    // definition once a rotate-classified error arrives. Route through the
    // pool-exhausted path so the notices (and any pack hop) still fire; with
    // no registry at all this announces only a configured pack hop.
    if (accounts.length < 2) {
      return this.declarePoolUnavailable(args, providerId, 'pool-exhausted');
    }

    // Count only this provider's instances: `tried` spans the whole request
    // (a cascade can visit several providers), so comparing its raw size to
    // this provider's account count would falsely report exhaustion when an
    // earlier provider in the same request already used up accounts.
    const tried = getTriedInstances(state);
    if (active) tried.add(active.id);
    // The tried-set is request-global and shared across providers after a
    // pack hop, so exhaustion must count only this provider's ids.
    const triedForProvider = accounts.filter(account => tried.has(account.id)).length;
    if (triedForProvider >= accounts.length) {
      return this.declarePoolUnavailable(args, providerId, 'pool-exhausted');
    }

    // Activate the first untried instance explicitly. Storage's own cursor
    // rotation follows insertion order from wherever it currently sits, which
    // can hand back an account this request already tried.
    const candidate = accounts.find(account => !tried.has(account.id));
    const next = candidate ? store.activateAccount?.(providerId, candidate.id) : undefined;
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
  /**
   * The request's pack cascade, computed once from the session's pack and
   * cached in processor state. Truncated at the first pack that lacks the
   * session mode's model — mirroring getDynamicModel's truncation — so the
   * cascade never promises a hop core's fallback array cannot make. The
   * position advances per hop, so a second hop in the same turn reports B→C
   * even though the session modelId still points at pack A (stickiness lands
   * TUI-side only after the part renders). Returns null when the session has
   * no active pack or the pack has no fallback chain.
   */
  private async getPackCascade(args: ProcessAPIErrorArgs): Promise<PackCascade | null> {
    if (args.state.packCascade !== undefined) {
      return (args.state.packCascade as PackCascade | null) ?? null;
    }
    const controller = args.requestContext?.get('controller') as
      | { session?: { modelId?: unknown; modeId?: unknown }; getState?: () => { activeModelPackId?: unknown } }
      | undefined;
    const modelId = controller?.session?.modelId;
    if (typeof modelId !== 'string' || modelId.length === 0) {
      args.state.packCascade = null;
      return null;
    }
    const modeId =
      typeof controller?.session?.modeId === 'string' && controller.session.modeId.length > 0
        ? controller.session.modeId
        : 'build';
    const settings = loadSettings(this.options.settingsPath);
    const packs = listResolvableModePacks(settings);
    const statePackId = controller?.getState?.()?.activeModelPackId ?? settings.models.activeModelPackId;
    const activePack = findModePackForModel(
      settings,
      packs,
      modelId,
      modeId,
      typeof statePackId === 'string' ? statePackId : undefined,
    );
    const chain = activePack
      ? resolveModePackFallbackChain(settings.models.packFallbacks ?? {}, activePack.id, settings.customModelPacks)
      : [];
    if (chain.length < 2) {
      args.state.packCascade = null;
      return null;
    }
    const resolvedPacks: Array<{ packId: string; label: string }> = [];
    const models: Record<string, Record<string, string>> = {};
    for (const packId of chain) {
      const pack = packs.find(candidate => candidate.id === packId);
      const packModels = pack ? resolveModePackModels(settings, pack) : {};
      if (resolvedPacks.length > 0) {
        const entryModelId = packModels[modeId];
        if (!entryModelId) break;
        // Mirror getDynamicModel's truncation: an entry whose model cannot
        // resolve (e.g. unconnected provider in deployed fail-closed mode)
        // ends the cascade here so a later hop is never announced for a pack
        // core's fallback array cannot reach.
        try {
          resolveModel(entryModelId, { remapForCodexOAuth: true, requestContext: args.requestContext });
        } catch {
          break;
        }
      }
      resolvedPacks.push({ packId, label: pack?.name ?? packId });
      models[packId] = packModels;
    }
    if (resolvedPacks.length < 2) {
      args.state.packCascade = null;
      return null;
    }
    const cascade: PackCascade = { packs: resolvedPacks, models, modeId, position: 0 };
    args.state.packCascade = cascade;
    return cascade;
  }

  /**
   * Q14 gate: 400/unknown/unattributable errors never hop packs. Core's
   * fallback array advances on ANY thrown error except TripWire
   * (llm-execution-step.ts), so when the session's pack has a chain and the
   * current entry is non-last, a bare `retry: false` would silently hop on an
   * error class the user excluded from hop triggers. TripWire is the only
   * no-advance escape: the runner rethrows it and the fallback loop declines
   * to advance. No chain (or already on the last entry) → return and let the
   * plain `retry: false` surface the error exactly as before.
   */
  private async gateChainHop(args: ProcessAPIErrorArgs, error: unknown): Promise<void> {
    const cascade = await this.getPackCascade(args);
    if (!cascade) return;
    if (cascade.position >= cascade.packs.length - 1) return;
    const reason = error instanceof Error ? error.message : String(error);
    throw new TripWire(reason, {}, this.id);
  }

  /**
   * Emit the pack-fallback part when a configured chain has a next pack and
   * queue the thread stickiness trigger. Core's fallback array does the hop
   * itself on `retry: false`; this only announces it. The cascade is
   * truncated exactly like getDynamicModel's chain (missing mode model or
   * unresolvable model), so an announced hop is always one core can make;
   * the toModelId guard stays as defense against a stale cache.
   */
  private async emitPackFallbackPart(
    args: ProcessAPIErrorArgs,
    reason: 'pool-exhausted' | 'persistent-outage',
  ): Promise<void> {
    const cascade = await this.getPackCascade(args);
    if (!cascade) return;

    const from = cascade.packs[cascade.position];
    const to = cascade.packs[cascade.position + 1];
    if (!from || !to) return;
    const toModelId = cascade.models[to.packId]?.[cascade.modeId];
    if (!toModelId) return;

    const controller = args.requestContext?.get('controller') as
      | {
          session?: { modeId?: unknown };
          threadId?: unknown;
          setState?: (updates: Record<string, unknown>) => Promise<void>;
          setThreadSetting?: (setting: { key: string; value: unknown }) => Promise<void>;
          emitEvent?: (event: { type: 'info'; message: string }) => void;
        }
      | undefined;
    const at = new Date().toISOString();
    const threadId = typeof controller?.threadId === 'string' ? controller.threadId : undefined;
    const pending = {
      fromPackId: from.packId,
      toPackId: to.packId,
      toModelId,
      ...(threadId ? { threadId } : {}),
      reason,
      at,
    } satisfies PendingPackFallback;
    // Persist the pending hop before announcing it. The TUI clears this marker
    // only after applying every model/pack write, so a crash or immediate
    // retrigger resumes on the landed fallback instead of the failed pack.
    await controller?.setThreadSetting?.({ key: PACK_FALLBACK_STATE_KEY, value: pending });
    const data: PackFallbackPartData = { from, to, reason, at };
    try {
      // Persist the transcript notice before notifying live state listeners.
      // Session events do not await async handlers, so reversing these writes
      // can apply a pack hop that never receives its required transcript part.
      await args.writer?.custom({ type: PACK_FALLBACK_PART_TYPE, data });
    } catch (error) {
      await controller?.setThreadSetting?.({ key: PACK_FALLBACK_STATE_KEY, value: undefined });
      throw error;
    }
    // Keep the durable marker if live state persistence fails: the transcript
    // already records the hop and thread hydration can safely resume it.
    await controller?.setState?.({ [PACK_FALLBACK_STATE_KEY]: pending });
    // Live visibility: data parts never ride controller message events, so
    // emit the same line as an info event (see emitAccountSwitchPart).
    controller?.emitEvent?.({ type: 'info', message: packFallbackNoticeText(data) });
    // Advance only after the part and stickiness landed — a throw mid-emit
    // must not desync the cascade from what the transcript shows.
    cascade.position++;
  }

  private async declarePoolUnavailable(
    args: ProcessAPIErrorArgs,
    providerId: string,
    reason: 'pool-exhausted' | 'persistent-outage',
  ): Promise<{ retry: boolean }> {
    const store = resolveCredentialStore(args.requestContext) ?? this.options.credentialStore;
    const accounts = store.listAccounts?.(providerId) ?? [];
    if (accounts.length === 0) {
      // No account registry (API-key-only provider): nothing rotated, but the
      // hop still happens — announce the pack fallback before core advances.
      await this.emitPackFallbackPart(args, reason);
      return { retry: false };
    }

    const tried = getTriedInstances(args.state);
    for (const account of accounts) tried.add(account.id);

    const active = store.getActiveAccount?.(providerId) ?? accounts.find(account => account.active);

    await emitAccountSwitchPart(args, {
      provider: providerId,
      from: active ? { id: active.id, label: active.label } : null,
      to: null,
      reason,
      at: new Date().toISOString(),
    });

    await this.emitPackFallbackPart(args, reason);

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

    // Deployed requests resolve the tenant-scoped store so host accounts are
    // never listed or announced for a tenant run.
    const store = resolveCredentialStore(args.requestContext) ?? this.options.credentialStore;

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
