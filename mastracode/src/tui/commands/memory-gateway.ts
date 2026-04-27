import { Spacer } from '@mariozechner/pi-tui';
import { GatewayRegistry } from '@mastra/core/llm';
import {
  loadSettings,
  saveSettings,
  MEMORY_GATEWAY_PROVIDER,
  MEMORY_GATEWAY_DEFAULT_URL,
} from '../../onboarding/settings.js';
import { AskQuestionInlineComponent } from '../components/ask-question-inline.js';
import type { SlashCommandContext } from './types.js';

function askText(ctx: SlashCommandContext, question: string, defaultValue?: string): Promise<string | null> {
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

function askSelect(
  ctx: SlashCommandContext,
  question: string,
  options: Array<{ label: string; value: string; description?: string }>,
): Promise<string | null> {
  return new Promise(resolve => {
    const component = new AskQuestionInlineComponent(
      {
        question,
        options: options.map(option => ({ label: option.label, description: option.description })),
        onSubmit: answer => {
          ctx.state.activeInlineQuestion = undefined;
          const selected = options.find(option => option.label === answer);
          const trimmed = answer.trim();
          resolve(selected?.value ?? (trimmed.length > 0 ? trimmed : null));
        },
        onCancel: () => {
          ctx.state.activeInlineQuestion = undefined;
          resolve(null);
        },
      },
      ctx.state.ui,
    );

    ctx.state.activeInlineQuestion = component;
    ctx.state.chatContainer.addChild(new Spacer(1));
    ctx.state.chatContainer.addChild(component);
    ctx.state.chatContainer.addChild(new Spacer(1));
    ctx.state.ui.requestRender();
    ctx.state.chatContainer.invalidate();
  });
}

async function refreshGatewayModels(ctx: SlashCommandContext): Promise<void> {
  try {
    await GatewayRegistry.getInstance({ useDynamicLoading: true }).syncGateways(true);
  } catch (error) {
    ctx.showError(`Failed to refresh gateway models: ${error instanceof Error ? error.message : String(error)}`);
  }
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
  const keyAnswer = await askText(
    ctx,
    currentKey
      ? `API key (ENTER to keep current, 'clear' to remove, ESC to skip):`
      : `API key (or 'clear' to remove, ESC to cancel):`,
    currentKey,
  );
  if (keyAnswer === null) {
    // ESC with no key — abort; ESC with existing key — proceed to URL prompt
    if (!currentKey) return;
  } else if (keyAnswer.toLowerCase() === 'clear') {
    authStorage.remove(`apikey:${MEMORY_GATEWAY_PROVIDER}`);
    delete process.env['MASTRA_GATEWAY_API_KEY'];
    delete process.env['MASTRA_GATEWAY_URL'];
    settings.memoryGateway = {};
    saveSettings(settings);
    await refreshGatewayModels(ctx);
    ctx.showInfo('Memory gateway cleared. Memory mode changes take effect on next restart.');
    return;
  } else if (keyAnswer.length > 0) {
    authStorage.setStoredApiKey(MEMORY_GATEWAY_PROVIDER, keyAnswer, 'MASTRA_GATEWAY_API_KEY');
  }

  const urlChoice = await askSelect(ctx, 'Gateway URL', [
    {
      label: MEMORY_GATEWAY_DEFAULT_URL,
      value: MEMORY_GATEWAY_DEFAULT_URL,
      description: effectiveUrl === MEMORY_GATEWAY_DEFAULT_URL ? 'current' : 'hosted default',
    },
    {
      label: 'http://localhost:4111',
      value: 'http://localhost:4111',
      description: effectiveUrl === 'http://localhost:4111' ? 'current' : 'local development',
    },
  ]);

  if (urlChoice === null) {
    return;
  }

  const urlAnswer = urlChoice;

  if (urlAnswer && urlAnswer !== MEMORY_GATEWAY_DEFAULT_URL) {
    settings.memoryGateway = { baseUrl: urlAnswer };
    process.env['MASTRA_GATEWAY_URL'] = urlAnswer;
  } else {
    settings.memoryGateway = {};
    delete process.env['MASTRA_GATEWAY_URL'];
  }
  saveSettings(settings);
  await refreshGatewayModels(ctx);

  ctx.showInfo('Memory gateway configured. Memory mode changes take effect on next restart.');
}
