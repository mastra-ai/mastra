import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const clack = vi.hoisted(() => ({
  intro: vi.fn(),
  outro: vi.fn(),
  note: vi.fn(),
  cancel: vi.fn(),
  text: vi.fn(),
  password: vi.fn(),
  select: vi.fn(),
  isCancel: (value: unknown) => value === Symbol.for('clack.cancel'),
  log: { info: vi.fn(), success: vi.fn(), warn: vi.fn(), message: vi.fn(), error: vi.fn() },
  spinner: () => ({ start: vi.fn(), stop: vi.fn() }),
}));

const exec = vi.hoisted(() => ({
  runInherit: vi.fn(),
  execFileAsync: vi.fn(),
}));

vi.mock('@clack/prompts', () => clack);
vi.mock('./utils/exec.js', () => exec);

import type { Analytics } from './analytics.js';
import { create } from './create.js';

const analytics = { trackEvent: () => {}, shutdown: async () => {} } as unknown as Analytics;

const ENV_EXAMPLE = `# Mastra Software Factory environment.

# MASTRACODE_PUBLIC_URL=

# APP_DATABASE_URL=

# ANTHROPIC_API_KEY=
# OPENAI_API_KEY=

# WORKOS_API_KEY=
# WORKOS_CLIENT_ID=

# GITHUB_APP_ID=
`;

let workDir: string;
let templateDir: string;
const originalCwd = process.cwd();

beforeEach(() => {
  vi.clearAllMocks();
  exec.runInherit.mockResolvedValue(undefined);
  exec.execFileAsync.mockResolvedValue({ stdout: '', stderr: '' });

  // realpath: macOS tmpdir is a symlink and cwd-relative paths resolve it.
  workDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sf-create-test-')));
  templateDir = path.join(workDir, 'template-fixture');
  fs.mkdirSync(templateDir);
  fs.writeFileSync(
    path.join(templateDir, 'package.json'),
    `${JSON.stringify({ name: 'mastra-software-factory', version: '0.1.0', private: true }, null, 2)}\n`,
  );
  fs.writeFileSync(path.join(templateDir, '.env.example'), ENV_EXAMPLE);
  process.chdir(workDir);
});

afterEach(() => {
  process.chdir(originalCwd);
  fs.rmSync(workDir, { recursive: true, force: true });
});

describe('create --default', () => {
  it('scaffolds a project with a correct .env and finishes with the success outro', async () => {
    await create({ projectName: 'my-factory', useDefaults: true, templateDir, analytics });

    const projectPath = path.join(workDir, 'my-factory');
    const env = fs.readFileSync(path.join(projectPath, '.env'), 'utf8');

    // .env is a verbatim copy of .env.example — the CLI writes no values;
    // configuration happens in the web UI. Everything stays a commented
    // placeholder (an active `KEY=` would load as the empty string and poison
    // `process.env.X ?? default` fallbacks).
    expect(env).toBe(ENV_EXAMPLE);
    expect(env).not.toMatch(/^[A-Z][A-Z0-9_]*=/m);

    // Project renamed and installed.
    const pkg = JSON.parse(fs.readFileSync(path.join(projectPath, 'package.json'), 'utf8'));
    expect(pkg.name).toBe('my-factory');
    expect(exec.runInherit).toHaveBeenCalledWith(
      expect.any(String),
      ['install'],
      expect.objectContaining({
        cwd: projectPath,
      }),
    );

    // Git repo always initialized.
    expect(exec.runInherit).toHaveBeenCalledWith('git', ['init', '-q'], expect.objectContaining({ cwd: projectPath }));

    // Success outro shown.
    expect(clack.note).toHaveBeenCalledWith(expect.stringContaining('Your Software Factory is ready!'), 'Next steps');
    expect(clack.outro).toHaveBeenCalled();
  });

  it('fails the run when the template clone fails, without a success outro', async () => {
    exec.execFileAsync.mockRejectedValue(new Error('remote unreachable'));

    await expect(create({ projectName: 'my-factory', useDefaults: true, analytics })).rejects.toThrow(
      /Failed to clone template/,
    );

    expect(exec.runInherit).not.toHaveBeenCalled();
    expect(clack.note).not.toHaveBeenCalled();
    expect(clack.outro).not.toHaveBeenCalled();
  });

  it('fails the run when dependency install fails, without a success outro', async () => {
    exec.runInherit.mockImplementation(async (_cmd: string, args: string[]) => {
      if (args[0] === 'install') throw new Error('npm install exited with code 1');
    });

    await expect(create({ projectName: 'my-factory', useDefaults: true, templateDir, analytics })).rejects.toThrow(
      /retry manually/,
    );

    expect(clack.note).not.toHaveBeenCalled();
    expect(clack.outro).not.toHaveBeenCalled();
  });
});
