import { pathAllowed, urlSchema, type Target, type Profile } from '../core/contracts.js';
import { ownerOnlyReadRule, type RouteAccessRule } from '../core/route-access.js';
import { observationSchema, type Observation } from './contracts.js';
import { restCommand } from './command.js';
import type { PrivateSandbox } from './native.js';
import { privateProcess } from './private-pipe.js';
import { SecretGuard } from './parser.js';

type ReadResult = { status: number; body: unknown } | null;
/** Resolve a bounded REST reference only when its canonical URL remains inside target scope. */
const canonicalReference = (value: string, origin: string, target: Target) => {
  if (value.length > 512 || value.includes('?') || value.includes('#') || value.includes('%')) return null;
  let url: URL;
  try {
    url = new URL(value, origin);
  } catch {
    return null;
  }
  if (
    url.origin !== origin ||
    !urlSchema.safeParse(url.href).success ||
    !pathAllowed(url.pathname, target) ||
    !/^(?:\/[A-Za-z0-9_~.-]+)+\/?$/.test(url.pathname) ||
    url.pathname.includes('..')
  )
    return null;
  return url.pathname;
};
/** Match an observed path against fixed and parameterized route-template segments. */
const routeMatches = (template: string, path: string) => {
  const expected = template.split('/');
  const actual = path.split('/');
  return (
    expected.length === actual.length &&
    expected.every((part, index) => (/^\{[A-Za-z][A-Za-z0-9_]*\}$/.test(part) ? true : part === actual[index]))
  );
};

/** Read-only REST client run inside the already inspected, firewalled native sandbox. */
export class RestJsonReader {
  private readonly origin: string;
  private readonly observations: Observation[] = [];
  private requests = 0;
  partial = false;
  constructor(
    private readonly sandbox: PrivateSandbox,
    private readonly target: Target,
    private readonly profile: Profile,
    private readonly proxy: string,
    private readonly guard: SecretGuard,
    private readonly signal: AbortSignal,
    private readonly validate: () => Promise<void>,
    private readonly observePrincipal?: (body: unknown) => void,
  ) {
    this.origin = new URL(target.entryUrl).origin;
  }
  /** Fetch an authorized REST resource through the confined gateway within shared budgets. */
  private async read(path: string): Promise<ReadResult> {
    const canonical = canonicalReference(path, this.origin, this.target);
    if (!canonical || canonical !== path || !this.target.permittedMethods.includes('GET')) return null;
    if (this.requests >= Math.min(24, this.target.scanLimits.maxRequests)) {
      this.partial = true;
      return null;
    }
    await this.validate();
    this.signal.throwIfAborted();
    this.requests++;
    let output = '';
    let stderr = '';
    const execution = await privateProcess(this.sandbox, restCommand(`${this.origin}${path}`, this.proxy), {
      timeout: 15000,
      totalLimit: 65536,
      abortSignal: this.signal,
      onStdout: chunk => {
        output += chunk;
      },
      onStderr: chunk => {
        stderr += chunk;
      },
    });
    if (this.guard.unsafe(output) || this.guard.unsafe(stderr) || execution.pipe.stopReason) {
      this.partial = true;
      return null;
    }
    for (const line of output.split('\n').slice(0, 16)) {
      let record: unknown;
      try {
        record = JSON.parse(line);
      } catch {
        continue;
      }
      if (!record || typeof record !== 'object') continue;
      const item = record as {
        request?: { method?: unknown; endpoint?: unknown };
        response?: {
          status_code?: unknown;
          headers?: unknown;
          body?: unknown;
        };
      };
      if (
        item.request?.method !== 'GET' ||
        item.request.endpoint !== `${this.origin}${path}` ||
        !item.response ||
        typeof item.response.status_code !== 'number' ||
        !item.response.headers ||
        typeof item.response.headers !== 'object'
      )
        continue;
      const responseHeaders = item.response.headers as Record<string, unknown>;
      const marker = (name: string) =>
        Object.entries(responseHeaders).some(
          ([key, value]) =>
            key.toLowerCase() === name &&
            (value === '1' || (Array.isArray(value) && value.length === 1 && value[0] === '1')),
        );
      if (marker('x-scanner-policy-denied') || !marker('x-scanner-upstream-observed')) return null;
      const status = item.response.status_code;
      if (
        !execution.success ||
        status !== 200 ||
        !Object.entries(responseHeaders).some(
          ([key, value]) =>
            key.toLowerCase() === 'content-type' &&
            typeof value === 'string' &&
            /^application\/json(?:;|$)/i.test(value),
        )
      )
        return { status, body: null };
      if (typeof item.response.body !== 'string' || Buffer.byteLength(item.response.body) > 32768)
        return { status, body: null };
      try {
        return { status, body: JSON.parse(item.response.body) as unknown };
      } catch {
        return { status, body: null };
      }
    }
    return null;
  }
  /** Persist a sanitized REST observation only when it is inside the authorized evidence boundary. */
  private emit(path: string, rule: RouteAccessRule, status?: number, linkedFrom?: string) {
    const observation = observationSchema.safeParse({
      kind: 'endpoint',
      role: this.profile.role,
      profileId: this.profile.id,
      source: 'rest-json',
      provenance: status === undefined ? 'advertised' : 'upstream-response',
      origin: this.origin,
      path,
      method: 'GET',
      parameterNames: [...rule.pathTemplate.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map(match => match[1]),
      routeTemplate: rule.pathTemplate,
      ...(linkedFrom === undefined ? {} : { linkedFrom }),
      ...(status === undefined ? {} : { status }),
    });
    if (!observation.success || this.guard.unsafe(JSON.stringify(observation.data))) {
      this.partial = true;
      return;
    }
    if (
      !this.observations.some(
        item =>
          item.path === path && item.profileId === this.profile.id && item.provenance === observation.data.provenance,
      )
    )
      this.observations.push(observation.data);
  }
  /** Extract bounded in-scope API references from the configured discovery documents. */
  private references(value: unknown, detailRules: RouteAccessRule[]): Array<{ path: string; rule: RouteAccessRule }> {
    const arrays = Array.isArray(value)
      ? [value]
      : value && typeof value === 'object'
        ? Object.values(value).filter(Array.isArray)
        : [];
    if (arrays.length !== 1) return [];
    const result: Array<{ path: string; rule: RouteAccessRule }> = [];
    for (const item of arrays[0]!.slice(0, 8)) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const fields = item as Record<string, unknown>;
      let path: string | null = null;
      if (typeof fields.href === 'string') path = canonicalReference(fields.href, this.origin, this.target);
      const rule = path && detailRules.find(candidate => routeMatches(candidate.pathTemplate, path!));
      if (path && rule && !result.some(value => value.path === path)) result.push({ path, rule });
    }
    return result;
  }
  /** Resolve observed collection/detail links without inventing unobserved object identifiers. */
  private detailLinks(value: unknown, detailRules: RouteAccessRule[]) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    const result: Array<{ path: string; rule: RouteAccessRule }> = [];
    for (const [name, reference] of Object.entries(value).slice(0, 32)) {
      if (!/^(?:href|[A-Za-z][A-Za-z0-9]*Href)$/.test(name) || typeof reference !== 'string') continue;
      const path = canonicalReference(reference, this.origin, this.target);
      const rule = path && detailRules.find(candidate => routeMatches(candidate.pathTemplate, path));
      if (path && rule && !result.some(item => item.path === path)) result.push({ path, rule });
    }
    return result.slice(0, 8);
  }
  /** Discover authorized REST resources from supported documents and observed JSON links. */
  async discover(accessCheckPath?: string, identityOnly = false) {
    const rules = (this.target.routeAccessRules ?? []).filter(
      rule => rule.source === 'operator' && rule.method === 'GET',
    );
    const collections = rules.filter(rule => !rule.pathTemplate.includes('{')).slice(0, 8);
    const details = rules.filter(rule => rule.pathTemplate.includes('{'));
    const pending = new Map<string, { path: string; rule: RouteAccessRule; linkedFrom: string }>();
    let access: ReadResult | undefined;
    if (accessCheckPath) {
      access = await this.read(accessCheckPath);
      if (access?.status !== 200 || access.body === null)
        return { observations: [], accessReady: false, partial: true };
      this.observePrincipal?.(access.body);
      if (identityOnly) return { observations: [], accessReady: true, partial: this.partial };
    }
    if (identityOnly) return { observations: [], accessReady: true, partial: this.partial };
    if (this.target.application?.kind === 'rest_api' && this.target.application.discoveryModes.includes('openapi')) {
      const documentUrl = new URL(this.target.application.openApiUrl!);
      if (documentUrl.origin !== this.origin) this.partial = true;
      else {
        const document = await this.read(documentUrl.pathname);
        const openApi = document?.body;
        if (
          document?.status !== 200 ||
          !openApi ||
          typeof openApi !== 'object' ||
          Array.isArray(openApi) ||
          !('paths' in openApi) ||
          !openApi.paths ||
          typeof openApi.paths !== 'object' ||
          Array.isArray(openApi.paths)
        )
          this.partial = true;
        else
          for (const rule of collections) {
            const advertised = (openApi.paths as Record<string, unknown>)[rule.pathTemplate];
            if (advertised && typeof advertised === 'object' && 'get' in advertised) this.emit(rule.pathTemplate, rule);
          }
      }
    }
    for (const rule of collections) {
      const response = rule.pathTemplate === accessCheckPath ? access! : await this.read(rule.pathTemplate);
      if (!response || response.status !== 200 || response.body === null) {
        this.partial = true;
        continue;
      }
      this.emit(rule.pathTemplate, rule, response.status);
      if (ownerOnlyReadRule(rule))
        for (const reference of this.references(response.body, details.filter(ownerOnlyReadRule)))
          pending.set(reference.path, { ...reference, linkedFrom: rule.pathTemplate });
    }
    const secondary = new Map<string, { path: string; rule: RouteAccessRule; linkedFrom: string }>();
    for (const { path, rule, linkedFrom } of [...pending.values()].slice(0, 8)) {
      const response = await this.read(path);
      if (response?.status === 200 && response.body !== null) {
        this.emit(path, rule, response.status, linkedFrom);
        for (const link of this.detailLinks(response.body, details.filter(ownerOnlyReadRule)))
          if (!pending.has(link.path)) secondary.set(link.path, { ...link, linkedFrom: path });
      } else this.partial = true;
    }
    for (const { path, rule, linkedFrom } of [...secondary.values()].slice(0, 8)) {
      const response = await this.read(path);
      if (response?.status === 200 && response.body !== null) this.emit(path, rule, response.status, linkedFrom);
      else this.partial = true;
    }
    return { observations: this.observations, accessReady: true, partial: this.partial };
  }
}
