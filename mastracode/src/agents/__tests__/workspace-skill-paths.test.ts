import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('workspace skill path definitions', () => {
  const cwd = process.cwd();
  const home = os.homedir();

  const expectedPaths = [
    path.join(cwd, '.mastracode', 'skills'),
    path.join(cwd, '.claude', 'skills'),
    path.join(cwd, '.agents', 'skills'),
    path.join(home, '.mastracode', 'skills'),
    path.join(home, '.claude', 'skills'),
    path.join(home, '.agents', 'skills'),
  ];

  it('includes project-local and global skill directories as candidates', async () => {
    const fs = await import('node:fs');
    const source = fs.readFileSync(path.join(cwd, 'src/agents/workspace.ts'), 'utf-8');

    for (const dir of ['.mastracode', '.claude', '.agents']) {
      expect(source).toContain(`process.cwd(), '${dir}', 'skills'`);
      expect(source).toContain(`os.homedir(), '${dir}', 'skills'`);
    }
  });

  it('expected paths are well-formed absolute paths', () => {
    for (const p of expectedPaths) {
      expect(path.isAbsolute(p)).toBe(true);
      expect(p).toMatch(/skills$/);
    }
  });
});
