import { renderPiMessage } from './render-adapter.js';
import type { PiExtensionGeneration } from './types.js';

export interface PiMessageSession {
  sendMessage(input: { content: string }): Promise<void>;
  steer(input: { content: string }): Promise<void>;
  followUp(input: { content: string }): Promise<void>;
  sendNotificationSignal?(input: {
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
  }): Promise<unknown>;
}

export type PiMessageDelivery = 'steer' | 'followUp';

function customMessageType(message: unknown): string | undefined {
  if (typeof message !== 'object' || message === null) return undefined;
  const value = message as { customType?: unknown };
  return typeof value.customType === 'string' && value.customType.length > 0 ? value.customType : undefined;
}

function textFromMessage(message: unknown): string {
  if (typeof message === 'string') return message;
  if (typeof message !== 'object' || message === null) throw new Error('Pi message must be a string or message object');
  const value = message as { content?: unknown; text?: unknown };
  if (typeof value.text === 'string') return value.text;
  if (typeof value.content === 'string') return value.content;
  if (Array.isArray(value.content)) {
    return value.content
      .map(part => (typeof part === 'object' && part !== null && 'text' in part ? String(part.text) : ''))
      .join('');
  }
  throw new Error('Pi message does not contain supported text content');
}

export class PiMessageAdapter {
  constructor(
    private readonly generation: PiExtensionGeneration,
    private readonly getSession: () => PiMessageSession | undefined,
  ) {}

  async sendMessage(message: unknown, options: { triggerTurn?: boolean } = {}): Promise<void> {
    this.generation.assertActive();
    const session = this.#session();
    const customType = customMessageType(message);
    const renderer = customType ? this.generation.registrations.messageRenderers.get(customType) : undefined;
    const text =
      customType && renderer
        ? (renderPiMessage(this.generation, customType, renderer, message) ?? textFromMessage(message))
        : textFromMessage(message);
    if (options.triggerTurn) {
      this.generation.addDiagnostic(
        'warning',
        'Pi custom-message triggerTurn cannot preserve Pi transcript semantics; Mastra Code delivered only the owned notification.',
        'sendMessage:triggerTurn',
      );
    }
    if (!session.sendNotificationSignal) {
      this.generation.addDiagnostic(
        'warning',
        'Pi custom messages require a notification-capable Mastra Code session; no transcript entry was fabricated.',
        'sendMessage',
      );
      return;
    }
    await session.sendNotificationSignal({
      title: this.generation.extensionId,
      message: text,
      metadata: { pluginId: this.generation.pluginId, extensionId: this.generation.extensionId },
    });
  }

  async sendUserMessage(
    message: unknown,
    options: { deliverAs?: PiMessageDelivery; triggerTurn?: boolean; expandPromptTemplates?: boolean } = {},
  ): Promise<void> {
    this.generation.assertActive();
    const session = this.#session();
    const content = textFromMessage(message);
    if (options.expandPromptTemplates) {
      this.generation.addDiagnostic(
        'warning',
        'Pi prompt-template expansion is deferred to Mastra Code command and skill dispatch; raw Pi template expansion is unavailable.',
        'sendUserMessage:expandPromptTemplates',
      );
    }
    if (options.triggerTurn === false) {
      this.generation.addDiagnostic(
        'warning',
        'Mastra Code cannot persist a Pi user message without triggering or queueing a turn; the message was not delivered.',
        'sendUserMessage',
      );
      return;
    }
    if (options.deliverAs === 'steer') await session.steer({ content });
    else if (options.deliverAs === 'followUp') await session.followUp({ content });
    else await session.sendMessage({ content });
  }

  #session(): PiMessageSession {
    const session = this.getSession();
    if (!session) throw new Error(`Pi extension "${this.generation.extensionId}" has no active Mastra Code session.`);
    return session;
  }
}
