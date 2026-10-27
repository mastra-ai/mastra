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

const MAX_REASON_LENGTH = 2000;
const MAX_OBJECT_DEPTH = 4;
const ENVELOPE_TYPES = new Set(['error', 'response.failed']);
const SYMBOLIC_STATUS = /^[A-Z][A-Z0-9_]+$/;

const BILLING_EXHAUSTED =
  /insufficient[_ ]quota|insufficient (?:balance|credits?)|credits? exhausted|credit balance|payment required/i;
const USAGE_CAPPED =
  /usage (?:limit|cap)|quota (?:exceeded|exhausted|reached)|exceeded (?:your )?current quota|weekly limit|monthly limit/i;
// A cap that refills within the hour is a rate limit, whatever the provider calls it.
const RENEWS_WITHIN_THE_HOUR = /per[_ -]?(?:second|minute|hour|min|sec)\b|\b[rt]pm\b/i;
const ACCESS_DENIED_WORDING =
  /invalid[_ ]api[_ ]key|incorrect api key|api key not valid|authentication[_ ]error|permission[_ ]?(?:denied|error)|access[_ ]?denied/i;
// Bare "unauthorized" or "forbidden" in free text can come from any service a run touches, not only the model provider.
const ACCESS_DENIED_CODE = new RegExp(`${ACCESS_DENIED_WORDING.source}|unauthorized|authentication|forbidden`, 'i');
const CONTEXT_OVERFLOW = [
  /context[_ ]length[_ ]exceeded/i,
  /maximum context length/i,
  /maximum prompt length/i,
  /prompt is too long/i,
  /input is too long/i,
  /exceed(?:s|ed|ing)?\b[^.]{0,40}\bcontext (?:window|length|limit|size)/i,
  /input token count[^.]{0,40}exceeds the maximum/i,
  /reduce the length of the (?:messages|prompt|input)/i,
];
const MODEL_REJECTED =
  /model_not_found|model not found|no[_ ]?such[_ ]?model|not_found_error|invalid[_ ]model|unsupported[_ ]model|\bmodel\b[^.]{0,40}\bis not supported\b|unsupported[_ ]parameter|unsupported[_ ]value/i;
const TOOL_HISTORY_REJECTED =
  /no tool output found for (?:function|tool) call|tool_call_ids[^.]{0,40}(?:response|respond)|tool_use[^.]{0,40}tool_result/i;
const INVALID_REQUEST_CODE = /invalid_request_error|invalid_prompt/i;
// The envelope type every OpenAI and Anthropic 400 carries; a code beside it is the provider naming the rejection.
const INVALID_REQUEST_ENVELOPE = /^invalid_request_error$/i;
const TIMED_OUT = /timed ?out|timeout|deadline[_ ]exceeded/i;
const RATE_LIMITED = /rate[_ ]limit|too many requests|resource_exhausted|throttl/i;
const UNAVAILABLE =
  /internal server error|server_error|internal_error|service[_ ]?unavailable|temporarily[_ ]?unavailable|bad gateway|overloaded/i;
const HTTP_REASON_PHRASE =
  /^(?:bad request|unauthorized|payment required|forbidden|not found|method not allowed|not acceptable|proxy authentication required|request timeout|conflict|gone|length required|precondition failed|(?:payload|content|request entity) too large|(?:request-)?uri too long|unsupported media type|(?:requested )?range not satisfiable|expectation failed|i'm a teapot|misdirected request|unprocessable (?:entity|content)|locked|failed dependency|too early|upgrade required|precondition required|too many requests|request header fields too large|unavailable for legal reasons|internal server error|not implemented|bad gateway|service unavailable|gateway timeout|http version not supported|variant also negotiates|insufficient storage|loop detected|not extended|network authentication required)\.?$/i;

// A provider call saved before its status was kept says only the HTTP phrase; elsewhere a bare phrase names nobody.
export const PROVIDER_CALL_ERROR_NAME = /^(?:AI_)?APICallError$/;
const ACCESS_DENIED_PHRASE = /^(?:unauthorized|forbidden)\.?$/i;
const REQUEST_ID_HEADERS = ['request-id', 'x-request-id'];
const MARKUP_OR_JSON = /^\s*[[{<]/;

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

  const statusCode = readField(value, 'statusCode');
  if (typeof statusCode === 'number' && Number.isInteger(statusCode)) facts.statusCode ??= statusCode;
  // Providers report `statusCode`, or Google's numeric `error.code`; a numeric `status` is GitHub's, a fetch response's or a storage client's.
  const code = readField(value, 'code');
  if (typeof code === 'number' && Number.isInteger(code) && code >= 400 && code < 600) facts.statusCode ??= code;
  // Google's symbolic `error.status` names the failure; a lifecycle `status: 'failed'` names nothing.
  const status = readField(value, 'status');
  if (typeof status === 'string' && SYMBOLIC_STATUS.test(status.trim())) facts.codes.push(status.trim());
  for (const candidate of [code, readField(value, 'type')]) {
    if (typeof candidate === 'string' && candidate.trim() && !ENVELOPE_TYPES.has(candidate))
      facts.codes.push(candidate);
  }
  const name = readField(value, 'name');
  if (typeof name === 'string') facts.texts.push(name);
  for (const key of ['message', 'reason', 'detail', 'responseBody']) collect(readField(value, key), facts, depth);
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
  if (verdict === 'invalid_request') return narrowInvalidRequest(evidence, facts.statusCode, facts.codes);
  if (verdict) return verdict;
  return (
    usageKind(evidence) ??
    terminalKindFromWording(evidence) ??
    transientKindFromWording(evidence) ??
    providerCallPhraseKind(error, facts.texts) ??
    'unknown'
  );
}

function providerCallPhraseKind(error: unknown, texts: string[]): ProviderFailureKind | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const name = readField(error, 'name');
  if (typeof name !== 'string' || !PROVIDER_CALL_ERROR_NAME.test(name)) return undefined;
  const message = readField(error, 'message');
  if (typeof message === 'string' && ACCESS_DENIED_PHRASE.test(message.trim())) return 'auth';
  return texts.some(text => HTTP_REASON_PHRASE.test(text.trim())) ? 'invalid_request' : undefined;
}

function providerVerdict(status: number | undefined, codes: string, evidence: string): ProviderFailureKind | undefined {
  if (status === 401 || status === 403 || ACCESS_DENIED_CODE.test(codes)) return 'auth';
  if (status === 402 || BILLING_EXHAUSTED.test(codes)) return 'quota';
  // Token-per-minute limits are 429s whose message asks to shorten the request; waiting is the fix.
  if (status === 429 || RATE_LIMITED.test(codes)) return usageKind(evidence) ?? 'rate_limited';
  if (status === 408 || status === 504 || TIMED_OUT.test(codes)) return 'timeout';
  if ((status !== undefined && status >= 500) || UNAVAILABLE.test(codes)) return 'unavailable';
  if (status === 400 || status === 404 || status === 422 || INVALID_REQUEST_CODE.test(codes)) return 'invalid_request';
  return undefined;
}

// A request the provider named invalid is final; its wording may only say which final kind.
function narrowInvalidRequest(evidence: string, status: number | undefined, codes: string[]): ProviderFailureKind {
  // Anthropic reports an exhausted credit balance as a 400 invalid request.
  if (BILLING_EXHAUSTED.test(evidence)) return 'quota';
  // Claude Max reports an exhausted usage cap as a 400 with no code of its own; a coded rejection, a 404 or a 422 names something else.
  const uncodedRejection = status === 400 && codes.every(code => INVALID_REQUEST_ENVELOPE.test(code));
  if (uncodedRejection && usageKind(evidence) === 'quota') return 'quota';
  return terminalKindFromWording(evidence) ?? 'invalid_request';
}

function usageKind(evidence: string): 'quota' | 'rate_limited' | undefined {
  if (BILLING_EXHAUSTED.test(evidence)) return 'quota';
  if (USAGE_CAPPED.test(evidence)) return RENEWS_WITHIN_THE_HOUR.test(evidence) ? 'rate_limited' : 'quota';
  return undefined;
}

function terminalKindFromWording(evidence: string): ProviderFailureKind | undefined {
  if (ACCESS_DENIED_WORDING.test(evidence)) return 'auth';
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

export function providerErrorReason(error: unknown): string | undefined {
  const reason = innermostReason(error, 0);
  return reason === undefined || reason.length <= MAX_REASON_LENGTH ? reason : `${reason.slice(0, MAX_REASON_LENGTH)}…`;
}

export function providerRequestId(error: unknown): string | undefined {
  return firstAlongCauses(error, requestIdOf, 0);
}

export function providerModelId(error: unknown): string | undefined {
  return firstAlongCauses(error, modelIdOf, 0);
}

function firstAlongCauses(
  error: unknown,
  read: (error: object) => string | undefined,
  depth: number,
): string | undefined {
  if (depth > MAX_OBJECT_DEPTH || typeof error !== 'object' || error === null) return undefined;
  return read(error) ?? firstAlongCauses(readField(error, 'cause'), read, depth + 1);
}

function requestIdOf(error: object): string | undefined {
  const kept = nonBlank(readField(error, 'requestId'));
  if (kept) return kept;
  const headers = readField(error, 'responseHeaders');
  if (typeof headers !== 'object' || headers === null) return undefined;
  for (const header of REQUEST_ID_HEADERS) {
    const value = nonBlank(readField(headers, header));
    if (value) return value;
  }
  return undefined;
}

function modelIdOf(error: object): string | undefined {
  const kept = nonBlank(readField(error, 'modelId'));
  if (kept) return kept;
  const requestBody = readField(error, 'requestBodyValues');
  return typeof requestBody === 'object' && requestBody !== null
    ? nonBlank(readField(requestBody, 'model'))
    : undefined;
}

function nonBlank(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
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
  for (const key of ['reason', 'detail']) {
    const own = readField(error, key);
    const ownReason = typeof own === 'string' ? innermostReason(own, depth) : undefined;
    if (ownReason) return ownReason;
  }
  for (const key of ['error', 'response', 'data']) {
    const nested = innermostReason(readField(error, key), depth + 1);
    if (nested) return nested;
  }
  const body = readField(error, 'responseBody');
  const bodyReason = typeof body === 'string' ? bodyExplanation(body, depth) : undefined;
  if (bodyReason) return bodyReason;
  const causeReason = reasonBehindCause(readField(error, 'cause'), depth + 1);
  if (causeReason) return causeReason;
  const message = readField(error, 'message');
  return typeof message === 'string' ? innermostReason(message, depth) : undefined;
}

function bodyExplanation(body: string, depth: number): string | undefined {
  const parsed = parseJsonObject(body);
  if (parsed !== undefined) return innermostReason(parsed, depth);
  return MARKUP_OR_JSON.test(body) ? undefined : innermostReason(body, depth);
}

// Walks wrapping causes to the first the provider produced, an HTTP response or a stream error frame; any other cause stays out of history.
function reasonBehindCause(cause: unknown, depth: number): string | undefined {
  if (depth > MAX_OBJECT_DEPTH || typeof cause !== 'object' || cause === null) return undefined;
  if (producedByProvider(cause)) return innermostReason(cause, depth);
  return reasonBehindCause(readField(cause, 'cause'), depth + 1);
}

function producedByProvider(value: object): boolean {
  const type = readField(value, 'type');
  return (
    typeof readField(value, 'statusCode') === 'number' ||
    typeof readField(value, 'responseBody') === 'string' ||
    (typeof type === 'string' && ENVELOPE_TYPES.has(type))
  );
}
