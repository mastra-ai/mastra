import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { MockLanguageModelV1 } from '@internal/ai-sdk-v4/test';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';

import { Agent } from '../agent';
import { LocalFilesystem } from '../workspace/filesystem';
import { Workspace } from '../workspace/workspace';
import { Mastra } from './index';

/**
 * Tests for workspace registration in Mastra.
 *
 * Workspaces can be registered with Mastra in two ways:
 * 1. Via the `workspace` config option (global workspace)
 * 2. Via agent workspaces (auto-registered when agents are added)
 *
 * This follows the same pattern as processor workflows.
 */
describe('Workspace Registration', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-reg-test-'));
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  // Helper to wait for async workspace registration with polling
  const waitForWorkspaceRegistration = async (mastra?: Mastra, id?: string, timeout = 1000) => {
    if (!mastra || !id) {
      // Fallback for cases where we just need a small delay
      await new Promise(resolve => setTimeout(resolve, 50));
      return;
    }
    const start = Date.now();
    while (!mastra.listWorkspaces()[id]) {
      if (Date.now() - start > timeout) {
        throw new Error(`Workspace ${id} not registered within ${timeout}ms`);
      }
      await new Promise(r => setTimeout(r, 5));
    }
  };

  const createMockModel = () =>
    new MockLanguageModelV1({
      doGenerate: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop',
        usage: { promptTokens: 10, completionTokens: 20 },
        text: 'Test response',
      }),
    });

  const createWorkspace = (id: string, name?: string) => {
    const filesystem = new LocalFilesystem({ basePath: tempDir });
    return new Workspace({
      id,
      name: name ?? `Workspace ${id}`,
      filesystem,
    });
  };

  describe('Global workspace registration', () => {
    it('should register global workspace in the registry', () => {
      const workspace = createWorkspace('global-workspace');

      const mastra = new Mastra({
        logger: false,
        workspace,
      });

      // Should be accessible via getWorkspace()
      expect(mastra.getWorkspace()).toBe(workspace);

      // Should also be in the registry
      const registeredWorkspace = mastra.getWorkspaceById('global-workspace');
      expect(registeredWorkspace).toBe(workspace);
    });

    it('should list global workspace in listWorkspaces', () => {
      const workspace = createWorkspace('global-workspace');

      const mastra = new Mastra({
        logger: false,
        workspace,
      });

      const workspaces = mastra.listWorkspaces();
      expect(Object.keys(workspaces)).toHaveLength(1);
      expect(workspaces['global-workspace']!.workspace).toBe(workspace);
      expect(workspaces['global-workspace']!.source).toBe('mastra');
    });
  });

  describe('addWorkspace', () => {
    it('should add workspace dynamically', () => {
      const mastra = new Mastra({ logger: false });

      const workspace = createWorkspace('dynamic-workspace');
      mastra.addWorkspace(workspace);

      const retrieved = mastra.getWorkspaceById('dynamic-workspace');
      expect(retrieved).toBe(workspace);
    });

    it('should use custom key when provided', () => {
      const mastra = new Mastra({ logger: false });

      const workspace = createWorkspace('workspace-id');
      mastra.addWorkspace(workspace, 'custom-key');

      const retrieved = mastra.getWorkspaceById('custom-key');
      expect(retrieved).toBe(workspace);
    });

    it('should skip duplicate workspaces', () => {
      const mastra = new Mastra({ logger: false });

      const workspace1 = createWorkspace('duplicate-id', 'First');
      const workspace2 = createWorkspace('duplicate-id', 'Second');

      mastra.addWorkspace(workspace1);
      mastra.addWorkspace(workspace2);

      // Should keep the first one
      const retrieved = mastra.getWorkspaceById('duplicate-id');
      expect(retrieved.name).toBe('First');
    });

    it('should throw when adding undefined workspace', () => {
      const mastra = new Mastra({ logger: false });

      expect(() => mastra.addWorkspace(undefined as any)).toThrow();
    });

    it('should throw when adding null workspace', () => {
      const mastra = new Mastra({ logger: false });

      expect(() => mastra.addWorkspace(null as any)).toThrow();
    });

    it('should throw when agent source is missing agentId', () => {
      const mastra = new Mastra({ logger: false });
      const workspace = createWorkspace('ws');

      expect(() => mastra.addWorkspace(workspace, undefined, { source: 'agent', agentName: 'A' })).toThrow(
        'agentId and agentName',
      );
    });

    it('should throw when agentId is supplied without source and agentName is missing', () => {
      const mastra = new Mastra({ logger: false });
      const workspace = createWorkspace('ws2');

      // source is inferred as 'agent' because agentId is present, but agentName is absent
      expect(() => mastra.addWorkspace(workspace, undefined, { agentId: 'some-id' })).toThrow('agentId and agentName');
    });
  });

  describe('getWorkspaceById', () => {
    it('should return workspace by id', () => {
      const workspace = createWorkspace('test-workspace');

      const mastra = new Mastra({
        logger: false,
        workspace,
      });

      const retrieved = mastra.getWorkspaceById('test-workspace');
      expect(retrieved).toBe(workspace);
    });

    it('should throw when workspace not found', () => {
      const mastra = new Mastra({ logger: false });

      expect(() => mastra.getWorkspaceById('non-existent')).toThrow();
    });

    it('should include available workspace IDs in error message', () => {
      const workspace = createWorkspace('existing-workspace');
      const mastra = new Mastra({
        logger: false,
        workspace,
      });

      try {
        mastra.getWorkspaceById('non-existent');
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.details.availableIds).toContain('existing-workspace');
      }
    });
  });

  describe('listWorkspaces', () => {
    it('should return empty object when no workspaces', () => {
      const mastra = new Mastra({ logger: false });

      const workspaces = mastra.listWorkspaces();
      expect(Object.keys(workspaces)).toHaveLength(0);
    });

    it('should return all registered workspaces', () => {
      const mastra = new Mastra({ logger: false });

      const workspace1 = createWorkspace('workspace-1');
      const workspace2 = createWorkspace('workspace-2');
      const workspace3 = createWorkspace('workspace-3');

      mastra.addWorkspace(workspace1);
      mastra.addWorkspace(workspace2);
      mastra.addWorkspace(workspace3);

      const workspaces = mastra.listWorkspaces();
      expect(Object.keys(workspaces)).toHaveLength(3);
      expect(workspaces['workspace-1']!.workspace).toBe(workspace1);
      expect(workspaces['workspace-2']!.workspace).toBe(workspace2);
      expect(workspaces['workspace-3']!.workspace).toBe(workspace3);
    });

    it('should return a copy of the registry', () => {
      const mastra = new Mastra({ logger: false });

      const workspace = createWorkspace('test-workspace');
      mastra.addWorkspace(workspace);

      const workspaces = mastra.listWorkspaces();
      // Modifying the returned object should not affect the internal registry
      delete workspaces['test-workspace'];

      expect(mastra.getWorkspaceById('test-workspace')).toBe(workspace);
    });
  });

  describe('Agent workspace auto-registration', () => {
    it('should register agent workspace when agent is added', async () => {
      const workspace = createWorkspace('agent-workspace');

      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'Test',
        model: createMockModel(),
        workspace,
      });

      const mastra = new Mastra({
        logger: false,
        agents: { testAgent: agent },
      });

      await waitForWorkspaceRegistration(mastra, 'agent-workspace');

      // Workspace should be in the registry
      const registered = mastra.getWorkspaceById('agent-workspace');
      expect(registered).toBe(workspace);
    });

    it('should register workspace when agent is added via addAgent', async () => {
      const mastra = new Mastra({ logger: false });

      const workspace = createWorkspace('late-agent-workspace');

      const agent = new Agent({
        id: 'late-agent',
        name: 'Late Agent',
        instructions: 'Test',
        model: createMockModel(),
        workspace,
      });

      mastra.addAgent(agent);

      await waitForWorkspaceRegistration(mastra, 'late-agent-workspace');

      // Workspace should be in the registry
      const registered = mastra.getWorkspaceById('late-agent-workspace');
      expect(registered).toBe(workspace);
    });

    it('should handle multiple agents with the same workspace', async () => {
      const workspace = createWorkspace('shared-workspace');

      const agent1 = new Agent({
        id: 'agent-1',
        name: 'Agent 1',
        instructions: 'Test',
        model: createMockModel(),
        workspace,
      });

      const agent2 = new Agent({
        id: 'agent-2',
        name: 'Agent 2',
        instructions: 'Test',
        model: createMockModel(),
        workspace,
      });

      const mastra = new Mastra({
        logger: false,
        agents: { agent1, agent2 },
      });

      await waitForWorkspaceRegistration(mastra, 'shared-workspace');

      // Workspace should only be registered once
      const workspaces = mastra.listWorkspaces();
      expect(Object.keys(workspaces)).toHaveLength(1);
      expect(workspaces['shared-workspace']!.workspace).toBe(workspace);
    });

    it('should not fail when agent has no workspace', async () => {
      const agent = new Agent({
        id: 'no-workspace-agent',
        name: 'No Workspace Agent',
        instructions: 'Test',
        model: createMockModel(),
      });

      const mastra = new Mastra({
        logger: false,
        agents: { testAgent: agent },
      });

      // No workspace to poll for — just allow the async registration path to settle
      await new Promise(r => setTimeout(r, 50));

      // Should have no workspaces
      const workspaces = mastra.listWorkspaces();
      expect(Object.keys(workspaces)).toHaveLength(0);
    });
  });

  describe('Combined global and agent workspaces', () => {
    it('should register both global and agent workspaces', async () => {
      const globalWorkspace = createWorkspace('global');
      const agentWorkspace = createWorkspace('agent');

      const agent = new Agent({
        id: 'test-agent',
        name: 'Test Agent',
        instructions: 'Test',
        model: createMockModel(),
        workspace: agentWorkspace,
      });

      const mastra = new Mastra({
        logger: false,
        workspace: globalWorkspace,
        agents: { testAgent: agent },
      });

      await waitForWorkspaceRegistration(mastra, 'agent');

      // Both should be registered
      const workspaces = mastra.listWorkspaces();
      expect(Object.keys(workspaces)).toHaveLength(2);
      expect(workspaces['global']!.workspace).toBe(globalWorkspace);
      expect(workspaces['global']!.source).toBe('mastra');
      expect(workspaces['agent']!.workspace).toBe(agentWorkspace);
      expect(workspaces['agent']!.source).toBe('agent');
      expect(workspaces['agent']!.agentId).toBe('test-agent');
      expect(workspaces['agent']!.agentName).toBe('Test Agent');

      // getWorkspace() should still return global
      expect(mastra.getWorkspace()).toBe(globalWorkspace);
    });
  });

  describe('dynamic workspace auto-registration', () => {
    it('should auto-register workspace created by dynamic function', async () => {
      const dynamicWorkspace = createWorkspace('dynamic-created');

      const agent = new Agent({
        id: 'dynamic-agent',
        name: 'Dynamic Agent',
        instructions: 'Test',
        model: createMockModel(),
        workspace: () => dynamicWorkspace,
      });

      const mastra = new Mastra({
        logger: false,
        agents: { agent },
      });

      // Before calling getWorkspace, dynamic workspace is not registered
      // (static registration at addAgent time calls getWorkspace which triggers registration)
      await waitForWorkspaceRegistration();

      // Now the workspace should be in the registry
      const registered = mastra.getWorkspaceById('dynamic-created');
      expect(registered).toBe(dynamicWorkspace);
    });

    it('should auto-register different workspaces from same dynamic function', async () => {
      const workspace1 = createWorkspace('context-workspace-1');
      const workspace2 = createWorkspace('context-workspace-2');

      const agent = new Agent({
        id: 'multi-workspace-agent',
        name: 'Multi Workspace Agent',
        instructions: 'Test',
        model: createMockModel(),
        workspace: ({ requestContext }) => {
          // Select workspace based on requestContext value
          const workspaceKey = requestContext?.get('workspaceKey');
          return workspaceKey === 'second' ? workspace2 : workspace1;
        },
      });

      const mastra = new Mastra({
        logger: false,
        agents: { agent },
      });

      // First call - should register workspace1
      const { RequestContext } = await import('../request-context');
      const ctx1 = new RequestContext();
      ctx1.set('workspaceKey', 'first');
      await agent.getWorkspace({ requestContext: ctx1 });

      expect(mastra.getWorkspaceById('context-workspace-1')).toBe(workspace1);

      // Second call with different context - should register workspace2
      const ctx2 = new RequestContext();
      ctx2.set('workspaceKey', 'second');
      await agent.getWorkspace({ requestContext: ctx2 });

      expect(mastra.getWorkspaceById('context-workspace-2')).toBe(workspace2);

      // Both should be in the registry
      const workspaces = mastra.listWorkspaces();
      expect(Object.keys(workspaces)).toHaveLength(2);
    });

    it('should not duplicate registration for same workspace ID', async () => {
      const workspace = createWorkspace('reused-workspace');
      let callCount = 0;

      const agent = new Agent({
        id: 'reuse-agent',
        name: 'Reuse Agent',
        instructions: 'Test',
        model: createMockModel(),
        workspace: () => {
          callCount++;
          return workspace;
        },
      });

      const mastra = new Mastra({
        logger: false,
        agents: { agent },
      });

      // Call getWorkspace multiple times
      await agent.getWorkspace();
      await agent.getWorkspace();
      await agent.getWorkspace();

      // Function called 4 times: once during addAgent registration + 3 explicit calls
      expect(callCount).toBe(4);

      // But workspace should only be registered once
      const workspaces = mastra.listWorkspaces();
      expect(Object.keys(workspaces)).toHaveLength(1);
      expect(workspaces['reused-workspace']!.workspace).toBe(workspace);
    });
  });
});
