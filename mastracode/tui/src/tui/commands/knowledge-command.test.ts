import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ showModalOverlay: vi.fn() }));

vi.mock('../overlay.js', () => ({ showModalOverlay: mocks.showModalOverlay }));
vi.mock('../components/knowledge-browser.js', () => ({
  KnowledgeBrowserComponent: class {
    focused = false;
    constructor(readonly options: unknown) {}
  },
}));

import { handleKnowledgeCommand } from './knowledge-command.js';

describe('handleKnowledgeCommand', () => {
  it('shows one actionable error when the inspector is unavailable', async () => {
    const showError = vi.fn();
    await handleKnowledgeCommand({ showError } as any);
    expect(showError).toHaveBeenCalledWith(
      'Knowledge inspection is unavailable. Enable MastraCode memory with a knowledge-capable store.',
    );
    expect(mocks.showModalOverlay).not.toHaveBeenCalled();
  });

  it('opens the browser when the inspector is available', () => {
    const promise = handleKnowledgeCommand({
      knowledgeInspector: {},
      showError: vi.fn(),
      state: { ui: { hideOverlay: vi.fn() } },
    } as any);
    expect(mocks.showModalOverlay).toHaveBeenCalledOnce();
    const component = mocks.showModalOverlay.mock.calls[0]![1] as {
      focused: boolean;
      options: { onClose: () => void };
    };
    expect(component.focused).toBe(true);
    component.options.onClose();
    return promise;
  });
});
