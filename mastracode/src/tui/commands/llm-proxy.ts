import { Spacer } from '@mariozechner/pi-tui';
import { LLM_PROXY_DEFAULTS, loadSettings, saveSettings } from '../../onboarding/settings.js';
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
          resolve(trimmed.length > 0 ? trimmed : allowEmptyInput ? '' : null);
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

function parseHeadersJson(raw: string): Record<string, string> | null {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof k !== 'string' || typeof v !== 'string') return null;
    }
    return parsed as Record<string, string>;
  } catch {
    return null;
  }
}

export async function handleLlmProxyCommand(ctx: SlashCommandContext): Promise<void> {
  const settings = loadSettings();
  const proxy = settings.llmProxy ?? { ...LLM_PROXY_DEFAULTS };

  const hasProxy = !!proxy.baseUrl;
  const headerCount = Object.keys(proxy.headers).length;

  const statusParts: string[] = [];
  if (hasProxy) {
    statusParts.push(proxy.baseUrl!);
    if (headerCount > 0) statusParts.push(`${headerCount} header(s)`);
  }
  const status = hasProxy ? statusParts.join(' · ') : 'Not configured';

  const action = await askSelect(ctx, `LLM Proxy: ${status}`, [
    { label: 'Set base URL', value: 'url', description: proxy.baseUrl ?? 'Route LLM calls through a proxy' },
    {
      label: 'Set headers',
      value: 'headers',
      description: headerCount > 0 ? `${headerCount} configured` : 'Custom headers for proxy requests',
    },
    { label: 'Clear proxy', value: 'clear', description: 'Remove LLM proxy configuration' },
  ]);

  if (!action) return;

  if (action === 'url') {
    const url = await askText(ctx, 'LLM proxy base URL', proxy.baseUrl ?? undefined, true);
    if (url === null) return; // cancelled

    if (url && !isValidUrl(url)) {
      ctx.showError('Invalid URL. Use a full http(s) URL.');
      return;
    }

    settings.llmProxy = { ...proxy, baseUrl: url || null };
    saveSettings(settings);

    if (url) {
      ctx.showInfo(`LLM proxy base URL set: ${url}`);
    } else {
      ctx.showInfo('LLM proxy base URL cleared.');
    }
  } else if (action === 'headers') {
    const existing = headerCount > 0 ? JSON.stringify(proxy.headers) : undefined;
    const raw = await askText(ctx, 'Headers (JSON, e.g. {"Authorization":"Bearer tok"})', existing, true);
    if (raw === null) return; // cancelled

    if (!raw) {
      settings.llmProxy = { ...proxy, headers: {} };
      saveSettings(settings);
      ctx.showInfo('LLM proxy headers cleared.');
      return;
    }

    const parsed = parseHeadersJson(raw);
    if (!parsed) {
      ctx.showError('Invalid JSON. Must be a JSON object of string key-value pairs.');
      return;
    }

    settings.llmProxy = { ...proxy, headers: parsed };
    saveSettings(settings);
    ctx.showInfo(`LLM proxy headers set (${Object.keys(parsed).length} header(s)).`);
  } else if (action === 'clear') {
    settings.llmProxy = { ...LLM_PROXY_DEFAULTS };
    saveSettings(settings);
    ctx.showInfo('LLM proxy configuration cleared.');
  }
}
