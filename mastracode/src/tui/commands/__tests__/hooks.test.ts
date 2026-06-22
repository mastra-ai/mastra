import { describe, expect, it, vi } from 'vitest';
import { handleHooksCommand } from '../hooks';

function createCtx(hookManager?: any) {
  return {
    hookManager,
    showInfo: vi.fn(),
  } as any;
}

describe('handleHooksCommand', () => {
  it('shows setup guidance when the hook manager is missing', () => {
    const ctx = createCtx();

    handleHooksCommand(ctx, []);

    expect(ctx.showInfo).toHaveBeenCalledWith('Hooks system not initialized.');
  });

  it('reloads hook config', () => {
    const hookManager = {
      reload: vi.fn(),
    };
    const ctx = createCtx(hookManager);

    handleHooksCommand(ctx, ['reload']);

    expect(hookManager.reload).toHaveBeenCalledTimes(1);
    expect(ctx.showInfo).toHaveBeenCalledWith('Hooks config reloaded.');
  });

  it('renders hook status including notification hooks and config paths', () => {
    const hookManager = {
      hasHooks: vi.fn(() => true),
      getConfigPaths: vi.fn(() => ({ project: '/repo/.acme/hooks.json', global: '/home/.acme/hooks.json' })),
      getConfig: vi.fn(() => ({
        PreToolUse: [{ type: 'command', command: 'echo pre', matcher: { tool_name: 'execute_command' } }],
        Notification: [{ type: 'command', command: 'echo notify', description: 'notify user' }],
      })),
    };
    const ctx = createCtx(hookManager);

    handleHooksCommand(ctx, []);

    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('Project: /repo/.acme/hooks.json'));
    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('PreToolUse (1 hook):'));
    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('echo pre [tool: execute_command]'));
    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('Notification (1 hook):'));
    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('echo notify - notify user'));
  });

  it('shows configured hook paths when no hooks are configured', () => {
    const hookManager = {
      hasHooks: vi.fn(() => false),
      getConfigPaths: vi.fn(() => ({
        project: '/repo/.mastracode/hooks.json',
        global: '/home/.mastracode/hooks.json',
      })),
    };
    const ctx = createCtx(hookManager);

    handleHooksCommand(ctx, []);

    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('/repo/.mastracode/hooks.json (project)'));
    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('/home/.mastracode/hooks.json (global)'));
  });
});
