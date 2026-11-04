import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { canonicalJson, hashBytes } from '../src/mastra/domain/case-contracts.js';

/** Bind live evidence to evaluator, native processing and report/review source bytes. */
export async function evaluatedSourceIdentity() {
  const files = [
    ...(await readdir(resolve('src'), { recursive: true }))
      .filter(path => path.endsWith('.ts'))
      .map(path => 'src/' + path),
    ...(await readdir(resolve('scripts')))
      .filter(path => /^(?:live-)?evaluation.*\.ts$/.test(path))
      .map(path => 'scripts/' + path),
    'package.json',
    ...[
      '@mastra/core',
      '@mastra/libsql',
      '@mastra/memory',
      '@ai-sdk/openai',
      'pdfjs-dist',
      'pdfkit',
      'zod',
      '@libsql/client',
    ].map(name => 'node_modules/' + name + '/package.json'),
    'tests/report-runtime.ts',
    'tests/reconciliation-fixtures.ts',
    'tests/evaluation-fixtures.ts',
  ].sort();
  const entries = await Promise.all(
    files.map(async path => ({ path, sha256: hashBytes(await readFile(resolve(path))) })),
  );
  return {
    sha256: hashBytes(canonicalJson(entries)),
    promptVersion: 'insurance-2' as const,
    schemaVersion: 'reconciliation-1' as const,
  };
}
