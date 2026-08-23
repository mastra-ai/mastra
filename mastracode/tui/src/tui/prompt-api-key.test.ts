import type { TUI } from '@earendil-works/pi-tui';
import type { AuthStorage } from '@mastra/code-sdk/auth/storage';
import { describe, expect, it, vi } from 'vitest';

const { lastDialogOptions } = vi.hoisted(() => ({
  lastDialogOptions: { current: undefined as { onCancel: () => void } | undefined },
}));

vi.mock('./components/api-key-dialog.js', () => ({
  ApiKeyDialogComponent: vi.fn(function (options: { onCancel: () => void }) {
    lastDialogOptions.current = options;
    this.focused = false;
  }),
}));

vi.mock('./overlay.js', () => ({
  showModalOverlay: vi.fn(),
}));

import { ApiKeyDialogComponent } from './components/api-key-dialog.js';
import type { ModelItem } from './components/model-selector.js';
import { showModalOverlay } from './overlay.js';
import { promptForApiKeyIfNeeded } from './prompt-api-key.js';

function makeModel(overrides: Partial<ModelItem>): ModelItem {
  return {
    id: 'opencode/x-preview-f-free',
    provider: 'opencode',
    modelName: 'x-preview-f-free',
    hasApiKey: false,
    ...overrides,
  };
}

function makeDeps() {
  return {
    ui: { hideOverlay: vi.fn() } as unknown as TUI,
    authStorage: { setStoredApiKey: vi.fn() } as unknown as AuthStorage,
  };
}

describe('promptForApiKeyIfNeeded', () => {
  it('skips the dialog for models that run without credentials', async () => {
    const { ui, authStorage } = makeDeps();

    await promptForApiKeyIfNeeded(ui, makeModel({ noKeyNeeded: true }), authStorage);

    expect(ApiKeyDialogComponent).not.toHaveBeenCalled();
    expect(showModalOverlay).not.toHaveBeenCalled();
  });

  it('still prompts when the provider has neither a key nor keyless access', async () => {
    const { ui, authStorage } = makeDeps();

    const done = promptForApiKeyIfNeeded(ui, makeModel({ apiKeyEnvVar: 'OPENCODE_API_KEY' }), authStorage);

    expect(ApiKeyDialogComponent).toHaveBeenCalledTimes(1);
    expect(showModalOverlay).toHaveBeenCalledTimes(1);

    lastDialogOptions.current?.onCancel();
    await done;
  });
});
