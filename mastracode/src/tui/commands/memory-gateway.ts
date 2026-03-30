import { Spacer } from '@mariozechner/pi-tui';
import {
  MEMORY_GATEWAY_DEFAULTS,
  MEMORY_GATEWAY_DEFAULT_URL,
  loadSettings,
  saveSettings,
} from '../../onboarding/settings.js';
import { AskQuestionInlineComponent } from '../components/ask-question-inline.js';
import type { SlashCommandContext } from './types.js';

function askText(
  ctx: SlashCommandContext,
  question: string,
  defaultValue?: string,
  allowEmptyInput = false,
): Promise<string | null> {
  return new Promise(resolve => {
    const component = new AskQuestionInlineComponent(
      {
        question,
        allowEmptyInput,
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
          resolve(selected?.value ?? null);
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

function isValidUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function maskApiKey(key: string): string {
  if (key.length <= 8) return '••••••••';
  return key.slice(0, 4) + '••••' + key.slice(-4);
}

export async function handleMemoryGatewayCommand(ctx: SlashCommandContext): Promise<void> {
  const settings = loadSettings();
  const mg = settings.memoryGateway ?? { ...MEMORY_GATEWAY_DEFAULTS };

  const hasApiKey = !!mg.apiKey;
  const baseUrlDisplay = mg.baseUrl ?? `(default: ${MEMORY_GATEWAY_DEFAULT_URL})`;

  const statusParts: string[] = [];
  if (hasApiKey) {
    statusParts.push(`Key: ${maskApiKey(mg.apiKey!)}`);
    statusParts.push(baseUrlDisplay);
  }
  const status = hasApiKey ? statusParts.join(' · ') : 'Not configured';

  const action = await askSelect(ctx, `Memory Gateway: ${status}`, [
    {
      label: 'Set API key',
      value: 'apikey',
      description: hasApiKey ? maskApiKey(mg.apiKey!) : 'Enable Mastra cloud memory',
    },
    {
      label: 'Set base URL',
      value: 'url',
      description: mg.baseUrl ?? `Default: ${MEMORY_GATEWAY_DEFAULT_URL}`,
    },
    { label: 'Clear', value: 'clear', description: 'Remove memory gateway configuration' },
  ]);

  if (!action) return;

  if (action === 'apikey') {
    const key = await askText(ctx, 'Memory gateway API key');
    if (key === null) return; // cancelled

    settings.memoryGateway = { ...mg, apiKey: key || null };
    saveSettings(settings);

    if (key) {
      ctx.showInfo(`Memory gateway API key set: ${maskApiKey(key)}`);
    } else {
      ctx.showInfo('Memory gateway API key cleared.');
    }
  } else if (action === 'url') {
    const url = await askText(ctx, `Memory gateway base URL (default: ${MEMORY_GATEWAY_DEFAULT_URL})`, mg.baseUrl ?? undefined, true);
    if (url === null) return; // cancelled

    if (url && !isValidUrl(url)) {
      ctx.showError('Invalid URL. Use a full http(s) URL.');
      return;
    }

    settings.memoryGateway = { ...mg, baseUrl: url || null };
    saveSettings(settings);

    if (url) {
      ctx.showInfo(`Memory gateway base URL set: ${url}`);
    } else {
      ctx.showInfo(`Memory gateway base URL reset to default (${MEMORY_GATEWAY_DEFAULT_URL}).`);
    }
  } else if (action === 'clear') {
    settings.memoryGateway = { ...MEMORY_GATEWAY_DEFAULTS };
    saveSettings(settings);
    ctx.showInfo('Memory gateway configuration cleared.');
  }
}
