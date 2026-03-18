/**
 * Shared helper: prompt user for an API key when they select a model without one.
 */

import type { TUI } from '@mariozechner/pi-tui';
import type { AuthStorage } from '../auth/storage.js';
import { ApiKeyDialogComponent } from './components/api-key-dialog.js';
import type { ModelItem } from './components/model-selector.js';

/**
 * If the selected model doesn't have an API key, show a dialog to enter one.
 * Returns the model ID on success or when cancelled (same behavior — cancelling
 * just means no key was stored, but the model is still selected).
 *
 * Resolves after the user submits or cancels the dialog.
 */
export function promptForApiKeyIfNeeded(
  ui: TUI,
  model: ModelItem,
  authStorage: AuthStorage | undefined,
): Promise<void> {
  // Model already has a key (env var or stored) — nothing to do
  if (model.hasApiKey || !authStorage) {
    return Promise.resolve();
  }

  return new Promise<void>(resolve => {
    const dialog = new ApiKeyDialogComponent({
      providerName: model.provider,
      apiKeyEnvVar: model.apiKeyEnvVar,
      onSubmit: (key: string) => {
        ui.hideOverlay();
        // Store the key and set env var so model resolution picks it up
        authStorage.setStoredApiKey(model.provider, key, model.apiKeyEnvVar);
        resolve();
      },
      onCancel: () => {
        ui.hideOverlay();
        resolve();
      },
    });

    ui.showOverlay(dialog, {
      width: '70%',
      maxHeight: '50%',
      anchor: 'center',
    });
    dialog.focused = true;
  });
}
