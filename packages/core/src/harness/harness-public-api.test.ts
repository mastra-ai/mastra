import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const tscPath = require.resolve('typescript/bin/tsc');
const packageRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

const docsRoot = join(packageRoot, '../../docs');
const harnessReferencePath = join(docsRoot, 'src/content/en/reference/harness/harness-class.mdx');

async function getHarnessReferenceUsageExample() {
  const contents = await readFile(harnessReferencePath, 'utf8');
  const match = contents.match(/```typescript\n([\s\S]*?)\n```/);

  expect(match?.[1]).toBeDefined();

  return `${match![1]}

await harness.switchMode({ modeId: 'build' });
await harness.switchModel({ modelId: '__GATEWAY_OPENAI_MODEL_MINI__' });
const created = await harness.createThread({ title: 'Docs smoke' });
await harness.switchThread({ threadId: created.id });
harness.respondToQuestion({ questionId: 'question-1', answer: 'Yes' });
await harness.respondToPlanApproval({ planId: 'plan-1', response: { action: 'approved' } });
harness.respondToToolApproval({ decision: 'approve' });
`
    .replaceAll('__GATEWAY_OPENAI_MODEL__', 'openai/gpt-5.5')
    .replaceAll('__GATEWAY_OPENAI_MODEL_MINI__', 'openai/gpt-5-mini');
}

describe('Harness public API reference examples', () => {
  it('typechecks documented object-parameter call shapes through the public package export', async () => {
    const tempDir = await mkdtemp(join(packageRoot, '.tmp-harness-public-api-'));
    try {
      await writeFile(join(tempDir, 'harness-public-api-smoke.ts'), await getHarnessReferenceUsageExample());
      await writeFile(
        join(tempDir, 'tsconfig.json'),
        JSON.stringify(
          {
            compilerOptions: {
              target: 'ES2023',
              module: 'NodeNext',
              moduleResolution: 'NodeNext',
              strict: true,
              noEmit: true,
              skipLibCheck: true,
              types: ['node'],
            },
            include: ['harness-public-api-smoke.ts'],
          },
          null,
          2,
        ),
      );

      try {
        const result = await execFileAsync(process.execPath, [tscPath, '--project', join(tempDir, 'tsconfig.json')], {
          cwd: packageRoot,
          timeout: 20_000,
        });
        expect(result.stderr).toBe('');
      } catch (error) {
        const err = error as { stdout?: string | Buffer; stderr?: string | Buffer };
        throw new Error([err.stdout, err.stderr].filter(Boolean).map(String).join('\n'));
      }
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
