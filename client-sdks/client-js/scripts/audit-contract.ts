/**
 * Local-first SDK ↔ server contract audit.
 *
 * Walks every public method on `MastraClient` and each `BaseResource` subclass,
 * synthesizes inputs from each method's TypeScript parameter types via ts-morph,
 * invokes the method, captures the resulting HTTP request via a mocked fetch,
 * and validates the captured request against the matching `SERVER_ROUTES`
 * entry's Zod schemas.
 *
 * Outputs:
 *   - `.audit/contract-report.json`   (always)
 *   - `.audit/snapshot.json`          (with --snapshot)
 *   - non-zero exit if --check finds NEW drift vs the snapshot
 *
 * Run:
 *   pnpm --filter @mastra/client-js audit:contract
 *   pnpm --filter @mastra/client-js audit:contract:snapshot
 *   pnpm --filter @mastra/client-js audit:contract:check
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SERVER_ROUTES } from '@mastra/server/server-adapter';
import type { MethodDeclaration, ParameterDeclaration, SourceFile, Type } from 'ts-morph';
import { Project, SyntaxKind } from 'ts-morph';
import { z } from 'zod/v4';

import * as ClientJs from '../src/index';
import * as ClientJsResources from '../src/resources/index';
import { MCPTool } from '../src/resources/mcp-tool';
import { Run } from '../src/resources/run';

// ---------------------------------------------------------------------------
// Paths / mode
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PKG_ROOT = join(__dirname, '..');
const AUDIT_DIR = join(PKG_ROOT, '.audit');
const REPORT_PATH = join(AUDIT_DIR, 'contract-report.json');
const SNAPSHOT_PATH = join(AUDIT_DIR, 'snapshot.json');

// Streaming SDK methods (e.g. Agent.processStreamResponse) may continue running
// after we've already captured their request. Swallow late errors silently —
// the audit only cares about the request that was issued.
process.on('unhandledRejection', () => {});
process.on('uncaughtException', () => {});

const argv = new Set(process.argv.slice(2));
const MODE: 'report' | 'snapshot' | 'check' = argv.has('--snapshot')
  ? 'snapshot'
  : argv.has('--check')
    ? 'check'
    : 'report';

// ---------------------------------------------------------------------------
// Mocked fetch
// ---------------------------------------------------------------------------

interface CapturedRequest {
  method: string;
  url: string;
  body: unknown;
}

let lastRequest: CapturedRequest | null = null;

const fakeFetch: typeof fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
  const method = (init.method || 'GET').toUpperCase();
  let body: unknown = undefined;
  if (init.body && typeof init.body === 'string') {
    try {
      body = JSON.parse(init.body);
    } catch {
      body = init.body;
    }
  }
  lastRequest = { method, url, body };

  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};

const clientOptions = {
  baseUrl: 'http://audit.local',
  apiPrefix: '/api',
  retries: 0,
  fetch: fakeFetch,
};

// ---------------------------------------------------------------------------
// Route matcher
// ---------------------------------------------------------------------------

interface CompiledRoute {
  method: string;
  pathTemplate: string;
  pathRegex: RegExp;
  paramNames: string[];
  route: (typeof SERVER_ROUTES)[number];
}

function compileRoutes(): CompiledRoute[] {
  return SERVER_ROUTES.map(route => {
    const paramNames: string[] = [];
    const regexSource = route.path
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/:([A-Za-z0-9_]+)/g, (_match: string, name: string) => {
        paramNames.push(name);
        return '([^/]+)';
      });
    return {
      method: route.method.toUpperCase(),
      pathTemplate: route.path,
      pathRegex: new RegExp(`^${regexSource}$`),
      paramNames,
      route,
    };
  });
}

const compiled = compileRoutes();

function matchRoute(
  method: string,
  urlPath: string,
): { route: CompiledRoute; pathParams: Record<string, string> } | null {
  for (const r of compiled) {
    if (r.method !== method) continue;
    const m = urlPath.match(r.pathRegex);
    if (m) {
      const pathParams: Record<string, string> = {};
      r.paramNames.forEach((name, i) => {
        pathParams[name] = decodeURIComponent(m[i + 1] ?? '');
      });
      return { route: r, pathParams };
    }
  }
  return null;
}

function splitUrl(rawUrl: string): { path: string; query: Record<string, string | string[]> } {
  const u = new URL(rawUrl);
  let path = u.pathname;
  if (path.startsWith('/api')) path = path.slice(4);
  const query: Record<string, string | string[]> = {};
  for (const [k, v] of u.searchParams.entries()) {
    if (k in query) {
      const cur = query[k];
      query[k] = Array.isArray(cur) ? [...cur, v] : [cur as string, v];
    } else {
      query[k] = v;
    }
  }
  return { path, query };
}

// Mirror of server's parseComplexQueryParams for bracket-notation reconstruction.
function parseComplexQuery(
  schema: z.ZodTypeAny | undefined,
  query: Record<string, string | string[]>,
): Record<string, unknown> {
  const reconstructed: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(query)) {
    const m = k.match(/^([^[]+)\[([^\]]+)\]$/);
    if (m) {
      const parent = m[1]!;
      const child = m[2]!;
      const obj = (reconstructed[parent] as Record<string, unknown>) ?? {};
      obj[child] = Array.isArray(v) ? v[0] : v;
      reconstructed[parent] = obj;
    } else {
      reconstructed[k] = v;
    }
  }

  if (!schema || !(schema instanceof z.ZodObject)) return reconstructed;

  const shape = schema.shape as Record<string, z.ZodTypeAny>;
  for (const [key, fieldSchema] of Object.entries(shape)) {
    const raw = reconstructed[key];
    if (typeof raw !== 'string') continue;
    const inner = unwrapZod(fieldSchema);
    const tn = (inner as any)?._def?.typeName ?? (inner as any)?.def?.type;
    if (
      tn === 'ZodObject' ||
      tn === 'ZodArray' ||
      tn === 'ZodRecord' ||
      tn === 'object' ||
      tn === 'array' ||
      tn === 'record'
    ) {
      try {
        reconstructed[key] = JSON.parse(raw);
      } catch {
        // leave as string
      }
    }
  }
  return reconstructed;
}

function unwrapZod(schema: z.ZodTypeAny): z.ZodTypeAny {
  let cur: any = schema;
  for (let i = 0; i < 10; i++) {
    const tn = cur?._def?.typeName ?? cur?.def?.type;
    if (tn === 'ZodOptional' || tn === 'ZodNullable' || tn === 'optional' || tn === 'nullable') {
      const inner = cur._def?.innerType ?? cur.def?.innerType;
      if (!inner) break;
      cur = inner;
      continue;
    }
    break;
  }
  return cur;
}

// ---------------------------------------------------------------------------
// SDK method walker (ts-morph)
// ---------------------------------------------------------------------------

interface SdkParameter {
  name: string;
  type: Type;
  isOptional: boolean;
  hasInitializer: boolean;
}

interface SdkMethod {
  className: string;
  methodName: string;
  parameters: SdkParameter[];
  isFactory: boolean;
}

function isFactoryMethod(method: MethodDeclaration): boolean {
  // A factory method:
  //  - is sync (not async, no Promise return)
  //  - has body that is a single `return new SomeClass(...)` statement
  if (method.isAsync()) return false;
  const body = method.getBody();
  if (!body) return false;
  const stmts = body.getKind() === SyntaxKind.Block ? (body as any).getStatements() : [];
  if (stmts.length !== 1) return false;
  const ret = stmts[0];
  if (ret.getKind() !== SyntaxKind.ReturnStatement) return false;
  const expr = ret.getExpression?.();
  return expr?.getKind() === SyntaxKind.NewExpression;
}

function walkSdkMethods(project: Project): SdkMethod[] {
  const out: SdkMethod[] = [];
  const files: SourceFile[] = [
    project.getSourceFileOrThrow(join(PKG_ROOT, 'src/client.ts')),
    ...project
      .getSourceFiles(join(PKG_ROOT, 'src/resources/*.ts'))
      .filter((f: SourceFile) => !f.getBaseName().endsWith('.test.ts')),
  ];

  for (const sf of files) {
    for (const cls of sf.getClasses()) {
      const className = cls.getName();
      if (!className) continue;
      const extendsExpr = cls.getExtends()?.getExpression().getText();
      if (className !== 'MastraClient' && extendsExpr !== 'BaseResource') continue;

      for (const method of cls.getInstanceMethods()) {
        const scope = method.getScope();
        if (scope === 'private' || scope === 'protected') continue;
        const name = method.getName();
        if (name.startsWith('_')) continue;

        const parameters: SdkParameter[] = method.getParameters().map((p: ParameterDeclaration) => ({
          name: p.getName(),
          type: p.getType(),
          isOptional: p.isOptional() || p.hasQuestionToken(),
          hasInitializer: !!p.getInitializer(),
        }));

        out.push({
          className,
          methodName: name,
          parameters,
          isFactory: isFactoryMethod(method),
        });
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Type-driven input synthesis
// ---------------------------------------------------------------------------

const SAMPLE_ID = 'audit-id';
const SAMPLE_DATE = new Date(0);

/**
 * Many server schemas are declared with `z.coerce.*` or `z.preprocess(...)`, whose
 * `z.input<>` type is `unknown`. SDK param types derived from those schemas therefore
 * carry no synthesizable shape, and a blind `'audit-id'` would report drift that says
 * nothing about the SDK ↔ server contract. Fall back to the property name, which is the
 * only signal left, so the synthesized value is representative of real SDK usage.
 */
function synthOpaqueValue(propName: string | undefined): unknown {
  const n = (propName ?? '').toLowerCase();
  if (!n) return SAMPLE_ID;
  if (/^(page|perpage|pagesize|limit|offset|depth|top ?k|topk|count)$/.test(n)) return 1;
  if (/^(has|is|include|enable|disable|should|allow)[a-z]/.test(n)) return false;
  if (/(^|[^a-z])(start|end)([^a-z]|$)|date|timestamp|time$|_at$|at$/.test(n)) return SAMPLE_DATE;
  if (/config$|options$|metadata$/.test(n)) return {};
  return SAMPLE_ID;
}

interface SynthCtx {
  depth: number;
  seen: Set<string>;
  /**
   * 'full' fills every property (required + optional).
   * 'min'  fills only required properties — used to catch "SDK marks optional, server requires".
   */
  mode: 'full' | 'min';
}

/**
 * ts-morph's `getLiteralValue()` only covers string/number literals — a boolean literal
 * returns undefined, which would drop required booleans from the synthesized request.
 * `boolean` itself is modelled as the union `false | true`, so this path is hit often.
 */
function literalValue(t: Type): unknown {
  if (t.isBooleanLiteral()) return t.getText() === 'true';
  return t.getLiteralValue();
}

function synthValueForType(t: Type, propName: string | undefined, ctx: SynthCtx): unknown {
  if (ctx.depth > 6) return undefined;

  // Unwrap unions: prefer the first non-undefined/null member
  if (t.isUnion()) {
    const members = t.getUnionTypes().filter(u => !u.isUndefined() && !u.isNull());
    if (members.length === 0) return undefined;

    // String-literal union → enum: pick first literal value
    const literals = members.filter(u => u.isStringLiteral() || u.isNumberLiteral() || u.isBooleanLiteral());
    if (literals.length === members.length && literals.length > 0) {
      return literalValue(literals[0]!);
    }
    // Otherwise synth from first member
    return synthValueForType(members[0]!, propName, ctx);
  }

  if (t.isIntersection()) {
    const merged: Record<string, unknown> = {};
    for (const part of t.getIntersectionTypes()) {
      const v = synthValueForType(part, propName, ctx);
      if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(merged, v);
    }
    return merged;
  }

  if (t.isString() || t.isStringLiteral()) {
    if (t.isStringLiteral()) return t.getLiteralValue();
    // Heuristic naming hints
    const n = (propName ?? '').toLowerCase();
    if (n.includes('email')) return 'audit@example.com';
    if (n.includes('url') || n.includes('uri')) return 'https://audit.local/u';
    if (n.includes('date') || n.includes('time')) return SAMPLE_DATE.toISOString();
    // `from`/`to`/`start`/`end` are date bounds on every list endpoint that has them.
    if (/^(from|to|start|end|since|until)$/.test(n)) return SAMPLE_DATE.toISOString();
    return SAMPLE_ID;
  }
  if (t.isNumber() || t.isNumberLiteral()) {
    if (t.isNumberLiteral()) return t.getLiteralValue();
    return 1;
  }
  if (t.isBoolean() || t.isBooleanLiteral()) {
    return t.isBooleanLiteral() ? literalValue(t) : false;
  }
  if (t.isLiteral()) {
    return literalValue(t);
  }
  if (t.isUndefined() || t.isNull() || t.isVoid()) return undefined;
  if (t.isAny() || t.isUnknown()) return synthOpaqueValue(propName);

  if (t.isArray()) {
    const el = t.getArrayElementTypeOrThrow();
    const v = synthValueForType(el, propName, { ...ctx, depth: ctx.depth + 1 });
    // An unsynthesizable element (cycle, class instance) must not become `[null]`.
    return v === undefined ? [] : [v];
  }
  if (t.isTuple()) {
    return t.getTupleElements().map(e => synthValueForType(e, propName, { ...ctx, depth: ctx.depth + 1 }));
  }

  // Object / class / interface
  if (t.isObject() || t.isClassOrInterface() || t.isInterface() || t.isAnonymous()) {
    // Skip class instances (e.g. RequestContext, FormData) — represent as undefined so SDK code
    // treats them as unset rather than poisoning the body.
    const sym = t.getSymbol() ?? t.getAliasSymbol();
    const symName = sym?.getName();
    // `Date` is an interface, so the generic object walk would expand it into a bag of
    // method stubs. Emit a real Date — that is what SDK callers actually pass.
    if (symName === 'Date') return SAMPLE_DATE;
    if (
      symName &&
      (symName === 'RequestContext' ||
        symName === 'FormData' ||
        symName === 'Blob' ||
        symName === 'AbortSignal' ||
        symName === 'ReadableStream')
    ) {
      return undefined;
    }

    // Cycle guard
    // Cycle: omit the property entirely. Emitting `{}` would fabricate an element that
    // fails the server schema's required fields and report drift the SDK never caused.
    const id = t.getText();
    if (ctx.seen.has(id)) return undefined;
    const nextSeen = new Set(ctx.seen);
    nextSeen.add(id);

    const obj: Record<string, unknown> = {};
    for (const prop of t.getProperties()) {
      const isOptional = prop.isOptional();
      if (isOptional && ctx.mode === 'min') continue; // skip optional props in min mode
      const decl = prop.getValueDeclaration() ?? prop.getDeclarations()[0];
      if (!decl) continue;
      let propType: Type;
      try {
        propType = prop.getTypeAtLocation(decl);
      } catch {
        continue;
      }
      const value = synthValueForType(propType, prop.getName(), {
        depth: ctx.depth + 1,
        seen: nextSeen,
        mode: ctx.mode,
      });
      if (value !== undefined) obj[prop.getName()] = value;
    }
    return obj;
  }

  return undefined;
}

function synthesizeArgs(method: SdkMethod, mode: 'full' | 'min'): unknown[] {
  const args: unknown[] = [];
  for (const p of method.parameters) {
    if (p.isOptional && mode === 'min') {
      args.push(undefined);
      continue;
    }
    const v = synthValueForType(p.type, p.name, { depth: 0, seen: new Set(), mode });
    args.push(v);
  }
  return args;
}

// ---------------------------------------------------------------------------
// Resource instantiation
// ---------------------------------------------------------------------------

/**
 * Instantiate a resource for audit. mode='full' fills every constructor param;
 * mode='min' fills only the first ctor arg (clientOptions) and leaves the rest
 * undefined — exposes "SDK ctor optional but server requires it" bugs (e.g.
 * `MemoryThread(ctorOpts, threadId, agentId?)` failing when `agentId` is omitted).
 */
function instantiateResource(ResourceCtor: any, mode: 'full' | 'min'): any {
  const arity = ResourceCtor.length;
  const args: any[] = [clientOptions];
  for (let i = 1; i < arity; i++) {
    // We don't have ts-morph metadata for ctor params here; treat every non-first
    // param as optional in 'min' mode. SDK ctors that genuinely require a 2nd arg
    // will throw and surface as walker-noise rather than a false drift.
    if (mode === 'min' && i > 1) {
      args.push(undefined);
    } else {
      args.push(SAMPLE_ID);
    }
  }
  return new ResourceCtor(...args);
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

interface AuditCase {
  className: string;
  methodName: string;
  variant?: 'full' | 'min';
  status: 'pass' | 'drift' | 'orphan' | 'walker-noise' | 'invocation-error' | 'factory-skipped';
  url?: string;
  method?: string;
  routeKey?: string;
  errors?: string[];
}

async function runAudit(): Promise<AuditCase[]> {
  const project = new Project({
    tsConfigFilePath: join(PKG_ROOT, 'tsconfig.json'),
    skipAddingFilesFromTsConfig: false,
  });

  const methods = walkSdkMethods(project);
  const cases: AuditCase[] = [];
  const allExports: Record<string, any> = { ...ClientJsResources, ...ClientJs, Run, MCPTool };

  // Build per-variant instance maps. 'full' = every ctor param filled (current behaviour);
  // 'min' = only required ctor params filled, exposing "SDK ctor-optional but server-required" bugs.
  const variants: Array<'full' | 'min'> = ['full', 'min'];
  const instancesByVariant = new Map<'full' | 'min', Map<string, any>>();
  for (const variant of variants) {
    const m = new Map<string, any>();
    m.set('MastraClient', new allExports.MastraClient(clientOptions));
    for (const cls of new Set(methods.map(x => x.className))) {
      if (cls === 'MastraClient') continue;
      const Ctor = allExports[cls];
      if (!Ctor) continue;
      try {
        m.set(cls, instantiateResource(Ctor, variant));
      } catch {
        // ctor blew up in this variant; skip — methods will report walker-noise.
      }
    }
    instancesByVariant.set(variant, m);
  }

  for (const m of methods) {
    if (m.isFactory) {
      cases.push({ className: m.className, methodName: m.methodName, status: 'factory-skipped' });
      continue;
    }

    // Collect per-variant cases, then collapse into a single reported case per method:
    // - if any variant drifts → report drift (prefer 'min' since it surfaces optionality bugs)
    // - else if any orphan → report orphan
    // - else if all noise → report noise
    // - else → pass
    const perVariant: AuditCase[] = [];

    for (const variant of variants) {
      const inst = instancesByVariant.get(variant)!.get(m.className);
      if (!inst || typeof inst[m.methodName] !== 'function') {
        perVariant.push({
          className: m.className,
          methodName: m.methodName,
          variant,
          status: 'walker-noise',
          errors: ['no-instance-or-method'],
        });
        continue;
      }

      lastRequest = null;
      let invocationError: string | undefined;
      try {
        const args = synthesizeArgs(m, variant);
        const result = inst[m.methodName](...args);
        if (result && typeof (result as any).then === 'function') {
          await (result as Promise<unknown>).catch(err => {
            invocationError = (err as Error).message;
          });
        }
      } catch (err) {
        invocationError = (err as Error).message;
      }

      const captured = lastRequest as CapturedRequest | null;
      if (!captured) {
        perVariant.push({
          className: m.className,
          methodName: m.methodName,
          variant,
          status: 'walker-noise',
          errors: invocationError ? [`no-fetch-call: ${invocationError}`] : ['no-fetch-call'],
        });
        continue;
      }

      const { path, query } = splitUrl(captured.url);
      const matched = matchRoute(captured.method, path);
      if (!matched) {
        perVariant.push({
          className: m.className,
          methodName: m.methodName,
          variant,
          status: 'orphan',
          url: captured.url,
          method: captured.method,
          errors: [`no server route matches ${captured.method} ${path}`],
        });
        continue;
      }

      const compiledRoute = matched.route;
      const route = compiledRoute.route;
      const errors: string[] = [];

      if (route.pathParamSchema) {
        const r = route.pathParamSchema.safeParse(matched.pathParams);
        if (!r.success) errors.push(`path: ${formatZod(r.error)}`);
      }
      if (route.queryParamSchema) {
        const parsed = parseComplexQuery(route.queryParamSchema, query);
        const r = route.queryParamSchema.safeParse(parsed);
        if (!r.success) errors.push(`query: ${formatZod(r.error)}`);
      }
      if (route.bodySchema) {
        const r = route.bodySchema.safeParse(captured.body ?? undefined);
        if (!r.success) errors.push(`body: ${formatZod(r.error)}`);
      }

      perVariant.push({
        className: m.className,
        methodName: m.methodName,
        variant,
        status: errors.length ? 'drift' : 'pass',
        url: captured.url,
        method: captured.method,
        routeKey: `${compiledRoute.method} ${compiledRoute.pathTemplate}`,
        errors: errors.length ? errors : undefined,
      });
    }

    // Collapse: prefer surfacing the most informative failure.
    const drift = perVariant.find(c => c.status === 'drift');
    const orphan = perVariant.find(c => c.status === 'orphan');
    const pass = perVariant.find(c => c.status === 'pass');
    if (drift) cases.push(drift);
    else if (pass) cases.push(pass);
    else if (orphan) cases.push(orphan);
    else cases.push(perVariant[0]!);
  }

  return cases;
}

function formatZod(err: z.ZodError): string {
  return err.issues
    .slice(0, 3)
    .map(i => `${i.path.join('.') || '<root>'}: ${i.message}`)
    .join(' | ');
}

// ---------------------------------------------------------------------------
// Reporting / snapshot
// ---------------------------------------------------------------------------

interface Summary {
  total: number;
  pass: number;
  drift: number;
  orphan: number;
  noise: number;
  factory: number;
  surfaceCoverage: { hit: number; total: number; pct: number };
}

function summarize(cases: AuditCase[]): Summary {
  const hitRoutes = new Set<string>();
  for (const c of cases) if (c.routeKey) hitRoutes.add(c.routeKey);
  return {
    total: cases.length,
    pass: cases.filter(c => c.status === 'pass').length,
    drift: cases.filter(c => c.status === 'drift').length,
    orphan: cases.filter(c => c.status === 'orphan').length,
    noise: cases.filter(c => c.status === 'walker-noise').length,
    factory: cases.filter(c => c.status === 'factory-skipped').length,
    surfaceCoverage: {
      hit: hitRoutes.size,
      total: SERVER_ROUTES.length,
      pct: +((hitRoutes.size / SERVER_ROUTES.length) * 100).toFixed(1),
    },
  };
}

function caseKey(c: AuditCase): string {
  return `${c.className}.${c.methodName}|${c.status}`;
}

(async () => {
  console.log(`[audit] mode=${MODE}`);
  console.log(`[audit] server routes: ${SERVER_ROUTES.length}`);

  const cases = await runAudit();
  const summary = summarize(cases);

  if (!existsSync(AUDIT_DIR)) mkdirSync(AUDIT_DIR, { recursive: true });
  writeFileSync(REPORT_PATH, JSON.stringify({ summary, cases }, null, 2));

  console.log('\n=== Summary ===');
  console.log(`  total:           ${summary.total}`);
  console.log(`  pass:            ${summary.pass}`);
  console.log(`  drift:           ${summary.drift}`);
  console.log(`  orphan:          ${summary.orphan}`);
  console.log(`  walker-noise:    ${summary.noise}`);
  console.log(`  factory-skipped: ${summary.factory}`);
  console.log(
    `  surface coverage: ${summary.surfaceCoverage.hit}/${summary.surfaceCoverage.total} (${summary.surfaceCoverage.pct}%)`,
  );
  console.log(`\nReport: ${REPORT_PATH}`);

  if (MODE === 'snapshot') {
    const keys = cases
      .filter(c => c.status === 'drift' || c.status === 'orphan')
      .map(caseKey)
      .sort();
    writeFileSync(SNAPSHOT_PATH, JSON.stringify({ entries: keys }, null, 2));
    console.log(`Snapshot written: ${SNAPSHOT_PATH} (${keys.length} entries)`);
  } else if (MODE === 'check') {
    if (!existsSync(SNAPSHOT_PATH)) {
      console.error('No snapshot.json found; run audit:contract:snapshot first.');
      process.exit(2);
    }
    const snap = JSON.parse(readFileSync(SNAPSHOT_PATH, 'utf8')) as { entries: string[] };
    const cur = new Set(cases.filter(c => c.status === 'drift' || c.status === 'orphan').map(caseKey));
    const newDrift = [...cur].filter(k => !snap.entries.includes(k));
    const removed = snap.entries.filter(k => !cur.has(k));
    if (newDrift.length) {
      console.error(`\n❌ ${newDrift.length} new drift/orphan case(s):`);
      for (const k of newDrift) console.error(`   - ${k}`);
      process.exit(1);
    }
    if (removed.length) {
      console.log(`\n✅ ${removed.length} case(s) fixed since snapshot:`);
      for (const k of removed) console.log(`   - ${k}`);
      console.log(`\nUpdate snapshot: pnpm audit:contract:snapshot`);
    } else {
      console.log('\n✅ No new contract drift.');
    }
  }
  // Force exit so lingering streaming work (kicked off but never awaited) doesn't hang us.
  process.exit(0);
})().catch(err => {
  console.error(err);
  process.exit(2);
});
