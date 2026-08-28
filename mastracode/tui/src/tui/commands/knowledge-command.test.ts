import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  beforeEach(() => {
    delete process.env.MASTRACODE_EXPERIMENTAL_SUBCONSCIOUS;
  });

  afterEach(() => {
    delete process.env.MASTRACODE_EXPERIMENTAL_SUBCONSCIOUS;
    mocks.showModalOverlay.mockClear();
  });

  it('stays unavailable when the experimental feature is disabled', async () => {
    const showError = vi.fn();
    await handleKnowledgeCommand({ knowledgeInspector: {}, showError } as any);
    expect(showError).toHaveBeenCalledWith('Unknown command: /knowledge');
    expect(mocks.showModalOverlay).not.toHaveBeenCalled();
  });

  it('shows one actionable error when the inspector is unavailable', async () => {
    process.env.MASTRACODE_EXPERIMENTAL_SUBCONSCIOUS = '1';
    const showError = vi.fn();
    await handleKnowledgeCommand({ showError } as any);
    expect(showError).toHaveBeenCalledWith(
      'Knowledge inspection is unavailable. Configure the default Knowledge runtime for this session.',
    );
    expect(mocks.showModalOverlay).not.toHaveBeenCalled();
  });

  it('passes the session-scoped inspector to the browser without resolving storage', () => {
    process.env.MASTRACODE_EXPERIMENTAL_SUBCONSCIOUS = '1';
    const knowledgeInspector = {};
    const promise = handleKnowledgeCommand({
      knowledgeInspector,
      showError: vi.fn(),
      state: { ui: { hideOverlay: vi.fn() } },
    } as any);
    expect(mocks.showModalOverlay).toHaveBeenCalledOnce();
    const component = mocks.showModalOverlay.mock.calls[0]![1] as {
      focused: boolean;
      options: { inspector: unknown; onClose: () => void };
    };
    expect(component.focused).toBe(true);
    expect(component.options.inspector).toBe(knowledgeInspector);
    component.options.onClose();
    return promise;
  });
});
