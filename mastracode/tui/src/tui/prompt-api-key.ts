/**
 * Shared helper: prompt user for an API key when they select a model without one.
 */

import type { TUI } from '@earendil-works/pi-tui';
import type { AuthStorage } from '@mastra/code-sdk/auth/storage';
import { ApiKeyDialogComponent } from './components/api-key-dialog.js';
import type { ModelItem } from './components/model-selector.js';
import { showModalOverlay } from './overlay.js';

/**
 * If the selected model doesn't have an API key, show a dialog to enter one.
 * Returns `cancelled` when the user closes the dialog without saving a key.
 */
export function promptForApiKeyIfNeeded(
  ui: TUI,
  model: ModelItem,
  authStorage: AuthStorage | undefined,
): Promise<'ready' | 'cancelled'> {
  // Model already has a key (env var or stored) — nothing to do
  if (model.hasApiKey || !authStorage) {
    return Promise.resolve('ready');
  }

  return new Promise<'ready' | 'cancelled'>(resolve => {
    const dialog = new ApiKeyDialogComponent({
      providerName: model.provider,
      apiKeyEnvVar: model.apiKeyEnvVar,
      onSubmit: (key: string) => {
        ui.hideOverlay();
        // Store the key and set env var so model resolution picks it up
        authStorage.setStoredApiKey(model.provider, key, model.apiKeyEnvVar);
        resolve('ready');
      },
      onCancel: () => {
        ui.hideOverlay();
        resolve('cancelled');
      },
    });

    showModalOverlay(ui, dialog, { widthPercent: 0.7, maxHeight: '50%' });
    dialog.focused = true;
  });
}
