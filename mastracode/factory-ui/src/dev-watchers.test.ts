import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

describe('Factory dependency watchers', () => {
  describe('when running the existing dev:ui command', () => {
    it('starts shared UI watchers after their initial builds', () => {
      const { scripts } = JSON.parse(readFileSync(resolve(repoRoot, 'mastracode/web/package.json'), 'utf8'));
      const turboCommand = scripts['dev:ui']
        .split('&&')
        .map((command: string) => command.trim())
        .find((command: string) => command.startsWith('pnpm turbo '));
      if (!turboCommand) throw new Error('dev:ui does not start Turbo');
      const output = execFileSync(
        resolve(repoRoot, 'node_modules/.bin/turbo'),
        [...turboCommand.slice('pnpm turbo '.length).split(/\s+/), '--dry=json'],
        { cwd: repoRoot, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 },
      );
      const tasks: Record<string, unknown>[] = JSON.parse(output).tasks;
      for (const name of ['@mastra/playground-ui', '@mastra/react']) {
        expect(tasks.find(task => task.taskId === `${name}#dev`)).toMatchObject({
          dependencies: expect.arrayContaining([`${name}#build`]),
        });
      }
    });
  });
});
