import { observationSchema, resultSchema, type DiscoveryMode, type Observation } from './contracts.js';
import { pathAllowed, type Target } from '../core/contracts.js';

// Values remain private scan-local memory. No raw record is attached to an error.
export class SecretGuard {
  private values: string[];
  private variants: string[];
  readonly tailLength: number;
  constructor(values: string[]) {
    this.values = [...new Set(values.filter(Boolean))];
    this.variants = this.values.flatMap(value => [
      value,
      Buffer.from(value).toString('base64'),
      Buffer.from(value).toString('base64url'),
      Buffer.from(value).toString('hex'),
      [...Buffer.from(value)].map(byte => `%${byte.toString(16).padStart(2, '0')}`).join(''),
      [...value].map(char => `&#${char.charCodeAt(0)};`).join(''),
      [...value].map(char => `&#x${char.charCodeAt(0).toString(16)};`).join(''),
    ]);
    this.tailLength = Math.max(1, ...this.variants.map(value => value.length)) - 1;
  }
  /** Detect forbidden credential representations before exporting a parsed value. */
  unsafe(value: string) {
    let decoded = value;
    for (let pass = 0; pass < 3; pass++) {
      if (this.variants.some(secret => decoded.includes(secret))) return true;
      decoded = decoded
        .replace(
          /&#(?:x([a-f0-9]+)|(\d+));/gi,
          (_match: string, hex: string | undefined, decimal: string | undefined) =>
            String.fromCodePoint(Math.min(0x10ffff, parseInt(hex ?? decimal ?? '0', hex ? 16 : 10))),
        )
        .replace(/\\u([a-f0-9]{4})/gi, (_match: string, hex: string) => String.fromCharCode(parseInt(hex, 16)));
      try {
        decoded = decodeURIComponent(decoded);
      } catch {
        return true;
      }
    }
    return this.variants.some(secret => decoded.includes(secret)) || /%[a-f0-9]{2}/i.test(decoded);
  }
  /** Count bounded occurrences of forbidden credential representations in candidate output. */
  occurrences(value: string, previousLength: number) {
    let count = 0;
    for (const secret of this.values) {
      let index = 0;
      while ((index = value.indexOf(secret, index)) >= 0) {
        if (index + secret.length > previousLength) count++;
        index += secret.length;
      }
    }
    return count;
  }
  clear() {
    this.values = [];
    this.variants = [];
  }
}
/** Expand credential values into representations that must be withheld from exported evidence. */
export function forbiddenCredentialValues(headers: Record<string, string>[]) {
  const values: string[] = [];
  for (const header of headers)
    for (const [name, value] of Object.entries(header)) {
      values.push(value);
      if (name === 'authorization' && value.includes(' ')) values.push(value.slice(value.indexOf(' ') + 1));
      if (name === 'cookie')
        for (const cookie of value.split(';')) {
          const index = cookie.indexOf('=');
          if (index >= 0 && cookie.slice(index + 1).trim()) values.push(cookie.slice(index + 1).trim());
        }
    }
  return [...new Set(values)];
}
type JsonObject = Record<string, unknown>;
/** Accept non-null JSON objects while rejecting arrays and primitive values. */
const object = (value: unknown): JsonObject | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : undefined;
export const OUTPUT_BOUNDS = { line: 32768, total: 262144, records: 128, exported: 65536 } as const;
export class DiscoveryParser {
  readonly counters = {
    bytes: 0,
    stderrBytes: 0,
    rawCredentialOccurrences: 0,
    parsed: 0,
    malformed: 0,
    withheld: 0,
    secretFields: 0,
    minimizedValues: 0,
    unknownOrigin: 0,
    schemaRejected: 0,
    boundStops: 0,
    policyDenied: 0,
    upstreamUnverified: 0,
  };
  private observations: Observation[] = [];
  private pending = '';
  private tails = { stdout: '', stderr: '' };
  stopped = false;
  constructor(
    private readonly scope: Pick<Target, 'entryUrl' | 'approvedOrigins' | 'allowedPaths' | 'excludedPaths'>,
    private readonly profile: { id: string; role: string },
    private readonly mode: DiscoveryMode,
    readonly guard: SecretGuard,
    private readonly stop: () => void,
    private readonly bounds: { line: number; total: number; records: number; exported: number } = OUTPUT_BOUNDS,
  ) {}
  private bound() {
    this.counters.boundStops++;
    this.stopped = true;
    this.pending = '';
    this.stop();
  }
  /** Consume bounded native output chunks and parse only complete private records. */
  feed(channel: 'stdout' | 'stderr', chunk: string) {
    if (this.stopped) return;
    this.counters[channel === 'stdout' ? 'bytes' : 'stderrBytes'] += Buffer.byteLength(chunk);
    const combined = this.tails[channel] + chunk;
    this.counters.rawCredentialOccurrences += this.guard.occurrences(combined, this.tails[channel].length);
    this.tails[channel] = this.guard.tailLength ? combined.slice(-this.guard.tailLength) : '';
    if (this.counters.bytes + this.counters.stderrBytes > this.bounds.total) {
      this.bound();
      return;
    }
    if (channel === 'stderr') return;
    this.pending += chunk;
    while (this.pending.includes('\n')) {
      const index = this.pending.indexOf('\n');
      const line = this.pending.slice(0, index);
      this.pending = this.pending.slice(index + 1);
      if (Buffer.byteLength(line) > this.bounds.line) {
        this.bound();
        return;
      }
      this.parse(line);
      if (this.stopped) return;
    }
    if (Buffer.byteLength(this.pending) > this.bounds.line) this.bound();
  }
  /** Accept only bounded parameter names that contain no forbidden credential material. */
  private safeName(value: unknown) {
    if (typeof value !== 'string' || this.guard.unsafe(value)) {
      this.counters.secretFields++;
      this.counters.withheld++;
      return null;
    }
    if (!/^[A-Za-z][A-Za-z0-9_.\-]{0,63}$/.test(value)) {
      this.counters.schemaRejected++;
      this.counters.withheld++;
      return null;
    }
    return value;
  }
  /** Emit an allowlisted sanitized evidence record within the configured output budget. */
  private emit(
    kind: Observation['kind'],
    input: unknown,
    method: unknown = 'GET',
    parameters: unknown[] = [],
    status?: unknown,
  ) {
    if (typeof input !== 'string' || input.length > 4096) {
      this.counters.withheld++;
      return;
    }
    let url: URL;
    let path: string;
    try {
      url = new URL(input, this.scope.entryUrl);
      path = decodeURIComponent(url.pathname);
    } catch {
      this.counters.withheld++;
      return;
    }
    if (!this.scope.approvedOrigins.includes(url.origin) || url.username || url.password) {
      this.counters.unknownOrigin++;
      this.counters.withheld++;
      return;
    }
    if (this.guard.unsafe(path) || !pathAllowed(path, this.scope)) {
      this.counters.secretFields++;
      this.counters.withheld++;
      return;
    }
    const names: unknown[] = [];
    for (const [name, value] of url.searchParams) {
      this.counters.minimizedValues++;
      if (this.guard.unsafe(value)) {
        this.counters.secretFields++;
        this.counters.withheld++;
      }
      names.push(name);
    }
    names.push(...parameters);
    const safeNames = [
      ...new Set(names.map(value => this.safeName(value)).filter((value): value is string => value !== null)),
    ].sort();
    const parsed = observationSchema.safeParse({
      kind,
      profileId: this.profile.id,
      role: this.profile.role,
      source: this.mode === 'http' ? 'katana-http' : 'katana-headless',
      provenance: typeof status === 'number' ? 'upstream-response' : 'advertised',
      origin: url.origin,
      path,
      method: typeof method === 'string' ? method.toUpperCase() : method,
      parameterNames: safeNames,
      ...(typeof status === 'number' ? { status } : {}),
    });
    if (!parsed.success) {
      this.counters.schemaRejected++;
      this.counters.withheld++;
      return;
    }
    const serialized = JSON.stringify(parsed.data);
    if (this.guard.unsafe(serialized)) {
      this.counters.secretFields++;
      this.counters.withheld++;
      return;
    }
    if (!this.observations.some(value => JSON.stringify(value) === serialized)) this.observations.push(parsed.data);
    if (Buffer.byteLength(JSON.stringify(this.observations)) > this.bounds.exported) {
      this.observations.pop();
      this.bound();
    }
  }
  /** Normalize a native discovery record and withhold unsafe or unsupported fields. */
  private parse(line: string) {
    if (!line.trim()) return;
    if (this.counters.parsed + this.counters.malformed >= this.bounds.records) {
      this.bound();
      return;
    }
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      this.counters.malformed++;
      this.counters.withheld++;
      return;
    }
    this.counters.parsed++;
    const record = object(value);
    if (!record) {
      this.counters.schemaRejected++;
      this.counters.withheld++;
      return;
    }
    const request = object(record.request),
      response = object(record.response);
    const headers = object(response?.headers);
    /** Check observed response headers for the named bounded marker. */
    const marker = (name: string) =>
      headers &&
      Object.entries(headers).some(
        ([key, value]) =>
          key.toLowerCase() === name &&
          (value === '1' || (Array.isArray(value) && value.length === 1 && value[0] === '1')),
      );
    if (marker('x-scanner-policy-denied')) {
      this.counters.policyDenied++;
      this.counters.withheld++;
      return;
    }
    const marked = marker('x-scanner-upstream-observed');
    // Browser-local/cache/service-worker responses can reproduce visible
    // headers. Browser discovery therefore advertises surfaces without making
    // an upstream status claim; identity checks use the confined HTTP driver.
    const observed = this.mode === 'http' && marked;
    if (response && typeof response.status_code === 'number' && !marked) {
      this.counters.upstreamUnverified++;
      this.counters.withheld++;
    }
    if (request)
      this.emit('endpoint', request.endpoint, request.method, [], observed ? response?.status_code : undefined);
    if (Array.isArray(response?.forms)) {
      this.counters.withheld += Math.max(0, response.forms.length - 32);
      for (const item of response.forms.slice(0, 32)) {
        const form = object(item);
        if (!form) continue;
        const parameters = Array.isArray(form.parameters) ? form.parameters : [];
        this.counters.withheld += Math.max(0, parameters.length - 32);
        this.emit('form', form.action, form.method ?? 'GET', parameters.slice(0, 32));
      }
    }
    if (Array.isArray(response?.xhr_requests)) {
      this.counters.withheld += Math.max(0, response.xhr_requests.length - 32);
      for (const item of response.xhr_requests.slice(0, 32)) {
        const xhr = object(item);
        if (xhr) this.emit('xhr', xhr.endpoint, xhr.method ?? 'GET');
      }
    }
  }
  /** Finalize private parsing and report bounded evidence and withheld-output status. */
  finish(interrupted = false) {
    if (!this.stopped && this.pending.trim()) this.parse(this.pending);
    this.pending = '';
    this.tails = { stdout: '', stderr: '' };
    const result = resultSchema.parse({
      observations: this.observations,
      counters: this.counters,
      partial: interrupted || this.stopped || this.counters.withheld > 0,
      stopped: this.stopped,
    });
    if (this.guard.unsafe(JSON.stringify(result))) throw new Error('SANITIZED_EXPORT_REJECTED');
    return result;
  }
}
