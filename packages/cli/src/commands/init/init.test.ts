import { fs, vol } from 'memfs';
import { describe, beforeEach, expect, vi, test } from 'vitest';
import { DepsService } from '../../services/service.deps';

beforeEach(() => {
  vol.reset();
  vi.resetAllMocks();
});

vi.mock('./utils', () => ({
  checkInitialization: vi.fn(),
  writeIndexFile: vi.fn(),
  createComponentsDir: vi.fn(),
  writeAPIKey: vi.fn(),
  getAPIKey: vi.fn(),
  createMastraDir: vi.fn(),
  writeCodeSample: vi.fn(),
  checkDependencies: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    success: vi.fn(),
    break: vi.fn(),
  },
}));

const utils = await import('./utils');
const { init } = await import('./init');

vi.mock('../../services/service.deps', () => {
  return {
    DepsService: vi.fn().mockImplementation(() => {
      return {
        checkDependencies: vi.fn(() => Promise.resolve('ok')),
      };
    }),
  };
});

describe('CLI', () => {
  test('creates the mastra directory and components directories', async () => {
    const mockCreateMastraDir = vi.spyOn(utils, 'createMastraDir').mockImplementation(async (directory) => {
      const dirPath = `${directory}/mastra`;
      fs.mkdirSync(dirPath, { recursive: true }); // Simulate directory creation
      return { ok: true, dirPath };
    });

    const mockCreateComponentsDir = vi.spyOn(utils, 'createComponentsDir').mockImplementation(async (dirPath, component) => {
      const componentPath = `${dirPath}/${component}`;
      fs.mkdirSync(componentPath, { recursive: true }); // Simulate component directory creation
    });

    await init({
      directory: '/mock',
      components: ['agents', 'tools'],
      addExample: false,
      llmProvider: 'openai',
      llmApiKey: 'sk-...',
    });

    expect(mockCreateMastraDir).toHaveBeenCalledWith('/mock');
    expect(mockCreateComponentsDir).toHaveBeenCalledWith('/mock/mastra', 'agents');
    expect(mockCreateComponentsDir).toHaveBeenCalledWith('/mock/mastra', 'tools');

    expect(fs.existsSync('/mock/mastra')).toBe(true);
    expect(fs.existsSync('/mock/mastra/agents')).toBe(true);
    expect(fs.existsSync('/mock/mastra/tools')).toBe(true);
  });

  test('generates correct index file content', async () => {
    vi.spyOn(utils, 'createMastraDir').mockImplementation(async (directory) => {
      const dirPath = `${directory}/mastra`;
      fs.mkdirSync(dirPath, { recursive: true });
      return { ok: true, dirPath };
    });

    vi.spyOn(utils, 'writeIndexFile').mockImplementation(async ({ dirPath, addExample }) => {
      const content = addExample
        ? `
        import { Mastra } from '@mastra/core';
        export const mastra = new Mastra({});
      `
        : ``;
      fs.writeFileSync(`${dirPath}/index.ts`, content); // Simulate file creation
    });

    await init({
      directory: '/mock',
      components: ['agents'],
      addExample: true,
      llmProvider: 'openai',
      llmApiKey: 'sk-...',
    });

    const writtenFile = fs.readFileSync('/mock/mastra/index.ts', 'utf-8');
    expect(writtenFile).toContain('Mastra');
    expect(writtenFile).toContain('export const mastra = new Mastra({');
  });

  test('generates env file', async () => {
    DepsService.prototype.checkDependencies = vi.fn(() => Promise.resolve('ok'));

    vi.spyOn(utils, 'createMastraDir').mockImplementation(async (directory) => {
      const dirPath = `${directory}/mastra`;
      fs.mkdirSync(dirPath, { recursive: true });
      return { ok: true, dirPath };
    });

    vi.spyOn(utils, 'writeAPIKey').mockImplementation(async ({ provider: llmProvider, apiKey }) => {
      const key = `${llmProvider.toUpperCase()}_API_KEY=${apiKey}`;
      fs.writeFileSync('/mock/.env.development', key);
    });

    await init({
      directory: '/mock',
      components: ['agents'],
      addExample: false,
      llmProvider: 'openai',
      llmApiKey: 'sk-...',
    });

    const envFileContent = fs.readFileSync('/mock/.env.development', 'utf-8');
    expect(envFileContent).toContain('OPENAI_API_KEY');
  });

  // test('stops initialization if dependencies are not satisfied', async () => {
  //   DepsService.prototype.checkDependencies = jest.fn(() => Promise.resolve('No package.json file found in the current directory'));

  //   jest.spyOn(utils, 'createMastraDir').mockImplementation(async () => {
  //     return { ok: false }; // Simulate failure to create directory
  //   });

  //   await init({
  //     directory: '/mock',
  //     components: [],
  //     addExample: false,
  //     llmProvider: 'openai',
  //     showSpinner: false,
  //   });

  //   expect(logger.error).toHaveBeenCalledWith('No package.json file found in the current directory');
  //   expect(utils.createMastraDir).not.toHaveBeenCalled();
  //   expect(utils.writeIndexFile).not.toHaveBeenCalled();

  //   expect(fs.existsSync('/mock')).toBe(false);
  // });

  // test('stops initialization if mastra core is not installed', async () => {
  //   DepsService.prototype.checkDependencies = jest.fn(() => Promise.resolve('Install @mastra/core before running this command (npm install @mastra/core)'));

  //   jest.spyOn(utils, 'createMastraDir').mockImplementation(async () => {
  //     return { ok: false }; // Simulate failure to create directory
  //   });

  //   await init({
  //     directory: '/mock',
  //     components: ['tools'],
  //     addExample: false,
  //     llmProvider: 'anthropic',
  //     showSpinner: false,
  //   });

  //   expect(logger.error).toHaveBeenCalledWith('Install @mastra/core before running this command (npm install @mastra/core)');
  //   expect(utils.createMastraDir).not.toHaveBeenCalled();
  //   expect(utils.writeIndexFile).not.toHaveBeenCalled();

  //   expect(fs.existsSync('/mock')).toBe(false);
  // });

  test('stops initialization if mastra is already setup', async () => {
    DepsService.prototype.checkDependencies = vi.fn(() => Promise.resolve('ok'));

    fs.mkdirSync('/mock/mastra', { recursive: true })

    vi.spyOn(utils, 'createMastraDir').mockImplementation(async (directory) => {
      const dirPath = `${directory}/mastra`;
      fs.mkdirSync(dirPath, { recursive: true });
      return { ok: false };
    });

    const mockWriteIndexFile = vi.spyOn(utils, 'writeIndexFile');
    const mockWriteAPIKey = vi.spyOn(utils, 'writeAPIKey');

    await init({
      directory: '/mock',
      components: ['tools'],
      addExample: false,
      llmProvider: 'anthropic',
      llmApiKey: 'sk-...',
    });

    expect(mockWriteIndexFile).not.toHaveBeenCalled();
    expect(mockWriteAPIKey).not.toHaveBeenCalled();

    expect(fs.existsSync('/mock/mastra')).toBe(true);
  });
});

