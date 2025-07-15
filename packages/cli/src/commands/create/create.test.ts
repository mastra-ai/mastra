import { vol } from 'memfs';
import type * as MemfsModule from 'memfs';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the logger
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

// Mock picocolors
vi.mock('picocolors', () => ({
  default: {
    green: (str: string) => str,
    cyan: (str: string) => str,
    dim: (str: string) => str,
  },
}));

// Mock @clack/prompts
vi.mock('@clack/prompts', () => ({
  text: vi.fn(),
  log: {
    error: vi.fn(),
    info: vi.fn(),
  },
  isCancel: vi.fn(),
  outro: vi.fn(),
  note: vi.fn(),
  select: vi.fn(),
}));

// Mock init command
vi.mock('../init/init', () => ({
  init: vi.fn(),
}));

// Mock init utils
vi.mock('../init/utils', () => ({
  interactivePrompt: vi.fn(),
}));

// Mock utils
vi.mock('../utils.js', () => ({
  getPackageManager: vi.fn(() => 'npm'),
}));

// Mock create utils
vi.mock('./utils', () => ({
  createMastraProject: vi.fn(),
}));

// Mock template utilities
vi.mock('../../utils/template-utils', () => ({
  loadTemplates: vi.fn(),
  selectTemplate: vi.fn(),
  findTemplateByName: vi.fn(),
  getDefaultProjectName: vi.fn(),
}));

// Mock clone template utilities
vi.mock('../../utils/clone-template', () => ({
  cloneTemplate: vi.fn(),
  installDependencies: vi.fn(),
}));

beforeEach(() => {
  vol.reset();
  vi.resetAllMocks();
  // Mock global fetch for API calls
  global.fetch = vi.fn();
});

// Mock fs after importing vol
vi.mock('fs/promises', async () => {
  const memfs = await vi.importActual<typeof MemfsModule>('memfs');
  return {
    default: memfs.fs.promises,
    ...memfs.fs.promises,
  };
});

describe('create command with --template flag', () => {
  const mockTemplate = {
    githubUrl: 'https://github.com/mastra-ai/template-test',
    title: 'Test Template',
    slug: 'template-test',
    agents: ['test-agent'],
    mcp: [],
    tools: ['test-tool'],
    networks: [],
    workflows: [],
  };

  describe('createFromTemplate', () => {
    it('should create project from specific template name', async () => {
      const { loadTemplates, findTemplateByName, getDefaultProjectName } = await import('../../utils/template-utils');
      const { cloneTemplate, installDependencies } = await import('../../utils/clone-template');
      const { text, isCancel } = await import('@clack/prompts');

      vi.mocked(loadTemplates).mockResolvedValue([mockTemplate]);
      vi.mocked(findTemplateByName).mockReturnValue(mockTemplate);
      vi.mocked(getDefaultProjectName).mockReturnValue('test-project');
      vi.mocked(text).mockResolvedValue('my-project');
      vi.mocked(isCancel).mockReturnValue(false);
      vi.mocked(cloneTemplate).mockResolvedValue('/my-project');
      vi.mocked(installDependencies).mockResolvedValue();

      const { create } = await import('./create');
      await create({
        template: 'test-template',
        projectName: 'my-project',
      });

      expect(findTemplateByName).toHaveBeenCalledWith([mockTemplate], 'test-template');
      expect(cloneTemplate).toHaveBeenCalledWith({
        template: mockTemplate,
        projectName: 'my-project',
      });
      expect(installDependencies).toHaveBeenCalledWith('/my-project');
    });

    it('should prompt for project name when not provided', async () => {
      const { loadTemplates, findTemplateByName, getDefaultProjectName } = await import('../../utils/template-utils');
      const { cloneTemplate, installDependencies } = await import('../../utils/clone-template');
      const { text, isCancel } = await import('@clack/prompts');

      vi.mocked(loadTemplates).mockResolvedValue([mockTemplate]);
      vi.mocked(findTemplateByName).mockReturnValue(mockTemplate);
      vi.mocked(getDefaultProjectName).mockReturnValue('test-project');
      vi.mocked(text).mockResolvedValue('user-chosen-name');
      vi.mocked(isCancel).mockReturnValue(false);
      vi.mocked(cloneTemplate).mockResolvedValue('/user-chosen-name');
      vi.mocked(installDependencies).mockResolvedValue();

      const { create } = await import('./create');
      await create({
        template: 'test-template',
      });

      expect(text).toHaveBeenCalledWith({
        message: 'What is your project name?',
        defaultValue: 'test-project',
        placeholder: 'test-project',
      });
      expect(cloneTemplate).toHaveBeenCalledWith({
        template: mockTemplate,
        projectName: 'user-chosen-name',
      });
    });

    it('should show template selection when template flag provided without value', async () => {
      const { loadTemplates, selectTemplate } = await import('../../utils/template-utils');
      const { cloneTemplate, installDependencies } = await import('../../utils/clone-template');
      const { text, isCancel } = await import('@clack/prompts');

      vi.mocked(loadTemplates).mockResolvedValue([mockTemplate]);
      vi.mocked(selectTemplate).mockResolvedValue(mockTemplate);
      vi.mocked(text).mockResolvedValue('my-project');
      vi.mocked(isCancel).mockReturnValue(false);
      vi.mocked(cloneTemplate).mockResolvedValue('/my-project');
      vi.mocked(installDependencies).mockResolvedValue();

      const { create } = await import('./create');
      await create({
        template: true, // true indicates --template flag was used without value
        projectName: 'my-project',
      });

      expect(selectTemplate).toHaveBeenCalledWith([mockTemplate]);
      expect(cloneTemplate).toHaveBeenCalledWith({
        template: mockTemplate,
        projectName: 'my-project',
      });
    });

    it('should throw error if template not found', async () => {
      const { loadTemplates, findTemplateByName } = await import('../../utils/template-utils');
      const { log } = await import('@clack/prompts');

      vi.mocked(loadTemplates).mockResolvedValue([mockTemplate]);
      vi.mocked(findTemplateByName).mockReturnValue(null);

      const { create } = await import('./create');

      await expect(
        create({
          template: 'non-existent-template',
        }),
      ).rejects.toThrow('Template "non-existent-template" not found');

      expect(log.error).toHaveBeenCalledWith('Template "non-existent-template" not found. Available templates:');
    });

    it('should exit if user cancels template selection', async () => {
      const { loadTemplates, selectTemplate } = await import('../../utils/template-utils');
      const { log } = await import('@clack/prompts');

      vi.mocked(loadTemplates).mockResolvedValue([mockTemplate]);
      vi.mocked(selectTemplate).mockResolvedValue(null);

      const { create } = await import('./create');
      await create({ template: true });

      expect(log.info).toHaveBeenCalledWith('No template selected. Exiting.');
    });

    it('should exit if user cancels project name input', async () => {
      const { loadTemplates, findTemplateByName, getDefaultProjectName } = await import('../../utils/template-utils');
      const { text, isCancel, log } = await import('@clack/prompts');

      vi.mocked(loadTemplates).mockResolvedValue([mockTemplate]);
      vi.mocked(findTemplateByName).mockReturnValue(mockTemplate);
      vi.mocked(getDefaultProjectName).mockReturnValue('test-project');
      vi.mocked(text).mockResolvedValue('cancelled');
      vi.mocked(isCancel).mockReturnValue(true);

      const { create } = await import('./create');
      await create({ template: 'test-template' });

      expect(log.info).toHaveBeenCalledWith('Project creation cancelled.');
    });

    it('should handle clone template errors', async () => {
      const { loadTemplates, findTemplateByName } = await import('../../utils/template-utils');
      const { cloneTemplate } = await import('../../utils/clone-template');
      const { log } = await import('@clack/prompts');

      vi.mocked(loadTemplates).mockResolvedValue([mockTemplate]);
      vi.mocked(findTemplateByName).mockReturnValue(mockTemplate);
      vi.mocked(cloneTemplate).mockRejectedValue(new Error('Clone failed'));

      const { create } = await import('./create');

      await expect(
        create({
          template: 'test-template',
          projectName: 'my-project',
        }),
      ).rejects.toThrow('Clone failed');

      expect(log.error).toHaveBeenCalledWith('Failed to create project from template: Clone failed');
    });

    it('should handle install dependencies errors', async () => {
      const { loadTemplates, findTemplateByName } = await import('../../utils/template-utils');
      const { cloneTemplate, installDependencies } = await import('../../utils/clone-template');
      const { log } = await import('@clack/prompts');

      vi.mocked(loadTemplates).mockResolvedValue([mockTemplate]);
      vi.mocked(findTemplateByName).mockReturnValue(mockTemplate);
      vi.mocked(cloneTemplate).mockResolvedValue('/my-project');
      vi.mocked(installDependencies).mockRejectedValue(new Error('Install failed'));

      const { create } = await import('./create');

      await expect(
        create({
          template: 'test-template',
          projectName: 'my-project',
        }),
      ).rejects.toThrow('Install failed');

      expect(log.error).toHaveBeenCalledWith('Failed to create project from template: Install failed');
    });

    it('should not use template creation when template is undefined', async () => {
      const { createMastraProject } = await import('./utils');
      const { init } = await import('../init/init');
      const { interactivePrompt } = await import('../init/utils');

      vi.mocked(createMastraProject).mockResolvedValue({ projectName: 'regular-project' });
      vi.mocked(interactivePrompt).mockResolvedValue({
        directory: '/some/path',
        llmProvider: 'openai',
        llmApiKey: 'test-key',
        configureEditorWithDocsMCP: 'cursor',
      });
      vi.mocked(init).mockResolvedValue({ success: true });

      const { create } = await import('./create');
      await create({
        // No template property
        projectName: 'regular-project',
      });

      expect(createMastraProject).toHaveBeenCalledWith({
        projectName: 'regular-project',
        createVersionTag: undefined,
        timeout: undefined,
      });
      expect(init).toHaveBeenCalled();
    });

    it('should show completion message after successful template creation', async () => {
      const { loadTemplates, findTemplateByName } = await import('../../utils/template-utils');
      const { cloneTemplate, installDependencies } = await import('../../utils/clone-template');
      const { outro } = await import('@clack/prompts');

      vi.mocked(loadTemplates).mockResolvedValue([mockTemplate]);
      vi.mocked(findTemplateByName).mockReturnValue(mockTemplate);
      vi.mocked(cloneTemplate).mockResolvedValue('/my-project');
      vi.mocked(installDependencies).mockResolvedValue();

      const { create } = await import('./create');
      await create({
        template: 'test-template',
        projectName: 'my-project',
      });

      expect(outro).toHaveBeenCalledWith(expect.stringContaining('To start your project:'));
      expect(outro).toHaveBeenCalledWith(expect.stringContaining('cd my-project'));
    });
  });
});
