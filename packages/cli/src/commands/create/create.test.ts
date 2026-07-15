import { spawn } from 'node:child_process';
import type * as FsPromises from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const CANCEL = Symbol('cancel');
const fsMocks = vi.hoisted(() => ({
  existsSync: vi.fn(() => false),
  rm: vi.fn(),
}));

vi.mock('node:fs', () => ({
  default: { existsSync: fsMocks.existsSync },
}));

vi.mock('node:fs/promises', () => ({
  default: { rm: fsMocks.rm },
}));

vi.mock('@clack/prompts', () => ({
  text: vi.fn(),
  password: vi.fn(),
  select: vi.fn(),
  isCancel: vi.fn((value: unknown) => value === CANCEL),
  cancel: vi.fn(),
  outro: vi.fn(),
  note: vi.fn(),
  log: {
    error: vi.fn(),
    info: vi.fn(),
  },
  spinner: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
  })),
}));

vi.mock('picocolors', () => ({
  default: {
    green: (value: string) => value,
    cyan: (value: string) => value,
  },
}));

vi.mock('../../analytics/index', () => ({
  getAnalytics: vi.fn(() => null),
}));

vi.mock('../init/init', () => ({
  init: vi.fn(),
}));

vi.mock('../utils.js', () => ({
  getPackageManager: vi.fn(() => 'npm'),
}));

vi.mock('./utils', () => ({
  createMastraProject: vi.fn(),
}));

vi.mock('../../utils/template-utils', () => ({
  loadTemplates: vi.fn(),
  selectTemplate: vi.fn(),
  findTemplateByName: vi.fn(),
}));

vi.mock('../../utils/clone-template', () => ({
  cloneTemplate: vi.fn(),
  installDependencies: vi.fn(),
}));

const mockTemplate = {
  githubUrl: 'https://github.com/mastra-ai/template-agent-harness',
  title: 'Agent Harness',
  slug: 'template-agent-harness',
  agents: ['agent'],
  mcp: [],
  tools: ['web-fetch'],
  networks: [],
  workflows: [],
};

beforeEach(async () => {
  vi.clearAllMocks();
  fsMocks.existsSync.mockReturnValue(false);
  global.fetch = vi.fn();

  const prompts = await import('@clack/prompts');
  vi.mocked(prompts.text).mockResolvedValue('my-project');
  vi.mocked(prompts.select).mockResolvedValue('skip');
  vi.mocked(prompts.password).mockResolvedValue('secret');

  const templateUtils = await import('../../utils/template-utils');
  vi.mocked(templateUtils.loadTemplates).mockResolvedValue([mockTemplate]);
  vi.mocked(templateUtils.findTemplateByName).mockReturnValue(mockTemplate);
  vi.mocked(templateUtils.selectTemplate).mockResolvedValue(mockTemplate);

  const clone = await import('../../utils/clone-template');
  vi.mocked(clone.cloneTemplate).mockResolvedValue('/tmp/my-project');
  vi.mocked(clone.installDependencies).mockResolvedValue();

  const createUtils = await import('./utils');
  vi.mocked(createUtils.createMastraProject).mockResolvedValue({ projectName: 'my-project', result: undefined });

  const { init } = await import('../init/init');
  vi.mocked(init).mockResolvedValue({ success: true });
});

describe('create preflight and mode orchestration', () => {
  it('uses managed agent-harness mode by default and --yes supplies OpenAI without prompts', async () => {
    const { create } = await import('./create');
    const { cloneTemplate } = await import('../../utils/clone-template');
    const prompts = await import('@clack/prompts');
    const resolveVersionTag = vi.fn().mockResolvedValue('latest');

    await create({ projectName: 'my-project', yes: true, resolveVersionTag });

    expect(resolveVersionTag).toHaveBeenCalledOnce();
    expect(prompts.text).not.toHaveBeenCalled();
    expect(prompts.select).not.toHaveBeenCalled();
    expect(prompts.password).not.toHaveBeenCalled();
    expect(cloneTemplate).toHaveBeenCalledWith({
      template: mockTemplate,
      projectName: 'my-project',
      branch: undefined,
      llmProvider: 'openai',
    });
  });

  it('prompts for name, provider, then optional API key in managed mode', async () => {
    const { create } = await import('./create');
    const prompts = await import('@clack/prompts');
    const { cloneTemplate } = await import('../../utils/clone-template');
    const resolveVersionTag = vi.fn().mockResolvedValue('latest');

    vi.mocked(prompts.text).mockResolvedValue('prompted-project');
    vi.mocked(prompts.select).mockResolvedValueOnce('anthropic').mockResolvedValueOnce('skip');

    await create({ resolveVersionTag });

    expect(prompts.text).toHaveBeenCalledOnce();
    expect(prompts.select).toHaveBeenCalledTimes(2);
    expect(prompts.text).toHaveBeenCalledBefore(vi.mocked(prompts.select));
    expect(resolveVersionTag).toHaveBeenCalledAfter(vi.mocked(prompts.select));
    expect(prompts.password).not.toHaveBeenCalled();
    expect(cloneTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        projectName: 'prompted-project',
        llmProvider: 'anthropic',
      }),
    );
  });

  it('retains an explicit API key while prompting only for the missing provider', async () => {
    const { create } = await import('./create');
    const prompts = await import('@clack/prompts');
    const { cloneTemplate } = await import('../../utils/clone-template');

    vi.mocked(prompts.select).mockResolvedValueOnce('google');

    await create({
      projectName: 'my-project',
      llmApiKey: 'provided-key',
      resolveVersionTag: vi.fn().mockResolvedValue('latest'),
    });

    expect(prompts.select).toHaveBeenCalledOnce();
    expect(prompts.password).not.toHaveBeenCalled();
    expect(cloneTemplate).toHaveBeenCalledWith(expect.objectContaining({ llmProvider: 'google' }));
  });

  it('arbitrary template mode never prompts for or applies a provider and skips tag resolution', async () => {
    const { create } = await import('./create');
    const prompts = await import('@clack/prompts');
    const { cloneTemplate } = await import('../../utils/clone-template');
    const resolveVersionTag = vi.fn();

    await create({
      projectName: 'my-project',
      template: 'agent-harness',
      resolveVersionTag,
    });

    expect(prompts.select).not.toHaveBeenCalled();
    expect(prompts.password).not.toHaveBeenCalled();
    expect(resolveVersionTag).not.toHaveBeenCalled();
    expect(cloneTemplate).toHaveBeenCalledWith(expect.objectContaining({ llmProvider: undefined }));
  });

  it('bare template mode prompts for the project name before loading and selecting templates', async () => {
    const { create } = await import('./create');
    const prompts = await import('@clack/prompts');
    const { loadTemplates, selectTemplate } = await import('../../utils/template-utils');

    await create({ template: true });

    expect(prompts.text).toHaveBeenCalledOnce();
    expect(prompts.text).toHaveBeenCalledBefore(vi.mocked(loadTemplates));
    expect(selectTemplate).toHaveBeenCalledWith([mockTemplate], { signal: expect.any(AbortSignal) });
    expect(prompts.select).not.toHaveBeenCalled();
  });

  it('empty mode prompts only for a missing name and resolves the release tag lazily', async () => {
    const { create } = await import('./create');
    const prompts = await import('@clack/prompts');
    const { createMastraProject } = await import('./utils');
    const resolveVersionTag = vi.fn().mockResolvedValue('snapshot');

    await create({ empty: true, resolveVersionTag });

    expect(prompts.text).toHaveBeenCalledOnce();
    expect(prompts.select).not.toHaveBeenCalled();
    expect(prompts.password).not.toHaveBeenCalled();
    expect(resolveVersionTag).toHaveBeenCalledOnce();
    expect(createMastraProject).toHaveBeenCalledWith({
      projectName: 'my-project',
      createVersionTag: 'snapshot',
      timeout: 60_000,
      needsInteractive: false,
    });
  });

  it.each([
    [{ empty: true, template: 'agent-harness' }, '--empty and --template'],
    [{ empty: true, llmProvider: 'openai' as const }, '--llm option'],
    [{ empty: true, llmApiKey: 'secret' }, '--llm-api-key option'],
    [{ template: 'agent-harness', llmProvider: 'openai' as const }, '--llm option'],
    [{ template: 'agent-harness', llmApiKey: 'secret' }, '--llm-api-key option'],
    [{ template: true, yes: true }, '--yes option requires a template value'],
  ])('rejects conflicting options before prompts or side effects: %o', async (conflict, message) => {
    const { create } = await import('./create');
    const prompts = await import('@clack/prompts');
    const { loadTemplates } = await import('../../utils/template-utils');
    const { createMastraProject } = await import('./utils');
    const resolveVersionTag = vi.fn();

    await expect(create({ projectName: 'my-project', ...conflict, resolveVersionTag })).rejects.toThrow(message);

    expect(prompts.text).not.toHaveBeenCalled();
    expect(prompts.select).not.toHaveBeenCalled();
    expect(loadTemplates).not.toHaveBeenCalled();
    expect(createMastraProject).not.toHaveBeenCalled();
    expect(resolveVersionTag).not.toHaveBeenCalled();
  });

  it('requires a positional project name with --yes before prompts or tag resolution', async () => {
    const { create } = await import('./create');
    const prompts = await import('@clack/prompts');
    const resolveVersionTag = vi.fn();

    await expect(create({ yes: true, resolveVersionTag })).rejects.toThrow(
      'The --yes option requires a positional project name',
    );
    expect(prompts.text).not.toHaveBeenCalled();
    expect(resolveVersionTag).not.toHaveBeenCalled();
  });

  it.each([
    '',
    '   ',
    '.',
    '..',
    '../project',
    'project/name',
    'project\\name',
    '/absolute',
    '@scope/project',
    'Uppercase',
    'has space',
    'trailing.',
    'con',
    'CON.txt',
    'prn',
    'aux',
    'nul',
    'com1',
    'com9.log',
    'lpt1',
    'lpt9.txt',
  ])('rejects unsafe project name %j before release-tag lookup', async projectName => {
    const { create } = await import('./create');
    const resolveVersionTag = vi.fn();

    await expect(create({ projectName, empty: true, resolveVersionTag })).rejects.toThrow('Project name must be');
    expect(resolveVersionTag).not.toHaveBeenCalled();
  });

  it('trims a valid project name once and uses it for the target and scaffold', async () => {
    const { create } = await import('./create');
    const { createMastraProject } = await import('./utils');

    await create({
      projectName: '  valid-project  ',
      empty: true,
      resolveVersionTag: vi.fn().mockResolvedValue('latest'),
    });

    expect(createMastraProject).toHaveBeenCalledWith(expect.objectContaining({ projectName: 'valid-project' }));
  });

  it('accepts the maximum 214-character safe project name', async () => {
    const { create } = await import('./create');
    const { createMastraProject } = await import('./utils');
    const projectName = `a${'b'.repeat(213)}`;

    await create({ projectName, empty: true, resolveVersionTag: vi.fn().mockResolvedValue('latest') });

    expect(createMastraProject).toHaveBeenCalledWith(expect.objectContaining({ projectName }));
  });

  it('rejects an existing target before provider prompts, network access, or tag lookup', async () => {
    const { create } = await import('./create');
    const prompts = await import('@clack/prompts');
    const { loadTemplates } = await import('../../utils/template-utils');
    const resolveVersionTag = vi.fn();
    fsMocks.existsSync.mockReturnValue(true);

    await expect(create({ projectName: 'existing', resolveVersionTag })).rejects.toThrow(
      'A file or directory named "existing" already exists',
    );

    expect(prompts.select).not.toHaveBeenCalled();
    expect(loadTemplates).not.toHaveBeenCalled();
    expect(resolveVersionTag).not.toHaveBeenCalled();
  });

  it('uses the beta branch for a managed Mastra template only when the resolved channel is beta', async () => {
    const { create } = await import('./create');
    const { cloneTemplate } = await import('../../utils/clone-template');

    await create({ projectName: 'my-project', yes: true, resolveVersionTag: vi.fn().mockResolvedValue('beta') });

    expect(cloneTemplate).toHaveBeenCalledWith(expect.objectContaining({ branch: 'beta' }));
  });
});

describe('create cancellation', () => {
  it.each([
    {
      name: 'project name',
      setup: async () => {
        const prompts = await import('@clack/prompts');
        vi.mocked(prompts.text).mockResolvedValue(CANCEL as never);
        return {};
      },
    },
    {
      name: 'provider',
      setup: async () => {
        const prompts = await import('@clack/prompts');
        vi.mocked(prompts.select).mockResolvedValueOnce(CANCEL as never);
        return { projectName: 'my-project' };
      },
    },
    {
      name: 'API key choice',
      setup: async () => {
        const prompts = await import('@clack/prompts');
        vi.mocked(prompts.select)
          .mockResolvedValueOnce('openai')
          .mockResolvedValueOnce(CANCEL as never);
        return { projectName: 'my-project' };
      },
    },
    {
      name: 'API key value',
      setup: async () => {
        const prompts = await import('@clack/prompts');
        vi.mocked(prompts.select).mockResolvedValueOnce('openai').mockResolvedValueOnce('enter');
        vi.mocked(prompts.password).mockResolvedValue(CANCEL as never);
        return { projectName: 'my-project' };
      },
    },
    {
      name: 'template selection',
      setup: async () => {
        const { selectTemplate } = await import('../../utils/template-utils');
        vi.mocked(selectTemplate).mockResolvedValue(null);
        return { projectName: 'my-project', template: true as const };
      },
    },
  ])('cancels the complete create flow from the $name prompt', async ({ setup }) => {
    const { create, CreateCancelledError } = await import('./create');
    const prompts = await import('@clack/prompts');
    const { cloneTemplate } = await import('../../utils/clone-template');
    const { createMastraProject } = await import('./utils');
    const options = await setup();

    await expect(create(options)).rejects.toBeInstanceOf(CreateCancelledError);

    expect(prompts.cancel).toHaveBeenCalledWith('Operation cancelled');
    expect(cloneTemplate).not.toHaveBeenCalled();
    expect(createMastraProject).not.toHaveBeenCalled();
  });

  it('exits the full CLI process with status 0 on Ctrl+C and leaves no target behind', async () => {
    const actualFs = await vi.importActual<typeof FsPromises>('node:fs/promises');
    const cwd = await actualFs.mkdtemp(path.join(os.tmpdir(), 'mastra-create-cancel-'));
    const cliEntry = fileURLToPath(new URL('../../index.ts', import.meta.url));
    const tsxLoader = import.meta.resolve('tsx');

    try {
      const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null; output: string }>(
        (resolve, reject) => {
          const child = spawn(process.execPath, ['--import', tsxLoader, cliEntry, 'create'], {
            cwd,
            env: {
              ...process.env,
              FORCE_COLOR: '0',
              MASTRA_TELEMETRY_DISABLED: '1',
            },
            stdio: ['pipe', 'pipe', 'pipe'],
          });
          let output = '';
          let interrupted = false;
          const timer = setTimeout(() => {
            child.kill('SIGKILL');
            reject(new Error(`Timed out waiting for create prompt. Output: ${output}`));
          }, 15_000);

          const onData = (chunk: Buffer) => {
            output += chunk.toString();
            if (!interrupted && output.includes('What do you want to name your project?')) {
              interrupted = true;
              child.kill('SIGINT');
            }
          };
          child.stdout.on('data', onData);
          child.stderr.on('data', onData);
          child.on('error', error => {
            clearTimeout(timer);
            reject(error);
          });
          child.on('close', (code, signal) => {
            clearTimeout(timer);
            resolve({ code, signal, output });
          });
        },
      );

      expect(result.code).toBe(0);
      expect(result.signal).toBeNull();
      expect(result.output).toContain('Operation cancelled');
      expect(await actualFs.readdir(cwd)).toEqual([]);
    } finally {
      await actualFs.rm(cwd, { recursive: true, force: true });
    }
  }, 20_000);
});

describe('GitHub template validation', () => {
  it('validates a public GitHub Mastra project after target preflight', async () => {
    const { create } = await import('./create');
    const { cloneTemplate } = await import('../../utils/clone-template');
    const prompts = await import('@clack/prompts');

    vi.mocked(global.fetch).mockImplementation(async input => {
      const url = String(input);
      if (url.endsWith('/package.json')) {
        return {
          ok: true,
          text: async () => JSON.stringify({ dependencies: { '@mastra/core': 'latest' } }),
        } as Response;
      }
      if (url.endsWith('/src/mastra/index.ts')) {
        return { ok: true, text: async () => 'export const mastra = new Mastra({});' } as Response;
      }
      return { ok: false } as Response;
    });

    await create({
      projectName: 'github-project',
      template: 'https://github.com/example/mastra-template',
    });

    expect(prompts.spinner).toHaveBeenCalled();
    expect(cloneTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        template: expect.objectContaining({
          githubUrl: 'https://github.com/example/mastra-template',
          title: 'example/mastra-template',
        }),
        llmProvider: undefined,
      }),
    );
  });

  it('rejects GitHub repositories without a valid Mastra project', async () => {
    const { create } = await import('./create');
    vi.mocked(global.fetch).mockResolvedValue({ ok: false } as Response);

    await expect(
      create({ projectName: 'github-project', template: 'https://github.com/example/invalid' }),
    ).rejects.toThrow('Invalid Mastra project');
  });
});
