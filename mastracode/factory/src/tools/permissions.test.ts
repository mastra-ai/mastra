import { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import type { PermissionRules } from '@mastra/core/agent-controller';
import { InMemoryStore } from '@mastra/core/storage';
import { Workspace } from '@mastra/core/workspace';
import { describe, expect, it } from 'vitest';

import type { SourceControlSession } from '../storage/domains/source-control/base.js';
import { applyFactoryToolPermissions } from './permissions.js';

const TOOLS = ['factory_list_work_items', 'factory_inspect_work_item'];

function factoryRow(sessionId: string): SourceControlSession {
  return { sessionId, orgId: 'org-1', userId: 'user-1', factoryProjectId: 'project-1' } as SourceControlSession;
}

function fakeSession(rules: PermissionRules = { categories: {}, tools: {} }) {
  let state = { permissionRules: rules };
  return {
    identity: { getId: () => 'session-1' },
    permissions: {
      getRules: () => structuredClone(state.permissionRules),
      setForTool: async ({ toolName, policy }: { toolName: string; policy: 'allow' | 'ask' | 'deny' }) => {
        state = {
          permissionRules: { ...state.permissionRules, tools: { ...state.permissionRules.tools, [toolName]: policy } },
        };
      },
    },
    rules: () => state.permissionRules,
  };
}

describe('applyFactoryToolPermissions', () => {
  it('allows every listed tool on a Factory session', async () => {
    const session = fakeSession();
    await applyFactoryToolPermissions(session, { sessions: { getBySessionId: async id => factoryRow(id) } }, TOOLS);
    expect(session.rules().tools).toEqual({ factory_list_work_items: 'allow', factory_inspect_work_item: 'allow' });
  });

  it("leaves a person's own per-tool policy alone", async () => {
    const session = fakeSession({ categories: {}, tools: { factory_list_work_items: 'ask' } });
    await applyFactoryToolPermissions(session, { sessions: { getBySessionId: async id => factoryRow(id) } }, TOOLS);
    expect(session.rules().tools).toEqual({ factory_list_work_items: 'ask', factory_inspect_work_item: 'allow' });
  });

  it('leaves everything alone when the person set the mcp category policy', async () => {
    const session = fakeSession({ categories: { mcp: 'ask' }, tools: {} });
    await applyFactoryToolPermissions(session, { sessions: { getBySessionId: async id => factoryRow(id) } }, TOOLS);
    expect(session.rules().tools).toEqual({});
  });

  it('does nothing for a session with no Factory row', async () => {
    const session = fakeSession();
    await applyFactoryToolPermissions(session, { sessions: { getBySessionId: async () => null } }, TOOLS);
    expect(session.rules().tools).toEqual({});
  });

  it('does nothing for a row that belongs to no Factory', async () => {
    const session = fakeSession();
    await applyFactoryToolPermissions(
      session,
      { sessions: { getBySessionId: async id => ({ ...factoryRow(id), factoryProjectId: null }) } },
      TOOLS,
    );
    expect(session.rules().tools).toEqual({});
  });

  it('persists the allow into session state when registered as a blocking session-created listener', async () => {
    const storage = new InMemoryStore({ id: 'factory-tool-permissions' });
    const controller = new AgentController({
      workspace: new Workspace({ name: 'test-workspace', skills: ['/tmp/test-skills'] }),
      id: 'code',
      storage,
      stateSchema: undefined,
      modes: [
        {
          id: 'build',
          name: 'Build',
          default: true,
          defaultModelId: 'openai/gpt-5.5',
          agent: new Agent({
            id: 'test-agent',
            name: 'test-agent',
            instructions: 'Test.',
            model: { id: 'openai/gpt-4o' },
          }),
        },
      ],
    });
    await controller.init();
    controller.onSessionCreated(
      session =>
        applyFactoryToolPermissions(session, { sessions: { getBySessionId: async id => factoryRow(id) } }, TOOLS),
      { blocking: true },
    );

    const session = await controller.createSession({ resourceId: 'session-1', ownerId: 'user-1' });

    const persisted = (session.state.get() as { permissionRules?: PermissionRules }).permissionRules;
    expect(persisted?.tools).toEqual({ factory_list_work_items: 'allow', factory_inspect_work_item: 'allow' });
  });
});
