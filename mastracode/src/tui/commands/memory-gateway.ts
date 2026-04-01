import { Spacer } from '@mariozechner/pi-tui';
import {
  loadSettings,
  saveSettings,
  MEMORY_GATEWAY_PROVIDER,
  MEMORY_GATEWAY_DEFAULT_URL,
} from '../../onboarding/settings.js';
import { AskQuestionInlineComponent } from '../components/ask-question-inline.js';
import type { SlashCommandContext } from './types.js';

function askText(
  ctx: SlashCommandContext,
  question: string,
  defaultValue?: string,
): Promise<string | null> {
  return new Promise(resolve => {
    const component = new AskQuestionInlineComponent(
      {
        question,
        allowEmptyInput: false,
        onSubmit: answer => {
          ctx.state.activeInlineQuestion = undefined;
          const trimmed = answer.trim();
          resolve(trimmed.length > 0 ? trimmed : null);
        },
        onCancel: () => {
          ctx.state.activeInlineQuestion = undefined;
          resolve(null);
        },
      },
      ctx.state.ui,
    );

    if (defaultValue) {
      (component as any).input?.setValue?.(defaultValue);
    }

    ctx.state.activeInlineQuestion = component;
    ctx.state.chatContainer.addChild(new Spacer(1));
    ctx.state.chatContainer.addChild(component);
    ctx.state.chatContainer.addChild(new Spacer(1));
    ctx.state.ui.requestRender();
    ctx.state.chatContainer.invalidate();
  });
}

export async function handleMemoryGatewayCommand(ctx: SlashCommandContext): Promise<void> {
  const authStorage = ctx.authStorage;
  if (!authStorage) {
    ctx.showError('Auth storage not available');
    return;
  }

  // Resolve effective state from storage + env
  const currentKey = authStorage.getStoredApiKey(MEMORY_GATEWAY_PROVIDER) ?? process.env['MASTRA_GATEWAY_API_KEY'];
  const settings = loadSettings();
  const effectiveUrl =
    settings.memoryGateway?.baseUrl ?? process.env['MASTRA_GATEWAY_URL'] ?? MEMORY_GATEWAY_DEFAULT_URL;

  if (currentKey) {
    const masked = currentKey.length > 6 ? `****${currentKey.slice(-4)}` : '****';
    ctx.showInfo(`Current API key: ${masked} | URL: ${effectiveUrl}`);
  } else {
    ctx.showInfo(`No API key set | URL: ${effectiveUrl}`);
  }

  // Ask for API key
  const keyAnswer = await askText(ctx, currentKey
    ? `API key (ENTER to keep current, 'clear' to remove, ESC to cancel):`
    : `API key (or 'clear' to remove, ESC to cancel):`);
  if (keyAnswer === null) {
    // ESC with no key — abort; ESC with existing key — proceed to URL prompt
    if (!currentKey) return;
  } else if (keyAnswer.toLowerCase() === 'clear') {
    authStorage.remove(`apikey:${MEMORY_GATEWAY_PROVIDER}`);
    delete process.env['MASTRA_GATEWAY_API_KEY'];
    settings.memoryGateway = {};
    saveSettings(settings);
    ctx.showInfo('Memory gateway cleared. Note: memory mode changes take effect on next restart.');
    return;
  } else if (keyAnswer.length > 0) {
    authStorage.setStoredApiKey(MEMORY_GATEWAY_PROVIDER, keyAnswer, 'MASTRA_GATEWAY_API_KEY');
  }

  // Always prompt for URL so users can change it independently
  const urlAnswer = await askText(ctx, `Gateway URL (ESC for default):`, effectiveUrl);
  if (urlAnswer && urlAnswer !== MEMORY_GATEWAY_DEFAULT_URL) {
    settings.memoryGateway = { baseUrl: urlAnswer };
  } else {
    settings.memoryGateway = {};
  }
  saveSettings(settings);

  ctx.showInfo('Memory gateway configured. Note: memory mode changes take effect on next restart.');
}
