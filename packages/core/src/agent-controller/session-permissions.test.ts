import { describe, it, expect, beforeEach } from 'vitest';

import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { AgentController } from './agent-controller';
import { createMockWorkspace } from './test-utils';

async function createSession(storage: InMemoryStore) {
  const agent = new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });

  const controller = new AgentController({
    workspace: createMockWorkspace(),
    id: 'test-controller',
    storage,
    modes: [{ id: 'default', name: 'Default', default: true, agent }],
  });
  await controller.init();
  const session = await controller.createSession({ id: 'test-session', ownerId: 'test-owner' });
  return { controller, session };
}

describe('session.permissions', () => {
  let storage: InMemoryStore;

  beforeEach(() => {
    storage = new InMemoryStore();
  });

  it('returns empty rules when none are set', async () => {
    const { session } = await createSession(storage);
    expect(session.permissions.getRules()).toEqual({ categories: {}, tools: {} });
  });

  it('setForCategory persists the policy to session state', async () => {
    const { session } = await createSession(storage);

    await session.permissions.setForCategory({ category: 'execute', policy: 'ask' });

    expect(session.permissions.getRules().categories.execute).toBe('ask');
    expect((session.state.get() as any).permissionRules.categories.execute).toBe('ask');
  });

  it('setForTool persists the policy to session state', async () => {
    const { session } = await createSession(storage);

    await session.permissions.setForTool({ toolName: 'dangerous_tool', policy: 'deny' });

    expect(session.permissions.getRules().tools.dangerous_tool).toBe('deny');
    expect((session.state.get() as any).permissionRules.tools.dangerous_tool).toBe('deny');
  });

  it('reflects rules already present in session state', async () => {
    const { session } = await createSession(storage);
    await session.state.set({
      permissionRules: { categories: { read: 'allow' }, tools: {} },
    } as any);

    expect(session.permissions.getRules().categories.read).toBe('allow');
  });

  it('merges new policies without dropping existing ones', async () => {
    const { session } = await createSession(storage);

    await session.permissions.setForCategory({ category: 'execute', policy: 'deny' });
    await session.permissions.setForTool({ toolName: 'fetch', policy: 'allow' });

    const rules = session.permissions.getRules();
    expect(rules.categories.execute).toBe('deny');
    expect(rules.tools.fetch).toBe('allow');
  });

  describe('pattern-based approval', () => {
    it('allows a command matching an allow pattern', async () => {
      const { session } = await createSession(storage);
      await session.state.set({
        permissionRules: {
          categories: {},
          tools: {},
          patterns: [{ toolName: 'execute_command', pattern: 'git status*', policy: 'allow' }],
        },
      } as any);

      expect(session.resolveToolApproval('execute_command', { command: 'git status' })).toBe('allow');
      expect(session.resolveToolApproval('execute_command', { command: 'git status --short' })).toBe('allow');
    });

    it('denies a command matching a deny pattern', async () => {
      const { session } = await createSession(storage);
      await session.state.set({
        permissionRules: {
          categories: {},
          tools: {},
          patterns: [{ toolName: 'execute_command', pattern: 'rm -rf*', policy: 'deny' }],
        },
      } as any);

      expect(session.resolveToolApproval('execute_command', { command: 'rm -rf /' })).toBe('deny');
    });

    it('deny patterns take precedence over allow patterns', async () => {
      const { session } = await createSession(storage);
      await session.state.set({
        permissionRules: {
          categories: {},
          tools: {},
          patterns: [
            { toolName: 'execute_command', pattern: 'git*', policy: 'allow' },
            { toolName: 'execute_command', pattern: 'git push --force*', policy: 'deny' },
          ],
        },
      } as any);

      expect(session.resolveToolApproval('execute_command', { command: 'git status' })).toBe('allow');
      expect(session.resolveToolApproval('execute_command', { command: 'git push --force origin main' })).toBe('deny');
    });

    it('falls through to ask when no pattern matches', async () => {
      const { session } = await createSession(storage);
      await session.state.set({
        permissionRules: {
          categories: {},
          tools: {},
          patterns: [{ toolName: 'execute_command', pattern: 'git*', policy: 'allow' }],
        },
      } as any);

      expect(session.resolveToolApproval('execute_command', { command: 'rm -rf /' })).toBe('ask');
    });

    it('matches file_path arg for file tools', async () => {
      const { session } = await createSession(storage);
      await session.state.set({
        permissionRules: {
          categories: {},
          tools: {},
          patterns: [{ toolName: 'write_file', pattern: '*.test.ts', policy: 'allow' }],
        },
      } as any);

      expect(session.resolveToolApproval('write_file', { file_path: 'foo.test.ts' })).toBe('allow');
      expect(session.resolveToolApproval('write_file', { file_path: 'foo.ts' })).toBe('ask');
    });

    it('skips pattern matching when no args provided', async () => {
      const { session } = await createSession(storage);
      await session.state.set({
        permissionRules: {
          categories: {},
          tools: {},
          patterns: [{ toolName: 'execute_command', pattern: 'git*', policy: 'allow' }],
        },
      } as any);

      expect(session.resolveToolApproval('execute_command')).toBe('ask');
    });

    it('deny patterns override YOLO mode', async () => {
      const { session } = await createSession(storage);
      await session.state.set({
        yolo: true,
        permissionRules: {
          categories: {},
          tools: {},
          patterns: [{ toolName: 'execute_command', pattern: 'rm -rf*', policy: 'deny' }],
        },
      } as any);

      expect(session.resolveToolApproval('execute_command', { command: 'rm -rf /' })).toBe('deny');
      expect(session.resolveToolApproval('execute_command', { command: 'echo hello' })).toBe('allow');
    });
  });
});
