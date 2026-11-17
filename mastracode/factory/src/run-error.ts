import { PROVIDER_AUTH_REQUIRED_ERROR } from '@mastra/code-sdk/auth/provider-auth-error';
import { MASTRA_GATEWAY_PREFIX } from '@mastra/code-sdk/providers/model-ids';
import {
  classifyProviderError,
  PROVIDER_CALL_ERROR_NAME,
  providerErrorReason,
  providerModelId,
} from '@mastra/core/error';

export type RunErrorRecovery = 'continue' | 'credentials' | 'credits' | 'model' | 'new_session';

export interface RunErrorDescription {
  title: string;
  message: string;
  recoveries: RunErrorRecovery[];
  model?: string;
}

export interface RunErrorIdentity {
  name: string;
  message: string;
}

const UNEXPECTED_ERROR = 'An unexpected error stopped the run. Copy the error details to investigate.';
const NO_REASON_AVAILABLE =
  'The provider rejected the request. A specific reason isn’t available here. Copy the error details and check the server logs.';

export interface DescribeRunErrorOptions {
  /**
   * The Mastra Gateway base URL this server sends requests to. Requests to its host are recognized as
   * gateway replies, so a staging, local or self-hosted gateway is handled like the production one.
   */
  gatewayBaseUrl?: string;
}

export function describeRunError(error: RunErrorIdentity, options: DescribeRunErrorOptions = {}): RunErrorDescription {
  return { ...explainRunError(error, options), model: providerModelId(error) };
}

const CONTEXT_OVERFLOW: Omit<RunErrorDescription, 'model'> = {
  title: 'Conversation exceeds the model’s limit',
  message: 'Choose a model with a larger context window or start a new session with a shorter prompt.',
  recoveries: ['model', 'new_session'],
};

function explainRunError(
  error: RunErrorIdentity,
  options: DescribeRunErrorOptions,
): Omit<RunErrorDescription, 'model'> {
  if (error.name === PROVIDER_AUTH_REQUIRED_ERROR) {
    return { title: 'Provider sign-in required', message: error.message, recoveries: ['credentials', 'model'] };
  }
  const kind = classifyProviderError(error);
  const gateway = gatewayReply(error);
  if (isMastraGatewayError(error, gateway, options)) {
    const refusal = explainGatewayRefusal(kind, gateway);
    if (refusal) return refusal;
  }
  switch (kind) {
    case 'quota':
      return {
        title: 'Provider quota exhausted',
        message: afterProviderReason(
          error,
          'Check the provider account’s billing or usage allowance, or use another credential or model.',
        ),
        recoveries: ['credentials', 'model'],
      };
    case 'auth':
      return {
        title: 'Provider access failed',
        message: afterProviderReason(error, 'Review the credentials and model access configured for this session.'),
        recoveries: ['credentials', 'model'],
      };
    case 'context_overflow':
      return CONTEXT_OVERFLOW;
    case 'model_rejected':
      return {
        title: 'Model not available',
        message: afterProviderReason(
          error,
          'Choose another model for this session.',
          'The provider rejected this model.',
        ),
        recoveries: ['model'],
      };
    case 'tool_history_rejected':
      return {
        title: 'Conversation history rejected',
        message:
          'The provider could not match a tool call with its result. Start a new session to keep working, and copy the error details so this session can be investigated.',
        recoveries: ['new_session'],
      };
    case 'invalid_request':
      return {
        title: 'Model request rejected',
        message: providerErrorReason(error) ?? NO_REASON_AVAILABLE,
        recoveries: ['model'],
      };
    case 'timeout':
      return {
        title: 'Request timed out',
        message: 'The request took too long to complete. Send a message to continue the run.',
        recoveries: ['continue'],
      };
    case 'rate_limited':
      return {
        title: 'Provider rate limit reached',
        message:
          'The provider account behind this session’s credential hit a rate or usage limit. Continue once it resets, or use another credential or model.',
        recoveries: ['continue', 'credentials', 'model'],
      };
    case 'unavailable':
      return {
        title: 'Model provider temporarily unavailable',
        message:
          'The provider could not complete the request. Send a message to continue the run, or choose another model.',
        recoveries: ['continue', 'model'],
      };
    case 'unknown':
      return describeUnclassifiedError(error);
  }
}

const MASTRA_GATEWAY_HOST = /(?:^|\.)gateway(?:-api)?\.mastra\.ai$/;

/** What a Mastra Gateway refusal says about itself: `{"error":{"type":"gateway_error","code":"…","message":"…"}}`. */
interface GatewayReply {
  type?: string;
  code?: string;
  /** The gateway's own sentence, when it wrote one instead of repeating the code. */
  message?: string;
}

const OUT_OF_CREDITS = new Set(['insufficient_credit', 'credit_balance_exhausted']);
const ORGANIZATION_BUDGET_EXHAUSTED = 'organization_budget_exhausted';
const ORGANIZATION_BUDGET_SHORT = new Set([
  'organization_budget_insufficient',
  'organization_budget_unbounded_request',
]);
const SPEND_LIMIT_REACHED = new Set(['key_budget_exhausted', 'spend_limit_reached']);
const BILLING_OVERAGE_UNSUPPORTED = 'billing_overage_unsupported';
/** Routing policy refusals: the key was accepted, but no route it may use serves this model or feature. */
const ROUTE_REFUSED = new Set([
  'no_eligible_route',
  'model_not_allowed',
  'no_route_in_region',
  'provider_reference_requires_bound_route',
  'response_origin_route_unavailable',
  'thinking_origin_route_unavailable',
  'thinking_verification_route_unavailable',
]);
const GATEWAY_CONTEXT_OVERFLOW = new Set(['context_too_large', 'context_unaccountable']);
const UPSTREAM_RATE_LIMITED = 'provider_rate_limited';
const BUDGET_CAPACITY_HELD = new Set(['key_budget_capacity_held', 'organization_budget_capacity_held']);
const GATEWAY_RATE_LIMITED = 'rate_limit_exceeded';

/** Reason codes only the Mastra Gateway sends, so a reply carrying one came from it. */
const GATEWAY_REASON_CODES = new Set([
  'insufficient_credit',
  ORGANIZATION_BUDGET_EXHAUSTED,
  ...ORGANIZATION_BUDGET_SHORT,
  ...SPEND_LIMIT_REACHED,
  BILLING_OVERAGE_UNSUPPORTED,
  ...ROUTE_REFUSED,
  ...GATEWAY_CONTEXT_OVERFLOW,
  UPSTREAM_RATE_LIMITED,
  ...BUDGET_CAPACITY_HELD,
]);

const STARTING_BUDGET =
  'An organization that has not added credits yet has a small starting budget, and adding credits lifts it.';
const ADD_CREDITS_THEN_CONTINUE = 'Add credits, then continue the run, or choose another model.';

/** The gateway's own description of a refusal it recognized, or undefined to describe it like any provider error. */
function explainGatewayRefusal(
  kind: ReturnType<typeof classifyProviderError>,
  reply: GatewayReply | undefined,
): Omit<RunErrorDescription, 'model'> | undefined {
  const code = reply?.code;
  const said = (fallback: string, next: string) => `${(reply?.message ?? fallback).replace(/\.?$/, '.')} ${next}`;
  if (code && GATEWAY_CONTEXT_OVERFLOW.has(code)) return CONTEXT_OVERFLOW;
  if (code === ORGANIZATION_BUDGET_EXHAUSTED) {
    return {
      title: 'Mastra Gateway budget reached',
      message: said(
        `Your organization has used its Mastra Gateway budget. ${STARTING_BUDGET} If your organization has already added credits, an organization admin can raise its spend limit`,
        ADD_CREDITS_THEN_CONTINUE,
      ),
      recoveries: ['credits', 'continue', 'model'],
    };
  }
  if (code && ORGANIZATION_BUDGET_SHORT.has(code)) {
    return {
      title: 'Mastra Gateway budget reached',
      message: said(
        `This request needs more than your organization has left in its Mastra Gateway budget. ${STARTING_BUDGET}`,
        ADD_CREDITS_THEN_CONTINUE,
      ),
      recoveries: ['credits', 'continue', 'model'],
    };
  }
  if (code && SPEND_LIMIT_REACHED.has(code)) {
    return {
      title: 'Mastra Gateway spend limit reached',
      message: said(
        'A spend limit set on this gateway key or your organization was reached, and adding credits does not raise it',
        'Ask an organization admin to raise the limit, or choose another model.',
      ),
      recoveries: ['model'],
    };
  }
  if (code === BILLING_OVERAGE_UNSUPPORTED) {
    return {
      title: 'Usage not covered by the billing plan',
      message: said(
        'Your organization’s billing plan does not allow this Mastra Gateway usage',
        'Choose another model, or ask an organization admin to review the plan.',
      ),
      recoveries: ['model'],
    };
  }
  if (kind === 'quota') {
    // A credit refusal from v1, or a v2 code this version does not know yet.
    return {
      title: 'Out of Mastra Gateway credits',
      message: OUT_OF_CREDITS.has(code ?? '')
        ? said('Your organization has no gateway credits left', ADD_CREDITS_THEN_CONTINUE)
        : `Your organization has no gateway credits left. ${ADD_CREDITS_THEN_CONTINUE}`,
      recoveries: ['credits', 'continue', 'model'],
    };
  }
  // Any other refusal of the key or connection keeps the credential recovery.
  if (kind === 'auth' && code !== undefined && ROUTE_REFUSED.has(code)) {
    return {
      title: 'Model not available through the Mastra Gateway',
      message: said(
        'The Mastra Gateway has no route your organization may use for this model or feature',
        'Choose another model for this session.',
      ),
      recoveries: ['model'],
    };
  }
  if (kind !== 'rate_limited') return undefined;
  if (code === UPSTREAM_RATE_LIMITED) {
    return {
      title: 'Model provider rate limit reached',
      message: said(
        'The model provider behind the Mastra Gateway is limiting requests',
        'Continue shortly, or choose another model.',
      ),
      recoveries: ['continue', 'model'],
    };
  }
  if (code && BUDGET_CAPACITY_HELD.has(code)) {
    return {
      title: 'Mastra Gateway budget busy',
      message: said(
        'Requests still in flight hold the rest of the gateway budget for this key or organization',
        'Continue in a few seconds, or choose another model.',
      ),
      recoveries: ['continue', 'model'],
    };
  }
  // The gateway's limit reply pairs these two; a provider reply relayed through it names its own type.
  const gatewayLimit = code === GATEWAY_RATE_LIMITED && reply?.type === 'rate_limit_error';
  if (gatewayLimit || reply?.type === 'gateway_error') {
    // The gateway's own limit on the key or organization, not the provider account's.
    return {
      title: 'Mastra Gateway rate limit reached',
      message: said(
        'The gateway’s rate limit for this key or organization was reached',
        'Continue once it resets, or choose another model.',
      ),
      recoveries: ['continue', 'model'],
    };
  }
  // A provider's own limit relayed through the gateway: the provider account is the gateway's route,
  // not one of this session's credentials, and the relayed text names no one.
  return {
    title: 'Model provider rate limit reached',
    message:
      'The model provider behind the Mastra Gateway is limiting requests. Continue shortly, or choose another model.',
    recoveries: ['continue', 'model'],
  };
}

/**
 * The Mastra Gateway answered: a `mastra/…` model, a request sent to its host (production, or the
 * configured base URL), a v1 billing reply (which links to `gateway.mastra.ai`), or a v2 reply naming
 * itself a gateway error or carrying a reason code only the gateway sends. The request reaches the
 * gateway without the `mastra/` prefix, and history keeps no request URL, so the web UI rebuilds a saved
 * error from its request origin, when one was recorded, and otherwise from the reply body.
 */
function isMastraGatewayError(
  error: RunErrorIdentity,
  reply: GatewayReply | undefined,
  options: DescribeRunErrorOptions,
): boolean {
  return (
    providerModelId(error)?.startsWith(MASTRA_GATEWAY_PREFIX) === true ||
    calledMastraGateway(error, configuredGatewayHost(options.gatewayBaseUrl)) ||
    /gateway\.mastra\.ai/.test(providerErrorReason(error) ?? error.message) ||
    reply?.type === 'gateway_error' ||
    (reply?.code !== undefined && GATEWAY_REASON_CODES.has(reply.code))
  );
}

function configuredGatewayHost(baseUrl: string | undefined): string | undefined {
  if (!baseUrl) return undefined;
  try {
    return new URL(baseUrl).host || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Whether the request, or a provider error it wraps, went to the gateway's host. A saved error part
 * keeps no URL, only the request's origin as `requestOrigin` on versions of `@mastra/core` that record it.
 */
function calledMastraGateway(error: unknown, configuredHost: string | undefined, depth = 0): boolean {
  if (depth > 4 || typeof error !== 'object' || error === null) return false;
  const url = 'url' in error ? error.url : 'requestOrigin' in error ? error.requestOrigin : undefined;
  const cause = 'cause' in error ? error.cause : undefined;
  return (
    (typeof url === 'string' && isGatewayUrl(url, configuredHost)) ||
    calledMastraGateway(cause, configuredHost, depth + 1)
  );
}

function isGatewayUrl(url: string, configuredHost: string | undefined): boolean {
  try {
    const parsed = new URL(url);
    return (
      MASTRA_GATEWAY_HOST.test(parsed.hostname) || (configuredHost !== undefined && parsed.host === configuredHost)
    );
  } catch {
    return false;
  }
}

/**
 * The gateway's error object from the response body, on the error or a cause it wraps, with the codes
 * a saved error part keeps as a fallback. The Messages route sends no `code` and repeats the code as
 * the message, so a code-shaped message is read as the code.
 */
function gatewayReply(error: unknown, depth = 0): GatewayReply | undefined {
  if (depth > 4 || typeof error !== 'object' || error === null) return undefined;
  const fromBody = 'responseBody' in error ? replyFromBody(error.responseBody) : undefined;
  if (fromBody) return fromBody;
  const fromCause = gatewayReply('cause' in error ? error.cause : undefined, depth + 1);
  if (fromCause) return fromCause;
  const codes = 'codes' in error && Array.isArray(error.codes) ? error.codes.filter(isString) : [];
  const code = codes.find(candidate => GATEWAY_REASON_CODES.has(candidate));
  if (code || codes.includes('gateway_error')) {
    return { ...(codes.includes('gateway_error') ? { type: 'gateway_error' } : {}), ...(code ? { code } : {}) };
  }
  return undefined;
}

const CODE_SHAPED = /^[a-z][a-z0-9_]*$/;

function replyFromBody(body: unknown): GatewayReply | undefined {
  if (typeof body !== 'string') return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return undefined;
  }
  const inner = typeof parsed === 'object' && parsed !== null && 'error' in parsed ? parsed.error : undefined;
  if (typeof inner !== 'object' || inner === null) return undefined;
  const type = 'type' in inner && isString(inner.type) ? inner.type : undefined;
  const rawMessage = 'message' in inner && isString(inner.message) ? inner.message.trim() : undefined;
  const code =
    'code' in inner && isString(inner.code)
      ? inner.code
      : type === 'gateway_error' && rawMessage && CODE_SHAPED.test(rawMessage)
        ? rawMessage
        : undefined;
  const message = rawMessage && rawMessage !== code && !CODE_SHAPED.test(rawMessage) ? rawMessage : undefined;
  if (!type && !code) return undefined;
  return { ...(type ? { type } : {}), ...(code ? { code } : {}), ...(message ? { message } : {}) };
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function afterProviderReason(error: RunErrorIdentity, next: string, fallback?: string): string {
  const reason = providerErrorReason(error) ?? fallback;
  return reason ? `${reason.replace(/\.?$/, '.')} ${next}` : next;
}

function describeUnclassifiedError(error: RunErrorIdentity): Omit<RunErrorDescription, 'model'> {
  const message = providerErrorReason(error) ?? (error.message || UNEXPECTED_ERROR);
  const providerCall = PROVIDER_CALL_ERROR_NAME.test(error.name);
  return {
    title: providerCall ? 'Model request failed' : 'Run stopped',
    message,
    recoveries: providerCall ? ['model'] : [],
  };
}
