import { describe, expect, it, vi } from 'vitest';
import { AssistantRenderRegistry, getAssistantSegmentKey } from '../../assistant-render-registry.js';
import { AssistantMessageComponent } from '../../components/assistant-message.js';
import { resetUIAfterClone } from '../clone.js';

describe('resetUIAfterClone', () => {
  it('disposes assistant render ownership before reloading the cloned thread', async () => {
    const assistantRenderRegistry = new AssistantRenderRegistry();
    const { segment } = assistantRenderRegistry.start(
      'assistant-1',
      getAssistantSegmentKey('assistant-1'),
      () => new AssistantMessageComponent(),
    );
    vi.spyOn(segment.component, 'disposeRenderState');
    const state = {
      assistantRenderRegistry,
      streamingComponent: segment.component,
      streamingMessage: { id: 'assistant-1' },
      chatContainer: { clear: vi.fn() },
      pendingTools: new Map(),
      pendingTaskToolIds: new Set(),
      allToolComponents: [{}],
      allSystemReminderComponents: [{}],
      messageComponentsById: new Map([['assistant-1', segment.component]]),
      allShellComponents: [{}],
      session: {
        displayState: { clearModifiedFiles: vi.fn() },
        state: { set: vi.fn(async () => {}) },
      },
      previousPlanSnapshot: {},
      taskProgress: { updateTasks: vi.fn() },
      taskToolInsertIndex: 2,
      ui: { requestRender: vi.fn() },
    };
    const ctx = {
      state,
      updateStatusLine: vi.fn(),
      renderExistingMessages: vi.fn(async () => {}),
      showInfo: vi.fn(),
    };

    await resetUIAfterClone(ctx as never, 'Copy');

    expect(assistantRenderRegistry.size).toBe(0);
    expect(segment.component.disposeRenderState).toHaveBeenCalledOnce();
    expect(state.streamingComponent).toBeUndefined();
    expect(state.streamingMessage).toBeUndefined();
    expect(ctx.renderExistingMessages).toHaveBeenCalledOnce();
  });
});
