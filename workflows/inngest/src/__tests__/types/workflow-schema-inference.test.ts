import { fileURLToPath } from 'node:url';
import { execa } from 'execa';
import { expect, it } from 'vitest';

it('typechecks workflow schema inference through the public package entry', async () => {
  // Vitest normally only transpiles .test.ts files. Run the compiler explicitly
  // so the changed-test gate also exercises this regression against the base build.
  const result = await execa(
    'tsc',
    ['--project', fileURLToPath(new URL('./tsconfig.json', import.meta.url)), '--pretty', 'false'],
    {
      cwd: fileURLToPath(new URL('../../../', import.meta.url)),
      preferLocal: true,
      reject: false,
    },
  );

  expect(result.exitCode, result.stdout + result.stderr).toBe(0);
});
