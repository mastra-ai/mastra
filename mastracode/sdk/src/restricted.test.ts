import childProcess from 'node:child_process';
import fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const agentConfigs = vi.hoisted<unknown[]>(() => []);
const controllerConfigs = vi.hoisted<unknown[]>(() => []);

vi.mock('@mastra/core/coding-agent', () => ({
  createCodingAgent: vi.fn((config: unknown) => {
    agentConfigs.push(config);
    return { id: 'code-agent' };
  }),
}));

vi.mock('@mastra/core/agent-controller', () => ({
  AgentController: class {
    readonly id = 'mastra-code';

    constructor(config: unknown) {
      controllerConfigs.push(config);
    }

    async init() {}

    __registerMastra() {}
  },
}));

vi.mock('@mastra/core/mastra', () => ({
  Mastra: class {
    async startWorkers() {}
  },
}));

/** Builds a complete restricted configuration for unit-level wiring tests. */
function createConfig(overrides: Record<string, unknown> = {}) {
  return {
    project: {
      resourceId: 'remote-project-1',
      name: 'remote-project',
      rootPath: '/remote/workspace',
      gitBranch: 'main',
    },
    model: { specificationVersion: 'v2' },
    instructions: 'Use only host-provided capabilities.',
    modes: [{ id: 'build', metadata: { default: true } }],
    allowedTools: ['remote_read'],
    tools: {
      remote_read: { execute: vi.fn(async () => 'remote contents') },
      ambient_tool: { execute: vi.fn(async () => 'must not run') },
    },
    workspace: { id: 'remote-workspace' },
    storage: { id: 'remote-storage' },
    memory: false,
    ...overrides,
  } as any;
}

describe('restricted Mastra Code embedding', () => {
  beforeEach(() => {
    agentConfigs.length = 0;
    controllerConfigs.length = 0;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('exposes an allowlisted remote tool and removes every other supplied tool', async () => {
    const { createRestrictedMastraCodeAgentController } = await import('./restricted.js');
    const config = createConfig();
    await createRestrictedMastraCodeAgentController(config);

    const agentConfig = agentConfigs[0] as {
      tools: (args: { requestContext: object }) => Promise<Record<string, { execute: () => Promise<string> }>>;
    };
    const tools = await agentConfig.tools({ requestContext: {} });

    expect(Object.keys(tools)).toEqual(['remote_read']);
    await expect(tools.remote_read!.execute()).resolves.toBe('remote contents');
    expect(config.tools.ambient_tool.execute).not.toHaveBeenCalled();
  });

  it('makes the allowlist permanent across modes and disables ambient controller capabilities', async () => {
    const { createRestrictedMastraCodeAgentController } = await import('./restricted.js');
    const workspace = { id: 'remote-workspace' };
    await createRestrictedMastraCodeAgentController(
      createConfig({
        workspace,
        initialState: { yolo: true, skipGlobalInstructions: false },
        allowedTools: ['remote_read', 'view'],
        modes: [{ id: 'build' }, { id: 'review', availableTools: ['view', 'execute_command'] }],
      }),
    );

    const controllerConfig = controllerConfigs[0] as Record<string, any>;
    expect(controllerConfig.workspace).toBe(workspace);
    expect(controllerConfig.subagents).toEqual([]);
    expect(controllerConfig.gateways).toEqual([]);
    expect(controllerConfig.intervalHandlers).toEqual([]);
    expect(controllerConfig.modes).toEqual([
      { id: 'build', availableTools: ['remote_read', 'view'] },
      { id: 'review', availableTools: ['view'] },
    ]);
    expect(controllerConfig.initialState).toMatchObject({
      yolo: false,
      skipGlobalInstructions: true,
      projectPath: '/remote/workspace',
      projectName: 'remote-project',
      gitBranch: 'main',
      pluginSkillPaths: [],
      pluginCommandPaths: [],
      pluginInstructions: [],
    });

    const stateSchema = controllerConfig.stateSchema;
    expect(() => stateSchema.parse({ skipGlobalInstructions: false })).toThrow();
    expect(() => stateSchema.parse({ pluginSkillPaths: ['/ambient/skill'] })).toThrow();
    expect(() => stateSchema.parse({ pluginCommandPaths: ['/ambient/command'] })).toThrow();
    expect(() => stateSchema.parse({ pluginInstructions: ['ambient instructions'] })).toThrow();
  });

  it('registers the controller under the requested key on a supplied Mastra instance', async () => {
    const { mountRestrictedAgentControllerOnMastra } = await import('./restricted.js');
    const agentControllers: Record<string, unknown> = {};
    const mastra = {
      listAgentControllers: () => agentControllers,
      startWorkers: vi.fn(async () => {}),
    };

    const result = await mountRestrictedAgentControllerOnMastra(
      createConfig({ mastra, controllerId: 'restricted-code' }),
    );

    expect(agentControllers['restricted-code']).toBe(result.controller);
    expect(mastra.startWorkers).toHaveBeenCalledOnce();
  });

  it('does not inspect the host filesystem, process cwd, or credentials during initialization', async () => {
    const loadEnvFile = vi.spyOn(process, 'loadEnvFile').mockImplementation(() => {
      throw new Error('ambient env discovery attempted');
    });
    const cwd = vi.spyOn(process, 'cwd').mockImplementation(() => {
      throw new Error('ambient cwd discovery attempted');
    });
    const existsSync = vi.spyOn(fs, 'existsSync').mockImplementation(() => {
      throw new Error('ambient filesystem discovery attempted');
    });
    const execSync = vi.spyOn(childProcess, 'execSync').mockImplementation(() => {
      throw new Error('ambient process discovery attempted');
    });
    const credentialNames = ['MASTRA_GATEWAY_API_KEY', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY'] as const;
    const before = Object.fromEntries(credentialNames.map(name => [name, process.env[name]]));
    vi.stubEnv('DEFAULT_OM_MODEL_ID', 'ambient/model');

    vi.resetModules();
    const { createRestrictedMastraCodeAgentController } = await import('./restricted.js');
    await expect(createRestrictedMastraCodeAgentController(createConfig())).resolves.toBeDefined();
    const controllerConfig = controllerConfigs[0] as Record<string, any>;
    expect(controllerConfig.stateSchema.parse({})).toMatchObject({
      observerModelId: '__restricted_model_disabled__',
      reflectorModelId: '__restricted_model_disabled__',
      skipGlobalInstructions: true,
    });

    expect(loadEnvFile).not.toHaveBeenCalled();
    expect(cwd).not.toHaveBeenCalled();
    expect(existsSync).not.toHaveBeenCalled();
    expect(execSync).not.toHaveBeenCalled();
    expect(Object.fromEntries(credentialNames.map(name => [name, process.env[name]]))).toEqual(before);
  });

  it('rejects incomplete authority configuration instead of using local fallbacks', async () => {
    const { createRestrictedMastraCodeAgentController } = await import('./restricted.js');
    await expect(
      createRestrictedMastraCodeAgentController(createConfig({ project: { resourceId: '', name: '', rootPath: '' } })),
    ).rejects.toThrow('project.resourceId');
    await expect(createRestrictedMastraCodeAgentController(createConfig({ modes: [] }))).rejects.toThrow(
      'at least one mode',
    );
    await expect(createRestrictedMastraCodeAgentController(createConfig({ allowedTools: [''] }))).rejects.toThrow(
      'tool names must not be empty',
    );
    await expect(createRestrictedMastraCodeAgentController(createConfig({ memory: undefined }))).rejects.toThrow(
      'explicit memory policy',
    );
    await expect(createRestrictedMastraCodeAgentController(createConfig({ instructions: undefined }))).rejects.toThrow(
      'explicit instructions',
    );
    await expect(createRestrictedMastraCodeAgentController(createConfig({ storage: undefined }))).rejects.toThrow(
      'explicit storage',
    );
  });
});
