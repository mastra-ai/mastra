import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ScenarioContext, ScenarioStep } from '../../scripts/smoke-test/scenario.js';
import { figmaScenario } from '../../scripts/smoke-test/scenarios/figma.js';

// Drives the Figma smoke scenario with a stand-in `call`, so its coverage,
// cleanup, and plan-gated paths can be checked without a live Figma file.

const TOOL_IDS = [
  'create_comment',
  'create_comment_reaction',
  'create_dev_resources',
  'delete_comment',
  'delete_comment_reaction',
  'delete_dev_resource',
  'get_comment',
  'get_component',
  'get_component_set',
  'get_current_user',
  'get_file_component_sets',
  'get_file_components',
  'get_file_node',
  'get_file_styles',
  'get_style',
  'get_version',
  'list_comment_reactions',
  'list_comments',
  'list_component_sets',
  'list_components',
  'list_dev_resources',
  'list_file_nodes',
  'list_styles',
  'list_versions',
  'render_images',
  'update_dev_resources',
].map(id => `figma_${id}`);

const RESPONSES: Record<string, unknown> = {
  figma_get_current_user: { id: '1', handle: 'Ada' },
  figma_list_file_nodes: {
    nodes: { '0:0': { document: { id: '0:0', children: [{ id: '0:1', children: [{ id: '1:2' }] }] } } },
  },
  figma_list_versions: { versions: [{ id: '30' }] },
  figma_get_file_components: { components: [{ key: 'comp' }] },
  figma_get_file_component_sets: { meta: { component_sets: [] } },
  figma_get_file_styles: { meta: { styles: [] } },
  figma_list_components: { components: [] },
  figma_list_component_sets: { component_sets: [{ key: 'set' }] },
  figma_list_styles: { styles: [] },
  figma_create_comment: { id: '100' },
  figma_list_comment_reactions: { reactions: [{ emoji: ':eyes:' }] },
  figma_create_dev_resources: { links_created: [{ id: 'dr_1' }] },
  figma_list_dev_resources: { dev_resources: [{ id: 'dr_1' }] },
  figma_update_dev_resources: { links_updated: ['dr_1'] },
};

async function runScenario({
  fail = {},
  responses = {},
}: {
  fail?: Record<string, string>;
  responses?: Record<string, unknown>;
} = {}) {
  const calls: Array<{ toolId: string; input: Record<string, unknown> }> = [];
  const errors: string[] = [];
  const tools = Object.fromEntries(TOOL_IDS.map(id => [id, {}]));
  const context = {
    integrationId: 'figma',
    tools,
    allTools: tools,
    runId: 'run-1',
    log: { info() {}, warn() {}, error: (message: string) => errors.push(message) },
    call: async <T>(toolId: string, input: Record<string, unknown>): Promise<T> => {
      calls.push({ toolId, input });
      const failure = fail[toolId];
      if (failure) throw new Error(failure);
      return (responses[toolId] ?? RESPONSES[toolId] ?? {}) as T;
    },
  } as unknown as ScenarioContext;
  const steps: ScenarioStep[] = await figmaScenario.run(context);
  return { steps, calls, errors };
}

describe('Figma smoke scenario', () => {
  const saved = { ...process.env };
  beforeEach(() => {
    process.env.MASTRA_SMOKE_FIGMA_FILE_KEY = 'FILE';
    process.env.MASTRA_SMOKE_FIGMA_TEAM_ID = '42';
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it('passes every tool and deletes what it created', async () => {
    const { steps, calls, errors } = await runScenario();

    expect(steps.filter(step => step.status !== 'pass')).toEqual([]);
    expect(new Set(steps.map(step => step.toolId))).toEqual(new Set(TOOL_IDS));
    expect(errors).toEqual([]);
    expect(calls.filter(call => call.toolId === 'figma_delete_comment').map(call => call.input.comment_id)).toEqual([
      '100',
      '100',
    ]);
    expect(calls).toContainEqual({
      toolId: 'figma_delete_dev_resource',
      input: { file_key: 'FILE', dev_resource_id: 'dr_1' },
    });
  });

  it('reads the team library without a test file and skips the file tools', async () => {
    delete process.env.MASTRA_SMOKE_FIGMA_FILE_KEY;

    const { steps, calls } = await runScenario();

    expect(calls.map(call => call.toolId)).toEqual([
      'figma_get_current_user',
      'figma_list_components',
      'figma_list_component_sets',
      'figma_list_styles',
      'figma_get_component',
      'figma_get_component_set',
      'figma_get_style',
    ]);
    expect(calls.find(call => call.toolId === 'figma_get_component_set')?.input).toEqual({ key: 'set' });
    expect(steps).toContainEqual(expect.objectContaining({ name: 'file tools', status: 'skip' }));
    expect(steps.filter(step => step.status === 'fail')).toEqual([]);
  });

  it('skips the team listings when no team is set', async () => {
    delete process.env.MASTRA_SMOKE_FIGMA_TEAM_ID;

    const { steps } = await runScenario();

    expect(steps).toContainEqual(expect.objectContaining({ toolId: 'figma_list_styles', status: 'skip' }));
  });

  it('logs and fails a comment it could not delete', async () => {
    const { steps, errors } = await runScenario({ fail: { figma_delete_comment: 'status=500' } });

    expect(steps).toContainEqual(expect.objectContaining({ name: 'delete comment', status: 'fail' }));
    expect(errors.some(error => error.includes('comment 100') && error.includes('run-1'))).toBe(true);
  });

  it('sends a node id in the dash form a Figma URL uses', async () => {
    const { calls } = await runScenario();

    expect(calls).toContainEqual(
      expect.objectContaining({ toolId: 'figma_render_images', input: expect.objectContaining({ node_ids: ['1-2'] }) }),
    );
  });

  it('probes a made-up version when the file has none', async () => {
    const { steps, calls } = await runScenario({
      responses: { figma_list_versions: { versions: [] } },
      fail: { figma_get_version: 'Version 1 not found for file FILE.' },
    });

    expect(steps.filter(step => step.status === 'fail')).toEqual([]);
    expect(calls).toContainEqual({ toolId: 'figma_get_version', input: { file_key: 'FILE', version_id: '1' } });
  });

  describe('a file without Dev Mode', () => {
    const notFound = 'Provider request failed (404): File not found [status=404, code=proxy_error]';
    const noDevMode = {
      responses: {
        figma_create_dev_resources: { links_created: [], errors: [{ error: 'File not found' }] },
        figma_update_dev_resources: { links_updated: [], errors: [{ error: 'Dev resource not found' }] },
      },
      fail: { figma_list_dev_resources: notFound, figma_delete_dev_resource: notFound },
    };

    it('passes every dev resource tool, creates nothing, and touches no real record', async () => {
      const { steps, calls, errors } = await runScenario(noDevMode);

      expect(steps.filter(step => step.status !== 'pass')).toEqual([]);
      expect(new Set(steps.map(step => step.toolId))).toEqual(new Set(TOOL_IDS));
      expect(errors).toEqual([]);
      expect(calls.filter(call => call.toolId === 'figma_create_dev_resources')).toHaveLength(1);
      expect(calls).toContainEqual({
        toolId: 'figma_delete_dev_resource',
        input: { file_key: 'FILE', dev_resource_id: '9007199254740991' },
      });
    });

    it('still fails when the other file reads failed too', async () => {
      const { steps } = await runScenario({
        ...noDevMode,
        fail: { ...noDevMode.fail, figma_list_comments: notFound },
      });

      expect(steps).toContainEqual(expect.objectContaining({ toolId: 'figma_list_dev_resources', status: 'fail' }));
      expect(steps).toContainEqual(expect.objectContaining({ name: 'attach dev resource', status: 'fail' }));
    });
  });

  describe('a create whose outcome is unknown', () => {
    it.each([
      [
        'comment',
        'figma_create_comment',
        {
          figma_list_comments: {
            items: [
              { id: '555', message: 'mastra-smoke-run-1' },
              { id: '9', message: 'hi' },
            ],
          },
        },
        { toolId: 'figma_delete_comment', input: { file_key: 'FILE', comment_id: '555' } },
      ],
      [
        'dev resource',
        'figma_create_dev_resources',
        { figma_list_dev_resources: { dev_resources: [{ id: 'dr_9', name: 'mastra-smoke-run-1' }] } },
        { toolId: 'figma_delete_dev_resource', input: { file_key: 'FILE', dev_resource_id: 'dr_9' } },
      ],
    ])('deletes a %s Figma kept without repeating the create', async (_what, createTool, responses, removal) => {
      const { steps, calls, errors } = await runScenario({ responses, fail: { [createTool]: 'socket hang up' } });

      expect(calls).toContainEqual(removal);
      expect(calls.filter(call => call.toolId === createTool)).toHaveLength(1);
      expect(errors).toEqual([]);
      expect(steps).toContainEqual(expect.objectContaining({ name: `delete kept ${_what}`, status: 'pass' }));
    });

    it('logs and fails when it cannot check whether Figma kept the comment', async () => {
      const { steps, errors } = await runScenario({
        fail: { figma_create_comment: 'socket hang up', figma_list_comments: 'status=500' },
      });

      expect(steps).toContainEqual(expect.objectContaining({ name: 'delete kept comment', status: 'fail' }));
      expect(errors.some(error => error.includes('mastra-smoke-run-1'))).toBe(true);
    });
  });
});
