/**
 * /api-keys command: manage API keys for model providers.
 * Lists known providers with their key status and allows adding, updating, or removing keys.
 */

import { Box, SelectList, Spacer, Text } from '@mariozechner/pi-tui';
import type { SelectItem } from '@mariozechner/pi-tui';

import { ApiKeyDialogComponent } from '../components/api-key-dialog.js';
import type { AskQuestionInlineComponent } from '../components/ask-question-inline.js';
import { getSelectListTheme, theme } from '../theme.js';
import type { SlashCommandContext } from './types.js';

interface InlineInputHandler {
  handleInput(data: string): void;
}

interface ProviderInfo {
  provider: string;
  envVar?: string;
  source: 'env' | 'stored' | 'none';
}

/**
 * Build a deduplicated list of providers from available models,
 * annotated with their current key source.
 */
function getProviderList(
  ctx: SlashCommandContext,
  models: { provider: string; hasApiKey: boolean; apiKeyEnvVar?: string }[],
): ProviderInfo[] {
  const seen = new Map<string, ProviderInfo>();

  for (const model of models) {
    if (seen.has(model.provider)) continue;

    let source: ProviderInfo['source'] = 'none';
    if (ctx.authStorage?.hasStoredApiKey(model.provider)) {
      source = 'stored';
    } else if (model.apiKeyEnvVar && process.env[model.apiKeyEnvVar]) {
      source = 'env';
    } else if (model.hasApiKey) {
      source = 'env';
    }

    seen.set(model.provider, {
      provider: model.provider,
      envVar: model.apiKeyEnvVar,
      source,
    });
  }

  return Array.from(seen.values()).sort((a, b) => a.provider.localeCompare(b.provider));
}

function statusLabel(info: ProviderInfo): string {
  switch (info.source) {
    case 'env':
      return theme.fg('success', '✓') + theme.fg('dim', ' (env)');
    case 'stored':
      return theme.fg('success', '✓') + theme.fg('dim', ' (stored)');
    case 'none':
      return theme.fg('error', '✗') + theme.fg('dim', ' (not set)');
  }
}

function buildItems(providers: ProviderInfo[]): SelectItem[] {
  return providers.map(info => ({
    value: info.provider,
    label: `  ${info.provider}  ${statusLabel(info)}${info.envVar ? theme.fg('dim', `  ${info.envVar}`) : ''}`,
  }));
}

export async function handleApiKeysCommand(ctx: SlashCommandContext): Promise<void> {
  const models = await ctx.state.harness.listAvailableModels();
  let providers = getProviderList(ctx, models);

  if (providers.length === 0) {
    ctx.showInfo('No model providers found.');
    return;
  }

  return new Promise<void>(resolve => {
    const container = new Box(1, 1);
    container.addChild(new Text(theme.bold(theme.fg('accent', 'API Keys')), 0, 0));
    container.addChild(new Spacer(1));

    const detailText = new Text('', 0, 0);

    // Track which provider is currently highlighted
    let currentSelection = providers[0]!.provider;

    const updateDetail = (providerName: string) => {
      const info = providers.find(p => p.provider === providerName);
      if (!info) return;
      if (info.source === 'env') {
        detailText.setText(
          theme.fg('dim', '  Key set via environment variable. To change it, update your shell environment.'),
        );
      } else if (info.source === 'stored') {
        detailText.setText(theme.fg('dim', '  Key stored locally. Press Enter to update or Delete to remove.'));
      } else {
        detailText.setText(theme.fg('dim', '  No key configured. Press Enter to add one.'));
      }
      ctx.state.ui.requestRender();
    };

    // Build a SelectList with all event handlers wired up.
    // Called on initial render and again after save/remove to refresh status labels.
    let selectList: SelectList;
    const buildSelectList = (): SelectList => {
      const items = buildItems(providers);
      const list = new SelectList(items, Math.min(items.length, 15), getSelectListTheme());

      list.onSelect = (item: SelectItem) => {
        const info = providers.find(p => p.provider === item.value);
        if (!info) return;

        if (info.source === 'env') {
          ctx.showInfo(
            `${info.provider} key is set via environment variable${info.envVar ? ` (${info.envVar})` : ''}. Update it in your shell environment.`,
          );
          return;
        }

        showKeyDialog(info);
      };

      list.onCancel = () => {
        ctx.state.activeInlineQuestion = undefined;
        container.clear();
        container.addChild(new Text(theme.fg('dim', `${theme.fg('error', '✗')} API Keys (closed)`), 0, 0));
        ctx.state.ui.requestRender();
        resolve();
      };

      list.onSelectionChange = (item: SelectItem) => {
        currentSelection = item.value;
        updateDetail(item.value);
      };

      // Handle Delete key to remove stored keys
      const originalHandleInput = list.handleInput.bind(list);
      list.handleInput = (data: string) => {
        // Delete or Backspace
        if (data === '\x7f' || data === '\x1b[3~') {
          const info = providers.find(p => p.provider === currentSelection);
          if (info?.source === 'stored' && ctx.authStorage) {
            ctx.authStorage.remove(`apikey:${info.provider}`);
            if (info.envVar) {
              delete process.env[info.envVar];
            }
            providers = getProviderList(ctx, models);
            ctx.showInfo(`API key removed for ${info.provider}`);
            rebuildList();
          }
          return;
        }
        originalHandleInput(data);
      };

      return list;
    };

    const rebuildList = () => {
      const selectedIdx = Math.max(
        0,
        providers.findIndex(p => p.provider === currentSelection),
      );
      container.clear();
      container.addChild(new Text(theme.bold(theme.fg('accent', 'API Keys')), 0, 0));
      container.addChild(new Spacer(1));
      selectList = buildSelectList();
      selectList.setSelectedIndex(selectedIdx);
      currentSelection = providers[selectedIdx]?.provider ?? providers[0]!.provider;
      container.addChild(selectList);
      container.addChild(new Spacer(1));
      container.addChild(detailText);
      container.addChild(new Spacer(1));
      container.addChild(new Text(theme.fg('dim', '↑↓ navigate · Enter add/update · Delete remove · Esc close'), 0, 0));
      updateDetail(currentSelection);
      ctx.state.ui.requestRender();
    };

    const showKeyDialog = (info: ProviderInfo) => {
      const dialog = new ApiKeyDialogComponent({
        providerName: info.provider,
        apiKeyEnvVar: info.envVar,
        onSubmit: (key: string) => {
          ctx.state.ui.hideOverlay();
          if (ctx.authStorage) {
            ctx.authStorage.setStoredApiKey(info.provider, key, info.envVar);
            ctx.showInfo(`API key saved for ${info.provider}`);
            providers = getProviderList(ctx, models);
            rebuildList();
          } else {
            ctx.showError('Unable to save API key: storage unavailable');
          }
        },
        onCancel: () => {
          ctx.state.ui.hideOverlay();
        },
      });

      ctx.state.ui.showOverlay(dialog, {
        width: '70%',
        maxHeight: '50%',
        anchor: 'center',
      });
      dialog.focused = true;
    };

    selectList = buildSelectList();
    container.addChild(selectList);
    container.addChild(new Spacer(1));
    container.addChild(detailText);
    container.addChild(new Spacer(1));
    container.addChild(new Text(theme.fg('dim', '↑↓ navigate · Enter add/update · Delete remove · Esc close'), 0, 0));

    updateDetail(providers[0]!.provider);

    const inputShim: InlineInputHandler = { handleInput: (data: string) => selectList.handleInput(data) };
    ctx.state.activeInlineQuestion = inputShim as unknown as AskQuestionInlineComponent;

    ctx.state.chatContainer.addChild(new Spacer(1));
    ctx.state.chatContainer.addChild(container);
    ctx.state.chatContainer.addChild(new Spacer(1));
    ctx.state.ui.requestRender();
    ctx.state.chatContainer.invalidate();
  });
}
