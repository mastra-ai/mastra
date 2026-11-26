import { z } from 'zod';

const identifier = z.string().min(1).max(128);
const provenance = z.record(z.string().max(256), z.unknown()).transform(headers => {
  let upstream = false,
    upstreamFields = 0,
    policyDenied = false;
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() === 'x-scanner-upstream-observed') {
      upstreamFields++;
      upstream = value === '1';
    }
    if (name.toLowerCase() === 'x-scanner-policy-denied') policyDenied = true;
  }
  return { upstream: upstream && upstreamFields === 1, policyDenied };
});
const notification = z.discriminatedUnion('method', [
  z.object({
    method: z.literal('Network.requestWillBeSent'),
    sessionId: identifier,
    params: z.object({
      requestId: identifier,
      request: z.object({ url: z.string().max(2048), method: z.string().min(1).max(32) }),
      type: z.string().max(32).optional(),
      redirectResponse: z.object({}).optional(),
    }),
  }),
  z.object({
    method: z.literal('Network.responseReceivedExtraInfo'),
    sessionId: identifier,
    params: z.object({ requestId: identifier, statusCode: z.number().int().min(100).max(599), headers: provenance }),
  }),
  z.object({
    method: z.literal('Network.loadingFailed'),
    sessionId: identifier,
    params: z.object({
      requestId: identifier,
      type: z.string().max(32),
      canceled: z.boolean().optional(),
      corsErrorStatus: z.object({ corsError: z.string().min(1).max(128) }).optional(),
    }),
  }),
  z.object({
    method: z.literal('Network.loadingFinished'),
    sessionId: identifier,
    params: z.object({
      requestId: identifier,
      encodedDataLength: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    }),
  }),
]);
const methods = new Set([
  'Network.requestWillBeSent',
  'Network.responseReceivedExtraInfo',
  'Network.loadingFailed',
  'Network.loadingFinished',
]);
// Only header-policy denials relevant to this fixed GET/credentials:omit fetch.
// InvalidResponse, cancellation, preflight and local-network failures do not prove a protected response.
const headerDenials = new Set([
  'MissingAllowOriginHeader',
  'MultipleAllowOriginValues',
  'InvalidAllowOriginValue',
  'AllowOriginMismatch',
]);
const readResult = z
  .object({ completed: z.boolean(), readable: z.boolean() })
  .strict()
  .refine(value => value.completed || !value.readable);
/** Finite browser-read result; transport interruption is distinct from native CORS denial. */
export type CorsReadOutcome =
  | {
      /** Completed readable response, trusted native CORS denial, or incomplete transport. */
      state: 'COMPLETED_READ';
      /** Whether the complete readable response contains the registered owned marker. */
      markerMatched: boolean;
    }
  | {
      /** Completed readable response, trusted native CORS denial, or incomplete transport. */
      state: 'CORS_DENIED';
    }
  | {
      /** Completed readable response, trusted native CORS denial, or incomplete transport. */
      state: 'INCOMPLETE';
    };
type RequestState = {
  seen: boolean;
  matches: boolean;
  invalid: boolean;
  finished: boolean;
  response?: { status: number; upstream: boolean; policyDenied: boolean };
  failure?: { denied: boolean; canceled: boolean };
};

// Private bounded correlation only: at most8request IDs and flags, never messages,
// URLs, headers, errorText, failedParameter or response bodies. ExtraInfo/terminal
// events can precede the matching request notification and are reconciled by ID.
export function corsReadObservation(session: string, destination: string) {
  const requests = new Map<string, RequestState>();
  let selected: string | undefined,
    invalid = false;
  /** Return the selected tracked browser request, if one has been selected. */
  const current = () => (selected ? requests.get(selected) : undefined);
  /** Track allowlisted browser network events for the expected session and selected request. */
  const observe = (value: Record<string, unknown>) => {
    if (typeof value.method !== 'string' || !methods.has(value.method) || value.sessionId !== session) return;
    const parsed = notification.safeParse(value);
    if (!parsed.success) {
      invalid = true;
      return;
    }
    const event = parsed.data,
      id = event.params.requestId;
    let request = requests.get(id);
    if (!request) {
      if (requests.size >= 8) {
        invalid = true;
        return;
      }
      request = { seen: false, matches: false, invalid: false, finished: false };
      requests.set(id, request);
    }
    switch (event.method) {
      case 'Network.requestWillBeSent':
        if (request.seen || event.params.redirectResponse !== undefined) request.invalid = true;
        request.seen = true;
        request.matches =
          event.params.request.url === destination &&
          event.params.request.method === 'GET' &&
          event.params.type === 'Fetch';
        if (request.matches) {
          if (selected && selected !== id) invalid = true;
          selected = id;
        }
        break;
      case 'Network.responseReceivedExtraInfo':
        if (request.response) request.invalid = true;
        request.response = { status: event.params.statusCode, ...event.params.headers };
        break;
      case 'Network.loadingFailed':
        if (request.failure || request.finished || event.params.type !== 'Fetch') request.invalid = true;
        request.failure = {
          denied: headerDenials.has(event.params.corsErrorStatus?.corsError ?? ''),
          canceled: event.params.canceled === true,
        };
        break;
      case 'Network.loadingFinished':
        if (request.finished || request.failure) request.invalid = true;
        request.finished = true;
    }
  };
  /** Report whether the browser observation has enough terminal network state for classification. */
  const ready = () => {
    const request = current();
    if (invalid || request?.invalid) return true;
    if (!request?.seen || !request.matches) return false;
    if (request.failure) return !request.failure.denied || request.failure.canceled || Boolean(request.response);
    return request.finished && Boolean(request.response);
  };
  /** Classify the browser read only when protocol results and tracked network evidence agree. */
  const result = (value: unknown): CorsReadOutcome => {
    const read = readResult.safeParse(value),
      request = current();
    if (
      invalid ||
      request?.invalid ||
      !request?.seen ||
      !request.matches ||
      !read.success ||
      request.response?.status !== 200 ||
      !request.response.upstream ||
      request.response.policyDenied
    )
      return { state: 'INCOMPLETE' };
    if (request.finished && !request.failure && read.data.completed)
      return { state: 'COMPLETED_READ', markerMatched: read.data.readable };
    if (request.failure?.denied && !request.failure.canceled && !request.finished && !read.data.completed)
      return { state: 'CORS_DENIED' };
    return { state: 'INCOMPLETE' };
  };
  return { observe, ready, result };
}
