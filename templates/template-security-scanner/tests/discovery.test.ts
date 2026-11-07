import { principalJsonPointerSchema, privatePrincipal, scanPrincipalComparison } from '../src/discovery/principals.js';
import type { Scan } from '../src/discovery/contracts.js';
import { corsReadObservation } from '../src/discovery/cors-observation.js';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { scanAdmissionSchema, observationSchema, scanSchema, budgetSchema } from '../src/discovery/contracts.js';
import { DiscoveryParser, SecretGuard, forbiddenCredentialValues } from '../src/discovery/parser.js';
import { katanaCommand } from '../src/discovery/command.js';

const profile = { id: randomUUID(), role: 'reader' };
const binding = {
  targetRevision: 2,
  policyRevision: 1,
  profileId: profile.id,
  profileRevision: 1,
  credentialRevision: 1,
};
const admission = { targetRevision: 2, policyRevision: 1, profiles: [binding], idempotencyKey: randomUUID() };
const scope = {
  entryUrl: 'https://example.test/',
  approvedOrigins: ['https://example.test'],
  allowedPaths: ['/'],
  excludedPaths: ['/excluded'],
};
function parser(values: string[] = [], bounds?: { line: number; total: number; records: number; exported: number }) {
  let stopped = false;
  const guard = new SecretGuard(values);
  const parser = new DiscoveryParser(
    scope,
    profile,
    'http',
    guard,
    () => {
      stopped = true;
    },
    bounds,
  );
  return { parser, guard, stopped: () => stopped };
}
describe('Discovery contracts and minimized JSONL', () => {
  it('rejects hostile paths without blocking subsequent records or cancellation under an external watchdog', async () => {
    const child = spawn(
      process.execPath,
      ['--import', 'tsx', new URL('./lab/parser-worker.ts', import.meta.url).pathname],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let output = '',
      stderrBytes = 0,
      timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, 3000);
    child.stdout.on('data', (bytes: Buffer) => {
      output += bytes.toString();
      if (output.length > 4096) child.kill('SIGKILL');
    });
    child.stderr.on('data', (bytes: Buffer) => {
      stderrBytes += bytes.length;
      if (stderrBytes > 4096) child.kill('SIGKILL');
    });
    const exitCode = await new Promise<number | null>(resolve => {
      child.once('exit', resolve);
      child.once('error', () => resolve(null));
    });
    clearTimeout(timer);
    expect(timedOut).toBe(false);
    expect(exitCode).toBe(0);
    expect(stderrBytes).toBe(0);
    const result = JSON.parse(output) as {
      rejected: number;
      cleanRecord: boolean;
      cancelResponsive: boolean;
      elapsedMs: number;
    };
    expect(result.rejected).toBe(3);
    expect(result.cleanRecord).toBe(true);
    expect(result.cancelResponsive).toBe(true);
    expect(result.elapsedMs).toBeLessThan(250);
  });
  it('defaults to HTTP and rejects duplicated or cross-revision role bindings', () => {
    expect(scanAdmissionSchema.parse(admission).mode).toBe('http');
    for (const request of [
      { ...admission, profiles: [binding, binding] },
      { ...admission, profiles: [{ ...binding, targetRevision: 1 }] },
      { ...admission, mode: 'shell' },
      { ...admission, command: 'curl' },
      { ...admission, idempotencyKey: 'short' },
    ])
      expect(scanAdmissionSchema.safeParse(request).success).toBe(false);
  });
  it.each(['/a//b', '/a/../b', '/./b', '/%2fsecret', '//other.test/a'])(
    'rejects ambiguous normalized inventory path %s',
    path => {
      expect(
        observationSchema.safeParse({
          kind: 'endpoint',
          role: 'reader',
          profileId: profile.id,
          source: 'katana-http',
          provenance: 'advertised',
          origin: 'https://example.test',
          path,
          method: 'GET',
          parameterNames: [],
        }).success,
      ).toBe(false);
    },
  );
  it('keeps completed cleanup distinct from terminal cancellation and uncertain budget', () => {
    const scan = {
      id: randomUUID(),
      jobId: randomUUID(),
      targetId: randomUUID(),
      owner: 'operator',
      request: scanAdmissionSchema.parse(admission),
      state: 'CANCELLED',
      reason: 'CANCELLED_BY_OPERATOR',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      partial: true,
      cleanup: 'COMPLETE',
      roles: [],
      diagnostic: null,
      budget: { remainingRequests: 1, remainingBytes: 1024, exhausted: false, reason: null },
    };
    expect(scanSchema.safeParse(scan).success).toBe(true);
    expect(scanSchema.safeParse({ ...scan, cleanup: 'DEBT' }).success).toBe(false);
    expect(
      scanSchema.safeParse({ ...scan, state: 'CANCEL_REQUESTED', cleanup: 'DEBT', reason: 'CLEANUP_FAILED' }).success,
    ).toBe(true);
    expect(
      budgetSchema.safeParse({ remainingRequests: null, remainingBytes: null, exhausted: true, reason: 'unknown' })
        .success,
    ).toBe(true);
    for (const budget of [
      { remainingRequests: 1, remainingBytes: 1024, exhausted: true, reason: null },
      { remainingRequests: null, remainingBytes: 1024, exhausted: false, reason: null },
      { remainingRequests: null, remainingBytes: null, exhausted: false, reason: null },
      { remainingRequests: 1, remainingBytes: 1024, exhausted: true, reason: 'unknown' },
    ])
      expect(budgetSchema.safeParse(budget).success).toBe(false);
  });
  it('minimizes values and unknown raw fields while retaining clean forms and XHR', () => {
    const { parser, guard } = parserForPublic();
    parser.feed(
      'stdout',
      JSON.stringify({
        request: { endpoint: 'https://example.test/catalog?category=books#fragment', method: 'GET', raw: 'discarded' },
        response: {
          status_code: 200,
          body: 'discarded',
          headers: { secret: 'discarded' },
          forms: [{ action: '/search?q=discarded', method: 'get', parameters: ['q'] }],
          xhr_requests: [{ endpoint: '/api/items?sort=recent', method: 'GET' }],
        },
        customfields: 'discarded',
      }) + '\n',
    );
    const result = parser.finish();
    expect(result.observations.map(value => value.kind)).toEqual(['endpoint', 'form', 'xhr']);
    expect(result.observations[0]?.parameterNames).toEqual(['category']);
    expect(JSON.stringify(result).includes('discarded')).toBe(false);
    expect(JSON.stringify(result).includes('books')).toBe(false);
    expect(guard.unsafe(JSON.stringify(result))).toBe(false);
  });
  it('withholds local denials and unverified transport statuses while preserving genuine responses and advertised forms', () => {
    const { parser: subject } = parser();
    for (const record of [
      {
        request: { endpoint: '/blocked', method: 'GET' },
        response: { status_code: 403, headers: { 'X-Scanner-Policy-Denied': ['1'] } },
      },
      { request: { endpoint: '/unreachable', method: 'GET' }, response: { status_code: 502 } },
      {
        request: { endpoint: '/catalog', method: 'GET' },
        response: {
          status_code: 200,
          headers: { 'X-Scanner-Upstream-Observed': ['1'] },
          forms: [{ action: '/search', parameters: ['q'] }],
          xhr_requests: [{ endpoint: '/api/items' }],
        },
      },
      {
        request: { endpoint: '/admin', method: 'GET' },
        response: { status_code: 403, headers: { 'x-scanner-upstream-observed': '1' } },
      },
    ])
      subject.feed('stdout', JSON.stringify(record) + '\n');
    const result = subject.finish();
    expect(result.partial).toBe(true);
    expect(result.counters.policyDenied).toBe(1);
    expect(result.counters.upstreamUnverified).toBe(1);
    expect(result.observations.some(item => item.path === '/blocked')).toBe(false);
    expect(result.observations.find(item => item.path === '/unreachable')).toMatchObject({ provenance: 'advertised' });
    expect(result.observations.find(item => item.path === '/unreachable')?.status).toBeUndefined();
    expect(result.observations.find(item => item.path === '/admin')).toMatchObject({
      status: 403,
      provenance: 'upstream-response',
    });
    const forbidden = result.observations.find(item => item.path === '/admin');
    expect(observationSchema.safeParse(forbidden).success).toBe(true);
    expect(observationSchema.safeParse({ ...forbidden, source: 'katana-headless' }).success).toBe(false);
    expect(result.observations.find(item => item.kind === 'form')).toMatchObject({
      path: '/search',
      provenance: 'advertised',
    });
    expect(result.observations.find(item => item.kind === 'xhr')).toMatchObject({
      path: '/api/items',
      provenance: 'advertised',
    });
  });
  it('never attributes browser-visible marker responses as upstream status evidence', () => {
    const guard = new SecretGuard([]);
    const subject = new DiscoveryParser(scope, profile, 'headless', guard, () => {});
    subject.feed(
      'stdout',
      JSON.stringify({
        request: { endpoint: '/catalog', method: 'GET' },
        response: {
          status_code: 403,
          headers: { 'X-Scanner-Upstream-Observed': '1' },
          forms: [{ action: '/search', parameters: ['q'] }],
          xhr_requests: [{ endpoint: '/api/items' }],
        },
      }) + '\n',
    );
    const result = subject.finish();
    expect(result.observations.map(item => item.kind)).toEqual(['endpoint', 'form', 'xhr']);
    expect(result.observations.every(item => item.provenance === 'advertised' && item.status === undefined)).toBe(true);
    expect(observationSchema.safeParse({ ...result.observations[0], status: 403 }).success).toBe(false);
  });
  it('withholds reflected other-role tokens and bearer/cookie substrings', () => {
    const viewer = randomBytes(24).toString('hex'),
      admin = randomBytes(24).toString('hex');
    const forbidden = forbiddenCredentialValues([
      { authorization: `Bearer ${viewer}` },
      { cookie: `session=${admin}` },
    ]);
    const { parser: subject, guard } = parser(forbidden);
    subject.feed(
      'stdout',
      JSON.stringify({
        request: { endpoint: 'https://example.test/catalog?category=books', method: 'GET' },
        response: {
          forms: [
            { action: `/search?value=${viewer}`, parameters: [admin, 'q'] },
            { action: `/${admin}`, parameters: ['clean'] },
          ],
          xhr_requests: [{ endpoint: '/api/clean?sort=recent', method: 'GET' }],
        },
      }) + '\n',
    );
    const result = subject.finish();
    expect(result.partial).toBe(true);
    expect(result.counters.withheld).toBeGreaterThan(0);
    expect(result.observations.some(value => value.kind === 'form' && value.parameterNames.includes('q'))).toBe(true);
    expect(result.observations.some(value => value.kind === 'xhr')).toBe(true);
    expect(guard.unsafe(JSON.stringify(result))).toBe(false);
  });
  it('rejects supported credential encodings before exporting field names and paths', () => {
    const credential = randomBytes(24).toString('hex'),
      guard = new SecretGuard([credential]);
    const variants = [
      credential,
      Buffer.from(credential).toString('base64'),
      Buffer.from(credential).toString('base64url'),
      Buffer.from(credential).toString('hex'),
      [...credential].map(char => `&#${char.charCodeAt(0)};`).join(''),
      [...Buffer.from(credential)].map(byte => `%${byte.toString(16)}`).join(''),
    ];
    expect(variants.every(value => guard.unsafe(value))).toBe(true);
    expect(guard.unsafe('catalog')).toBe(false);
  });
  it('fails closed when a cookie fragment overlaps fixed exported metadata', () => {
    const credential = randomBytes(24).toString('hex');
    const values = forbiddenCredentialValues([{ cookie: `session=${credential}; locale=en` }]);
    const { parser: subject } = parser(values);
    subject.feed('stdout', JSON.stringify({ request: { endpoint: '/catalog', method: 'GET' } }) + '\n');
    expect(() => subject.finish()).toThrow('SANITIZED_EXPORT_REJECTED');
  });
  it('counts malformed input without copying secret error text to output', () => {
    const credential = randomBytes(24).toString('hex'),
      { parser: subject, guard } = parser([credential]);
    subject.feed('stdout', `{invalid:${credential.slice(0, 19)}`);
    subject.feed('stdout', `${credential.slice(19)}}\n`);
    subject.feed('stdout', JSON.stringify({ request: { endpoint: '/catalog?category=books', method: 'GET' } }) + '\n');
    const result = subject.finish();
    expect(result.counters.malformed).toBe(1);
    expect(result.counters.rawCredentialOccurrences).toBe(1);
    expect(result.observations[0]?.path).toBe('/catalog');
    expect(guard.unsafe(JSON.stringify(result))).toBe(false);
  });
  it.each(['line', 'total', 'records', 'exported'] as const)(
    'stops the real parser on its %s bound beside a useful prefix',
    bound => {
      const bounds = { line: 32768, total: 262144, records: 128, exported: 65536 };
      if (bound === 'line') bounds.line = 256;
      else if (bound === 'total') bounds.total = 256;
      else if (bound === 'records') bounds.records = 1;
      else bounds.exported = 256;
      const test = parser([], bounds),
        line = JSON.stringify({ request: { endpoint: '/catalog?category=books', method: 'GET' } }) + '\n';
      test.parser.feed('stdout', line);
      test.parser.feed(
        'stdout',
        bound === 'line'
          ? 'x'.repeat(300)
          : bound === 'total'
            ? line.repeat(5)
            : bound === 'records'
              ? line
              : JSON.stringify({ request: { endpoint: '/catalog2?category=books', method: 'GET' } }) + '\n',
      );
      const result = test.parser.finish();
      expect(test.stopped()).toBe(true);
      expect(result.partial).toBe(true);
      expect(result.observations.some(value => value.path === '/catalog')).toBe(true);
    },
  );
  it('does not retain a growing public raw tail and admits no shell or arbitrary Katana switches', () => {
    const { parser: subject } = parser();
    for (let index = 0; index < 200; index++) subject.feed('stderr', 'x'.repeat(1024));
    const result = subject.finish();
    expect(result.counters.stderrBytes).toBe(204800);
    expect(result.observations).toHaveLength(0);
    const command = katanaCommand({
      entryUrl: 'https://example.test/',
      mode: 'headless',
      proxy: 'http://172.18.0.10:8080',
    });
    expect(command.executable).toBe('katana');
    expect(command.args.includes('-hybrid')).toBe(true);
    expect(command.args.includes('-headless')).toBe(false);
    expect(command.args.includes('-automatic-form-fill')).toBe(false);
    expect(() =>
      katanaCommand({ entryUrl: 'https://example.test/?secret=value', mode: 'http', proxy: 'http://172.18.0.10:8080' }),
    ).toThrow();
  });
});
function parserForPublic() {
  return parser();
}

describe('Bounded native CORS response correlation', () => {
  const session = 'owned-browser-session',
    url = 'http://allowed.lab:18080/owned/cors/fixture',
    id = '123.1';
  const request = (requestId = id, destination = url, sessionId = session) => ({
    method: 'Network.requestWillBeSent',
    sessionId,
    params: { requestId, type: 'Fetch', request: { url: destination, method: 'GET' } },
  });
  const response = (
    requestId = id,
    headers: Record<string, unknown> = { 'X-Scanner-Upstream-Observed': '1' },
    statusCode = 200,
  ) => ({
    method: 'Network.responseReceivedExtraInfo',
    sessionId: session,
    params: { requestId, statusCode, headers },
  });
  const failed = (requestId = id, corsError = 'MissingAllowOriginHeader', canceled = false) => ({
    method: 'Network.loadingFailed',
    sessionId: session,
    params: {
      requestId,
      type: 'Fetch',
      canceled,
      corsErrorStatus: { corsError, failedParameter: 'PRIVATE_FIELD_SENTINEL' },
      errorText: 'PRIVATE_FIELD_SENTINEL',
    },
  });
  const finished = (requestId = id) => ({
    method: 'Network.loadingFinished',
    sessionId: session,
    params: { requestId, encodedDataLength: 64 },
  });
  it.each([true, false])('complete native200read preserves marker match %s', markerMatched => {
    const state = corsReadObservation(session, url);
    state.observe(response());
    state.observe(finished());
    expect(state.ready()).toBe(false);
    state.observe(request());
    expect(state.ready()).toBe(true);
    expect(state.result({ completed: true, readable: markerMatched })).toEqual({
      state: 'COMPLETED_READ',
      markerMatched,
    });
    expect(state.result({ completed: false, readable: false })).toEqual({ state: 'INCOMPLETE' });
  });
  it('late request and response notifications reconcile only by exact session and request ID', () => {
    const state = corsReadObservation(session, url);
    state.observe(failed());
    expect(state.ready()).toBe(false);
    state.observe(request());
    expect(state.ready()).toBe(false);
    state.observe(response());
    expect(state.ready()).toBe(true);
    expect(state.result({ completed: false, readable: false })).toEqual({ state: 'CORS_DENIED' });
    expect(JSON.stringify(state.result({ completed: false, readable: false }))).not.toContain('PRIVATE_FIELD_SENTINEL');
    for (const unrelated of [
      request('foreign-id'),
      request(id, 'http://other.lab/'),
      request(id, url, 'other-session'),
    ]) {
      const isolated = corsReadObservation(session, url);
      isolated.observe(unrelated);
      isolated.observe(failed());
      isolated.observe(response());
      expect(isolated.result({ completed: false, readable: false })).toEqual({ state: 'INCOMPLETE' });
    }
  });
  it.each(['InvalidResponse', 'PreflightInvalidStatus', 'LocalNetworkAccessPermissionDenied'])(
    'native %s is incomplete rather than a CORS policy negative',
    reason => {
      const state = corsReadObservation(session, url);
      state.observe(request());
      state.observe(response());
      state.observe(failed(id, reason));
      expect(state.result({ completed: false, readable: false })).toEqual({ state: 'INCOMPLETE' });
    },
  );
  it('cancellation, uncorrelated failures, synthetic responses and redirects never become negatives', () => {
    const cases = [
      [request(), response(), failed(id, 'MissingAllowOriginHeader', true)],
      [
        request(),
        response(),
        {
          method: 'Network.loadingFailed',
          sessionId: session,
          params: { requestId: id, type: 'Fetch', errorText: 'CORS_ERROR_TEXT_IS_NOT_NATIVE_PROOF' },
        },
      ],
      [request(), response(id, {}, 200), failed()],
      [request(), response(id, { 'X-Scanner-Upstream-Observed': '1', 'X-Scanner-Policy-Denied': '1' }), failed()],
      [request(), response(id, { 'X-Scanner-Upstream-Observed': '1' }, 502), failed()],
      [request(), { ...request(), params: { ...request().params, redirectResponse: {} } }, response(), failed()],
      [request(), request('another-matching-id'), response(), failed()],
    ];
    for (const events of cases) {
      const state = corsReadObservation(session, url);
      for (const event of events) state.observe(event);
      expect(state.result({ completed: false, readable: false })).toEqual({ state: 'INCOMPLETE' });
    }
  });
  it('pending flags are bounded and malformed renderer results remain incomplete', () => {
    const state = corsReadObservation(session, url);
    for (let index = 0; index < 9; index++) state.observe(response(`pending-${index}`));
    state.observe(request());
    state.observe(response());
    state.observe(failed());
    expect(state.result({ completed: false, readable: false })).toEqual({ state: 'INCOMPLETE' });
    const valid = corsReadObservation(session, url);
    valid.observe(request());
    valid.observe(response());
    valid.observe(finished());
    expect(valid.result({ completed: false, readable: true })).toEqual({ state: 'INCOMPLETE' });
    expect(valid.result({ completed: true, readable: true, errorText: 'PRIVATE_FIELD_SENTINEL' })).toEqual({
      state: 'INCOMPLETE',
    });
  });
});

describe('private REST principal observations', () => {
  it('reads escaped JSON pointers without coercion or inherited account values', () => {
    expect(privatePrincipal({ 'account/id': { '~subject': 'account-a' } }, '/account~1id/~0subject')).toBe('account-a');
    for (const value of [null, 1, true, [], {}, '', ' account-a', 'account-a\n', 'x'.repeat(257)])
      expect(privatePrincipal({ principal: value }, '/principal')).toBeNull();
    expect(privatePrincipal(Object.create({ principal: 'account-a' }), '/principal')).toBeNull();
    expect(privatePrincipal({ principal: 'account-a' }, undefined)).toBeNull();
    for (const pointer of ['', 'principal', '/bad~2escape', '/' + 'x'.repeat(256), '/a/b/c/d/e/f/g/h/i', '/account\n'])
      expect(principalJsonPointerSchema.safeParse(pointer).success).toBe(false);
  });
  it('requires one finite comparison between two ready REST profiles', () => {
    const scan = {
      roles: [
        { profileId: 'a', source: 'rest-json', identity: 'READY' },
        {
          profileId: 'b',
          source: 'rest-json',
          identity: 'READY',
          principalComparisons: [{ profileId: 'a', result: 'DISTINCT' }],
        },
      ],
    } as Scan;
    expect(scanPrincipalComparison(scan, ['a', 'b'])).toBe('DISTINCT');
    expect(scanPrincipalComparison(scan, ['a', 'a'])).toBe('UNKNOWN');
    expect(scanPrincipalComparison({ ...scan, roles: [scan.roles[0]!] }, ['a', 'b'])).toBe('UNKNOWN');
    expect(
      scanPrincipalComparison({ ...scan, roles: [scan.roles[0]!, { ...scan.roles[1]!, identity: 'AUTH_REQUIRED' }] }, [
        'a',
        'b',
      ]),
    ).toBe('UNKNOWN');
    expect(
      scanPrincipalComparison({ ...scan, roles: [scan.roles[0]!, { ...scan.roles[1]!, principalComparisons: [] }] }, [
        'a',
        'b',
      ]),
    ).toBe('UNKNOWN');
    expect(
      scanPrincipalComparison(
        {
          ...scan,
          roles: [scan.roles[0]!, { ...scan.roles[1]!, principalComparisons: [{ profileId: 'a', result: 'SAME' }] }],
        },
        ['a', 'b'],
      ),
    ).toBe('SAME');
  });
});
