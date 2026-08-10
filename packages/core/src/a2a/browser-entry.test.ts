import { existsSync, readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const distEntry = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../dist/a2a/client.js');
const builtins = new Set(builtinModules);

function collectBuiltinImports(entry: string): string[] {
  const visited = new Set<string>();
  const found: string[] = [];

  const walk = (file: string) => {
    if (visited.has(file)) return;
    visited.add(file);

    const code = readFileSync(file, 'utf8');
    for (const match of code.matchAll(/from "([^"]+)"|^import "([^"]+)"/gm)) {
      const specifier = match[1] ?? match[2]!;
      if (specifier.startsWith('.')) {
        walk(path.resolve(path.dirname(file), specifier));
      } else if (builtins.has(specifier.replace(/^node:/, ''))) {
        found.push(`${path.basename(file)} -> ${specifier}`);
      }
    }
  };

  walk(entry);
  return found;
}

// `@mastra/client-js` imports this entry, and that gets bundled for the browser by Next and
// friends, so nothing in its chunk graph may reach for a Node builtin.
describe('a2a/client build output', () => {
  it.skipIf(!existsSync(distEntry))('imports no Node builtins', () => {
    expect(collectBuiltinImports(distEntry)).toEqual([]);
  });
});
