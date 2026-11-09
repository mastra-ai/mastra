import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'vitest';

type Record = {
  level: string;
  message: string;
  data?: { category?: string; attempts?: number; maxRetries?: number; backoff?: number };
};

describe('native write retry diagnostics', () => {
  for (const [scenario, attempts, expectedCategories] of [
    ['non-lock', 1, ['write-failure', 'write-non-lock-failure']],
    ['lock-exhaustion', 3, ['write-failure', 'write-lock-retry', 'write-lock-exhausted']],
    ['lock-recovery', 2, ['write-failure', 'write-lock-retry']],
    ['success', 1, []],
  ] as const) {
    it(`keeps ${scenario} console and adapted exports private while preserving actual SQLite writes`, async () => {
      const child = fork(fileURLToPath(new URL('./retry-diagnostics.fixture.ts', import.meta.url)), [scenario], {
        execArgv: ['--import', import.meta.resolve('tsx')],
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      });
      let output = '';
      child.stdout!.on('data', chunk => {
        output += chunk;
      });
      child.stderr!.on('data', chunk => {
        output += chunk;
      });
      let result: { attempts: number; exported: Record[] } | undefined;
      child.on('message', message => {
        result = message as typeof result;
      });
      const timeout = setTimeout(() => child.kill('SIGKILL'), 15000);
      try {
        const [code] = await once(child, 'exit');
        assert.equal(code, 0, output);
        assert.ok(result, 'The real SQLite scenario must finish and report its native export boundary.');
        assert.equal(result.attempts, attempts);
        assert.doesNotMatch(
          output + JSON.stringify(result.exported),
          /private-|private_|credential=|example-database-secret|SQLITE_|LibsqlError|errorMessage|errorType|errorCode|operationDescription|stack|file:/,
        );
        assert.deepEqual([...new Set(result.exported.map(record => record.data?.category))], expectedCategories);
        for (const record of result.exported) {
          assert.ok(output.includes(record.message));
          assert.deepEqual(
            Object.keys(record.data ?? {})
              .filter(key => key !== 'category')
              .sort(),
            record.data?.backoff === undefined ? ['attempts', 'maxRetries'] : ['attempts', 'backoff', 'maxRetries'],
          );
          for (const [key, value] of Object.entries(record.data ?? {}))
            if (key !== 'category') assert.ok(typeof value === 'number' && Number.isSafeInteger(value) && value >= 0);
        }
        if (scenario !== 'success') assert.match(output, /11111111111111111111111111111111/);
        if (scenario === 'lock-exhaustion')
          assert.equal(result.exported.filter(record => record.level === 'warn').length, 2);
      } finally {
        clearTimeout(timeout);
        if (child.exitCode === null) child.kill('SIGKILL');
      }
    }, 20000);
  }
});
