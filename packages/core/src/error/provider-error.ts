// Reads an APICallError, a raw stream error frame, a cause chain or the persisted
// `{ name, message, statusCode?, code? }` identity. The status and symbolic codes are the provider's
// verdict; wording only narrows an invalid request, or speaks when the provider named nothing.
export type ProviderFailureKind =
  | 'auth'
  | 'quota'
  | 'rate_limited'
  | 'context_overflow'
  | 'model_rejected'
  | 'tool_history_rejected'
  | 'timeout'
  | 'unavailable'
  | 'invalid_request'
  | 'unknown';

export interface ProviderErrorFacts {
  statusCode?: number;
  code?: string;
  /** The innermost sentence behind HTTP phrases, envelopes, stringified layers and causes, when it differs from the message. */
  reason?: string;
}

const MAX_OBJECT_DEPTH = 4;
const ENVELOPE_TYPES = new Set(['error', 'response.failed']);
const SYMBOLIC_STATUS = /^[A-Z][A-Z0-9_]+$/;

const BILLING_EXHAUSTED =
  /insufficient[_ ]quota|insufficient (?:balance|credits?)|credits? exhausted|credit balance|payment required/i;
const USAGE_CAPPED =
  /usage (?:limit|cap)|quota (?:exceeded|exhausted|reached)|exceeded (?:your )?current quota|weekly limit|monthly limit/i;
// A cap that refills within the hour is a rate limit, whatever the provider calls it.
const RENEWS_WITHIN_THE_HOUR = /per[_ -]?(?:second|minute|hour|min|sec)\b|\b[rt]pm\b/i;
const ACCESS_DENIED =
  /invalid[_ ]api[_ ]key|incorrect api key|api key not valid|unauthorized|authentication|forbidden|permission[_ ]?(?:denied|error)|access[_ ]?denied/i;
const CONTEXT_OVERFLOW = [
  /context[_ ]length[_ ]exceeded/i,
  /maximum context length/i,
  /maximum prompt length/i,
  /prompt is too long/i,
  /input is too long/i,
  /exceed\w*\b[^.]{0,40}\bcontext (?:window|length|limit|size)/i,
  /input token count[^.]{0,40}exceeds the maximum/i,
  /reduce the length of the (?:messages|prompt|input)/i,
];
const MODEL_REJECTED =
  /model_not_found|model not found|no[_ ]?such[_ ]?model|not_found_error|invalid[_ ]model|unsupported[_ ]parameter|unsupported[_ ]value/i;
const TOOL_HISTORY_REJECTED =
  /no tool output found for (?:function|tool) call|tool_call_ids.*(?:response|respond)|tool_use.*tool_result/i;
const INVALID_REQUEST_CODE = /invalid_request_error|invalid_prompt/i;
const TIMED_OUT = /timed ?out|timeout|deadline[_ ]exceeded/i;
const RATE_LIMITED = /rate[_ ]limit|too many requests|resource_exhausted|throttl/i;
const UNAVAILABLE =
  /internal server error|server_error|internal_error|service[_ ]?unavailable|temporarily[_ ]?unavailable|bad gateway|overloaded/i;
// What an HTTP client reports when the body said nothing; not a reason a person can act on.
const HTTP_REASON_PHRASE =
  /^(?:bad request|unauthorized|payment required|forbidden|not found|method not allowed|request timeout|conflict|unprocessable (?:entity|content)|too many requests|internal server error|bad gateway|service unavailable|gateway timeout)\.?$/i;

interface CollectedFacts {
  statusCode?: number;
  codes: string[];
  texts: string[];
  seen: WeakSet<object>;
}

function readField(record: object, key: string): unknown {
  try {
    return (record as Record<string, unknown>)[key];
  } catch {
    return undefined;
  }
}

function parseJsonObject(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed.startsWith('{')) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
}

function collect(value: unknown, facts: CollectedFacts, depth: number): void {
  if (depth > MAX_OBJECT_DEPTH || value === null || value === undefined) return;
  if (typeof value === 'string') {
    facts.texts.push(value);
    collect(parseJsonObject(value), facts, depth);
    return;
  }
  if (typeof value !== 'object' || facts.seen.has(value)) return;
  facts.seen.add(value);

  const status = readField(value, 'statusCode') ?? readField(value, 'status');
  if (typeof status === 'number' && facts.statusCode === undefined) facts.statusCode = status;
  // Google puts the HTTP status in `error.code` and a symbolic status in `error.status`; a lifecycle `status: 'failed'` names nothing.
  if (typeof status === 'string' && SYMBOLIC_STATUS.test(status.trim())) facts.codes.push(status.trim());
  const code = readField(value, 'code');
  if (typeof code === 'number' && facts.statusCode === undefined && code >= 400 && code < 600) facts.statusCode = code;
  for (const candidate of [code, readField(value, 'type')]) {
    if (typeof candidate === 'string' && candidate.trim() && !ENVELOPE_TYPES.has(candidate))
      facts.codes.push(candidate);
  }
  const name = readField(value, 'name');
  if (typeof name === 'string') facts.texts.push(name);
  for (const key of ['message', 'reason', 'responseBody']) collect(readField(value, key), facts, depth);
  for (const key of ['error', 'data', 'response', 'cause']) collect(readField(value, key), facts, depth + 1);
}

function collectFacts(error: unknown): CollectedFacts {
  const facts: CollectedFacts = { codes: [], texts: [], seen: new WeakSet() };
  collect(error, facts, 0);
  return facts;
}

export function classifyProviderError(error: unknown): ProviderFailureKind {
  const facts = collectFacts(error);
  const evidence = [...facts.codes, ...facts.texts].join('\n');
  const verdict = providerVerdict(facts.statusCode, facts.codes.join('\n'), evidence);
  if (verdict === 'invalid_request') return narrowInvalidRequest(evidence);
  if (verdict) return verdict;
  return (
    usageKind(evidence) ??
    terminalKindFromWording(evidence) ??
    transientKindFromWording(evidence) ??
    (facts.texts.some(text => HTTP_REASON_PHRASE.test(text.trim())) ? 'invalid_request' : 'unknown')
  );
}

function providerVerdict(status: number | undefined, codes: string, evidence: string): ProviderFailureKind | undefined {
  if (status === 401 || status === 403 || ACCESS_DENIED.test(codes)) return 'auth';
  if (status === 402 || BILLING_EXHAUSTED.test(codes)) return 'quota';
  // Token-per-minute limits are 429s whose message asks to shorten the request; waiting is the fix.
  if (status === 429 || RATE_LIMITED.test(codes)) return usageKind(evidence) ?? 'rate_limited';
  if (status === 408 || status === 504 || TIMED_OUT.test(codes)) return 'timeout';
  if ((status !== undefined && status >= 500) || UNAVAILABLE.test(codes)) return 'unavailable';
  if (status === 400 || status === 404 || status === 422 || INVALID_REQUEST_CODE.test(codes)) return 'invalid_request';
  return undefined;
}

// A request the provider named invalid is final; its wording may only say which final kind.
function narrowInvalidRequest(evidence: string): ProviderFailureKind {
  // Anthropic reports an exhausted credit balance as a 400 invalid request.
  if (BILLING_EXHAUSTED.test(evidence)) return 'quota';
  return terminalKindFromWording(evidence) ?? 'invalid_request';
}

function usageKind(evidence: string): 'quota' | 'rate_limited' | undefined {
  if (BILLING_EXHAUSTED.test(evidence)) return 'quota';
  if (USAGE_CAPPED.test(evidence)) return RENEWS_WITHIN_THE_HOUR.test(evidence) ? 'rate_limited' : 'quota';
  return undefined;
}

function terminalKindFromWording(evidence: string): ProviderFailureKind | undefined {
  if (ACCESS_DENIED.test(evidence)) return 'auth';
  if (CONTEXT_OVERFLOW.some(pattern => pattern.test(evidence))) return 'context_overflow';
  if (MODEL_REJECTED.test(evidence)) return 'model_rejected';
  if (TOOL_HISTORY_REJECTED.test(evidence)) return 'tool_history_rejected';
  if (INVALID_REQUEST_CODE.test(evidence)) return 'invalid_request';
  return undefined;
}

function transientKindFromWording(evidence: string): ProviderFailureKind | undefined {
  if (TIMED_OUT.test(evidence)) return 'timeout';
  if (RATE_LIMITED.test(evidence)) return 'rate_limited';
  if (UNAVAILABLE.test(evidence)) return 'unavailable';
  return undefined;
}

/** The JSON-safe facts worth carrying next to a failure's name and message, on the wire and in history. */
export function providerErrorFacts(error: unknown): ProviderErrorFacts {
  const facts = collectFacts(error);
  const result: ProviderErrorFacts = {};
  if (facts.statusCode !== undefined) result.statusCode = facts.statusCode;
  const code = decisiveCode(facts.codes);
  if (code) result.code = code;
  const message = typeof error === 'object' && error !== null ? readField(error, 'message') : error;
  const reason = innermostReason(error, 0);
  if (reason !== undefined && reason !== (typeof message === 'string' ? message.trim() : undefined))
    result.reason = reason;
  return result;
}

/** The innermost sentence a provider wrote for a person, unwrapped from envelopes, stringified layers and causes. */
export function providerErrorReason(error: unknown): string | undefined {
  return innermostReason(error, 0);
}

function innermostReason(error: unknown, depth: number): string | undefined {
  if (depth > MAX_OBJECT_DEPTH || error === null || error === undefined) return undefined;
  if (typeof error === 'string') {
    const trimmed = error.trim();
    const parsed = parseJsonObject(trimmed);
    if (parsed !== undefined) return innermostReason(parsed, depth);
    return !trimmed || HTTP_REASON_PHRASE.test(trimmed) ? undefined : trimmed;
  }
  if (typeof error !== 'object') return undefined;
  const own = innermostReason(readField(error, 'reason'), depth);
  if (own) return own;
  for (const key of ['error', 'response', 'data', 'cause']) {
    const nested = innermostReason(readField(error, key), depth + 1);
    if (nested) return nested;
  }
  const body = readField(error, 'responseBody');
  const bodyReason = typeof body === 'string' ? innermostReason(parseJsonObject(body), depth) : undefined;
  if (bodyReason) return bodyReason;
  const message = readField(error, 'message');
  return typeof message === 'string' ? innermostReason(message, depth) : undefined;
}

// Same precedence as providerVerdict and the narrowing, so the one code kept decides like the live error.
const CODE_PRECEDENCE = [
  ACCESS_DENIED,
  BILLING_EXHAUSTED,
  RATE_LIMITED,
  TIMED_OUT,
  UNAVAILABLE,
  INVALID_REQUEST_CODE,
  MODEL_REJECTED,
  ...CONTEXT_OVERFLOW,
];

function decisiveCode(codes: string[]): string | undefined {
  for (const pattern of CODE_PRECEDENCE) {
    const code = codes.find(candidate => pattern.test(candidate));
    if (code) return code;
  }
  return codes[0];
}
