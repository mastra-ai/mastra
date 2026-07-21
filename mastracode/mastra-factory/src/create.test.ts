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

const tinyexec = vi.hoisted(() => ({
  x: vi.fn(),
}));

vi.mock('@clack/prompts', () => clack);
vi.mock('tinyexec', () => tinyexec);

import type { Analytics } from './analytics.js';
import { create } from './create.js';

const analytics = { trackEvent: () => {}, shutdown: async () => {} } as unknown as Analytics;
const TEMPLATE_REPO = 'https://github.com/mastra-ai/softwarefactory-template';

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

  tinyexec.x.mockImplementation(async (command: string, args: string[]) => {
    if (command === 'npx' && args[0] === 'degit') {
      fs.cpSync(templateDir, args[2]!, { recursive: true });
    }
  });
});

afterEach(() => {
  process.chdir(originalCwd);
  fs.rmSync(workDir, { recursive: true, force: true });
});

describe('create', () => {
  it('scaffolds a project with a correct .env and shows the next steps', async () => {
    await create({ projectName: 'my-factory', template: TEMPLATE_REPO, analytics });

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
    expect(tinyexec.x).toHaveBeenCalledWith(
      expect.any(String),
      ['install'],
      expect.objectContaining({
        nodeOptions: { cwd: projectPath },
      }),
    );

    // Git repo initialized.
    expect(tinyexec.x).toHaveBeenCalledWith('git', ['init', '-q'], { nodeOptions: { cwd: projectPath } });

    expect(clack.note).toHaveBeenCalledWith(expect.stringContaining('Your Software Factory is ready!'), 'Next steps');
  });

  it('fails the run when the template clone fails, without showing next steps', async () => {
    tinyexec.x.mockRejectedValue(new Error('remote unreachable'));

    await expect(create({ projectName: 'my-factory', template: TEMPLATE_REPO, analytics })).rejects.toThrow(
      /Failed to clone repository/,
    );

    expect(tinyexec.x).not.toHaveBeenCalledWith(expect.any(String), ['install'], expect.anything());
    expect(clack.note).not.toHaveBeenCalled();
  });

  it('fails the run when dependency install fails, without showing next steps', async () => {
    tinyexec.x.mockImplementation(async (command: string, args: string[]) => {
      if (command === 'npx' && args[0] === 'degit') {
        fs.cpSync(templateDir, args[2]!, { recursive: true });
      }
      if (args[0] === 'install') {
        throw new Error('npm install exited with code 1');
      }
    });

    await expect(create({ projectName: 'my-factory', template: TEMPLATE_REPO, analytics })).rejects.toThrow(
      /retry manually/,
    );

    expect(clack.note).not.toHaveBeenCalled();
  });
});
