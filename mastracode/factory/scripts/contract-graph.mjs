// Walks the import graph of the given @mastra/factory modules and reports any that reach
// something a browser contract can't carry (Node built-ins, storage, the code SDK, server deps).
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';

const SRC = resolve(dirname(new URL(import.meta.url).pathname), '../src');
const ALLOWED_BARE = new Set(['zod']);
const typeOnly = /^\s*import\s+type\b|^\s*export\s+type\b/;

function file(spec, from) {
  const base = resolve(dirname(from), spec.replace(/\.js$/, ''));
  for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) if (existsSync(candidate)) return candidate;
  throw new Error(`cannot resolve ${spec} from ${from}`);
}

function imports(path) {
  const out = [];
  const text = readFileSync(path, 'utf8');
  const re = /^(?:import|export)\b[\s\S]*?from\s+'([^']+)'|^import\s+'([^']+)'/gm;
  for (let m; (m = re.exec(text)); ) {
    const spec = m[1] ?? m[2];
    out.push({ spec, type: typeOnly.test(m[0]) });
  }
  return out;
}

export function closure(entries, { types = false } = {}) {
  const seen = new Map();
  const bad = [];
  const stack = entries.map(e => ({ path: resolve(SRC, `${e}.ts`), via: [e] }));
  while (stack.length) {
    const { path, via } = stack.pop();
    if (seen.has(path)) continue;
    seen.set(path, via);
    for (const { spec, type } of imports(path)) {
      if (type && !types) continue;
      if (spec.startsWith('.')) {
        stack.push({ path: file(spec, path), via: [...via, relative(SRC, file(spec, path))] });
      } else if (!ALLOWED_BARE.has(spec)) {
        bad.push({ spec, via: [...via] });
      }
    }
  }
  return { files: [...seen.keys()].map(p => relative(SRC, p)), bad };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const entries = process.argv.slice(2);
  const { files, bad } = closure(entries);
  console.log(`${files.length} files reached`);
  const byEntry = new Map();
  for (const b of bad) {
    const key = b.via[0];
    byEntry.set(key, [...(byEntry.get(key) ?? []), `${b.spec}  <- ${b.via.slice(1).join(' > ') || '(direct)'}`]);
  }
  for (const [entry, lines] of byEntry) {
    console.log(`\n${entry}`);
    for (const line of [...new Set(lines)].slice(0, 6)) console.log(`  ${line}`);
  }
  process.exit(bad.length ? 1 : 0);
}
