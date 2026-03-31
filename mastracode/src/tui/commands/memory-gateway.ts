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

  // Show current state
  const currentKey = authStorage.getStoredApiKey(MEMORY_GATEWAY_PROVIDER);
  const settings = loadSettings();
  const currentUrl = settings.memoryGateway?.baseUrl ?? MEMORY_GATEWAY_DEFAULT_URL;

  if (currentKey) {
    const masked = currentKey.length > 6 ? `****${currentKey.slice(-4)}` : '****';
    ctx.showInfo(`Current API key: ${masked} | URL: ${currentUrl}`);
  } else {
    ctx.showInfo(`No API key set | URL: ${currentUrl}`);
  }

  // Ask for API key
  const keyAnswer = await askText(ctx, `API key (or 'clear' to remove, ESC to cancel):`);
  if (keyAnswer === null) return; // ESC

  if (keyAnswer.toLowerCase() === 'clear') {
    authStorage.remove(`apikey:${MEMORY_GATEWAY_PROVIDER}`);
    delete process.env['MASTRA_GATEWAY_API_KEY'];
    ctx.showInfo('Memory gateway API key cleared');
    return;
  }

  // Store the key
  authStorage.setStoredApiKey(MEMORY_GATEWAY_PROVIDER, keyAnswer, 'MASTRA_GATEWAY_API_KEY');

  // Ask for URL
  const urlAnswer = await askText(ctx, `Gateway URL (ESC for default):`, currentUrl);
  if (urlAnswer && urlAnswer !== MEMORY_GATEWAY_DEFAULT_URL) {
    settings.memoryGateway = { baseUrl: urlAnswer };
  } else {
    settings.memoryGateway = {};
  }
  saveSettings(settings);

  ctx.showInfo('Memory gateway configured');
}
