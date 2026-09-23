import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  dialogOptions: undefined as any,
  showModalOverlay: vi.fn(),
}));

vi.mock('../components/api-key-dialog.js', () => ({
  ApiKeyDialogComponent: class {
    focused = false;
    constructor(options: any) {
      mocks.dialogOptions = options;
    }
  },
}));

vi.mock('../overlay.js', () => ({ showModalOverlay: mocks.showModalOverlay }));

import { promptForApiKeyIfNeeded } from '../prompt-api-key.js';

describe('promptForApiKeyIfNeeded', () => {
  it('returns cancelled when the API-key dialog is closed', async () => {
    const ui = { hideOverlay: vi.fn() } as any;
    const model = {
      id: 'cancel-only/model',
      provider: 'cancel-only',
      modelName: 'model',
      hasApiKey: false,
      apiKeyEnvVar: 'CANCEL_ONLY_API_KEY',
    };
    const authStorage = { setStoredApiKey: vi.fn() } as any;

    const result = promptForApiKeyIfNeeded(ui, model, authStorage);
    mocks.dialogOptions.onCancel();

    await expect(result).resolves.toBe('cancelled');
    expect(ui.hideOverlay).toHaveBeenCalledOnce();
    expect(authStorage.setStoredApiKey).not.toHaveBeenCalled();
  });

  it('returns ready after storing a submitted API key', async () => {
    const ui = { hideOverlay: vi.fn() } as any;
    const model = {
      id: 'openai/gpt-5.6-sol',
      provider: 'openai',
      modelName: 'gpt-5.6-sol',
      hasApiKey: false,
      apiKeyEnvVar: 'OPENAI_API_KEY',
    };
    const authStorage = { setStoredApiKey: vi.fn() } as any;

    const result = promptForApiKeyIfNeeded(ui, model, authStorage);
    mocks.dialogOptions.onSubmit('sk-test');

    await expect(result).resolves.toBe('ready');
    expect(authStorage.setStoredApiKey).toHaveBeenCalledWith('openai', 'sk-test', 'OPENAI_API_KEY');
  });
});
