import { describe, expect, it } from 'vitest';
import { createMockWorkspace, createTestHarness } from '../test-utils';
import type { HarnessRequestContext } from '../types';

describe('Harness.resolveWorkspace', () => {
  it('builds a full harness request context for dynamic workspaces', async () => {
    let projectPathFromSessionState: string | undefined;

    const harness = createTestHarness<{ projectPath: string }>({
      initialState: { projectPath: '/tmp/project-path' },
      workspace: ({ requestContext }) => {
        const ctx = requestContext.get('harness') as HarnessRequestContext<{ projectPath: string }>;
        projectPathFromSessionState = ctx.session.state.get().projectPath;
        return createMockWorkspace('dynamic-workspace');
      },
    });

    await harness.init();
    const session = await harness.createSession({ id: 'test-session', ownerId: 'test-owner' });

    const workspace = await harness.resolveWorkspace({ session });

    expect(workspace).toBeDefined();
    expect(projectPathFromSessionState).toBe('/tmp/project-path');
  });
});
