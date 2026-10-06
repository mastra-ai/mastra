/**
 * Scans the write-up, results, staged diff and any extra files (e.g. a PR body draft) for
 * credential values, real org/project ids, the hash salt and discovered literals.
 * Prints only `clean` or per-file match counts — never the matched values.
 *
 *   tsx bench/shared/leak-check.ts [--no-staged] [extra files…]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseArgs } from 'node:util';

import { EntityType, SpanType } from '@mastra/core/observability';

import { ALLOWED_HOST, CACHE_DIR, ENV_FILE, installOutputRedaction, readEnvFileValues, registerSensitive } from './env';
import { DOC_LITERALS, loadSelection } from './profile';
import type { Literals, Selection } from './profile';

/**
 * Extra discovered literals kept next to the selection (`~/.cache/aqa-bench/<suite>-literals.json`,
 * mode 0600), keyed by project hash. Every value is sensitive.
 */
export interface LiteralSidecar {
  version: 1;
  projects: Record<string, Record<string, string | null | undefined>>;
}

export const SIDECAR_SUFFIX = '-literals.json';

export function loadLiteralSidecars(dir = CACHE_DIR): LiteralSidecar[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(name => name.endsWith(SIDECAR_SUFFIX))
    .map(name => JSON.parse(readFileSync(join(dir, name), 'utf8')) as LiteralSidecar);
}

export type NeedleKind = 'credential' | 'id' | 'salt' | 'literal';

export interface Needle {
  kind: NeedleKind;
  value: string;
}

/** Enum-like fields that are not customer content and would only cause false positives. */
const PUBLIC_LITERAL_KEYS: Array<keyof Literals> = ['entityType'];
/** Conventional environment names are generic vocabulary, not customer content (and collide with schema words). */
const STANDARD_ENVIRONMENTS = new Set([
  'production',
  'prod',
  'staging',
  'stage',
  'development',
  'dev',
  'test',
  'testing',
  'local',
  'preview',
  'qa',
  'uat',
]);

/** Mastra's own span/entity type names are public vocabulary; a project's top value can be one of them. */
const PUBLIC_VOCABULARY = new Set<string>([...Object.values(SpanType), ...Object.values(EntityType)]);

export function needlesFrom(
  env: Record<string, string> | undefined,
  selection: Selection | undefined,
  sidecars: LiteralSidecar[] = [],
): Needle[] {
  const needles: Needle[] = [];
  const add = (kind: NeedleKind, value: string | undefined) => {
    if (value && value.length >= 4) needles.push({ kind, value });
  };
  if (env) {
    add('credential', env.BENCH_CLICKHOUSE_PASSWORD);
    add('credential', env.BENCH_CLICKHOUSE_USER);
    const url = env.BENCH_CLICKHOUSE_URL;
    // The approved host is public (it is in the host guard); a URL is only secret beyond that.
    if (url && !new RegExp(`^https://${ALLOWED_HOST.replace(/\./g, '\\.')}(:8443)?/?$`).test(url))
      add('credential', url);
  }
  if (selection) {
    add('salt', selection.salt);
    for (const project of selection.projects) {
      add('id', project.organizationId);
      add('id', project.projectId);
      for (const key of Object.keys(project.literalSource) as Array<keyof Literals>) {
        const value = project.literals[key];
        if (project.literalSource[key] !== 'discovered' || PUBLIC_LITERAL_KEYS.includes(key)) continue;
        if (Object.values(DOC_LITERALS).includes(value)) continue;
        if (key === 'environment' && STANDARD_ENVIRONMENTS.has(value)) continue;
        add('literal', value);
      }
    }
  }
  for (const sidecar of sidecars) {
    for (const literals of Object.values(sidecar.projects)) {
      for (const value of Object.values(literals)) {
        if (
          !value ||
          Object.values(DOC_LITERALS).includes(value) ||
          STANDARD_ENVIRONMENTS.has(value) ||
          PUBLIC_VOCABULARY.has(value.toLowerCase())
        )
          continue;
        add('literal', value);
      }
    }
  }
  return needles;
}

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Credentials and ids match anywhere. Discovered literals (customer words) match only as whole tokens:
 * the same word inside a longer code identifier is not a disclosure, a standalone occurrence is.
 */
function occurrences(text: string, kind: NeedleKind, form: string): number {
  if (kind !== 'literal') return text.split(form).length - 1;
  return (text.match(new RegExp(`(?<![A-Za-z0-9_])${escape(form)}(?![A-Za-z0-9_])`, 'g')) ?? []).length;
}

export function countMatches(text: string, needles: Needle[]): Partial<Record<NeedleKind, number>> {
  const counts: Partial<Record<NeedleKind, number>> = {};
  for (const { kind, value } of needles) {
    for (const form of new Set([value, encodeURIComponent(value)])) {
      const n = occurrences(text, kind, form);
      if (n) counts[kind] = (counts[kind] ?? 0) + n;
    }
  }
  return counts;
}

function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? filesUnder(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

function main(): number {
  installOutputRedaction();
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { 'no-staged': { type: 'boolean', default: false } },
  });
  const env = existsSync(ENV_FILE) ? readEnvFileValues() : undefined;
  if (env) registerSensitive(Object.values(env));
  const needles = needlesFrom(env, loadSelection(), loadLiteralSidecars());
  if (!needles.length) {
    process.stdout.write('No credentials or selection found; nothing to check against.\n');
    return 1;
  }

  // Every suite under bench/: its write-ups, README and results.
  const benchDir = join(import.meta.dirname, '..');
  const suiteFiles = readdirSync(benchDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .flatMap(entry => {
      const dir = join(benchDir, entry.name);
      const docs = readdirSync(dir).filter(name => /^(FINDINGS.*|README)\.md$/.test(name));
      return [...docs.map(name => join(dir, name)), ...filesUnder(join(dir, 'results'))];
    });
  const sources: Array<{ name: string; text: string }> = [];
  for (const file of [...suiteFiles, ...positionals]) {
    if (existsSync(file)) sources.push({ name: relative(process.cwd(), file), text: readFileSync(file, 'utf8') });
  }
  if (!values['no-staged']) {
    const diff = execFileSync('git', ['diff', '--cached'], { encoding: 'utf8', maxBuffer: 256 * 2 ** 20 });
    sources.push({ name: 'git diff --cached', text: diff });
  }

  let dirty = 0;
  for (const source of sources) {
    const counts = countMatches(source.text, needles);
    const total = Object.values(counts).reduce((s, n) => s + n, 0);
    if (!total) continue;
    dirty += total;
    const detail = Object.entries(counts)
      .map(([kind, n]) => `${n} ${kind}`)
      .join(', ');
    process.stdout.write(`${total} matches in ${source.name} (${detail})\n`);
  }
  process.stdout.write(
    dirty ? `NOT CLEAN (${sources.length} sources checked)\n` : `clean (${sources.length} sources checked)\n`,
  );
  return dirty ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) process.exit(main());
