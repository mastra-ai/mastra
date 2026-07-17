/**
 * Component that renders an assistant message with streaming support.
 */

import fs from 'node:fs';
import path from 'node:path';
import { Container, Markdown, Spacer, Text } from '@earendil-works/pi-tui';
import type { MarkdownTheme } from '@earendil-works/pi-tui';
import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { getAssistantRenderParts } from '../db-message-parts.js';
import type { AssistantRenderPart } from '../db-message-parts.js';
import { sanitizeAnsiForRendering } from '../sanitize-ansi.js';
import { CHAT_INDENT, getMarkdownTheme, theme } from '../theme.js';
import type { ChatSpacingKind } from './chat-spacing.js';

let _compId = 0;
function asmDebugLog(...args: unknown[]) {
  if (!['true', '1'].includes(process.env.MASTRA_TUI_DEBUG!)) {
    return;
  }
  const line = `[ASM ${new Date().toISOString()}] ${args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')}\n`;
  try {
    fs.appendFileSync(path.join(process.cwd(), 'tui-debug.log'), line);
  } catch {}
}

function getStopReason(message: MastraDBMessage): { stopReason?: string; errorMessage?: string } {
  const content = message.content;
  if (typeof content === 'string') return {};
  const metadata = content.metadata as { stopReason?: string; errorMessage?: string } | undefined;
  return { stopReason: metadata?.stopReason, errorMessage: metadata?.errorMessage };
}

export class AssistantMessageComponent extends Container {
  private contentContainer: Container;
  private hideThinkingBlock: boolean;
  private markdownTheme: MarkdownTheme;
  private lastMessage?: MastraDBMessage;
  private _id: number;

  constructor(message?: MastraDBMessage, hideThinkingBlock = false, markdownTheme: MarkdownTheme = getMarkdownTheme()) {
    super();
    this._id = ++_compId;

    this.hideThinkingBlock = hideThinkingBlock;
    this.markdownTheme = markdownTheme;

    // Container for text/thinking content
    this.contentContainer = new Container();
    this.addChild(this.contentContainer);

    asmDebugLog(`COMP#${this._id} CREATED`);

    if (message) {
      this.updateContent(message);
    }
  }

  override invalidate(): void {
    super.invalidate();
    if (this.lastMessage) {
      const summary = getAssistantRenderParts(this.lastMessage)
        .map(part => (part.kind === 'text' ? `text(${part.text.length}ch)` : part.kind))
        .join(', ');
      asmDebugLog(`COMP#${this._id} INVALIDATE lastMessage=[${summary}]`);
      this.updateContent(this.lastMessage);
    }
  }

  setHideThinkingBlock(hide: boolean): void {
    this.hideThinkingBlock = hide;
  }

  getChatSpacingKind(): ChatSpacingKind | undefined {
    return this.contentContainer.children.length > 0 ? 'assistant-message' : undefined;
  }

  updateContent(message: MastraDBMessage): void {
    this.lastMessage = message;

    // Clear content container
    this.contentContainer.clear();

    // Project the nested DB message parts into ordered render items, then render
    // text and thinking traces in document order (tool parts are rendered by the
    // dedicated ToolExecutionComponent, so they are ignored here).
    const renderParts = getAssistantRenderParts(message).filter(
      (part): part is Extract<AssistantRenderPart, { kind: 'text' | 'thinking' }> =>
        part.kind === 'text' || part.kind === 'thinking',
    );

    for (let i = 0; i < renderParts.length; i++) {
      const part = renderParts[i]!;

      if (part.kind === 'text' && part.text.trim()) {
        // Assistant text messages - trim and sanitize escape codes
        this.contentContainer.addChild(
          new Markdown(sanitizeAnsiForRendering(part.text.trim()), CHAT_INDENT, 0, this.markdownTheme, {
            color: (text: string) => theme.fg('text', text),
          }),
        );
      } else if (part.kind === 'thinking' && part.text.trim()) {
        // Check if there's text content after this thinking block
        const hasTextAfter = renderParts.slice(i + 1).some(p => p.kind === 'text' && p.text.trim());

        if (this.hideThinkingBlock) {
          // Show static "Thinking..." label when hidden
          this.contentContainer.addChild(
            new Text(theme.italic(theme.fg('thinkingText', 'Thinking...')), CHAT_INDENT, 0),
          );
          if (hasTextAfter) {
            this.contentContainer.addChild(new Spacer(1));
          }
        } else {
          // Thinking traces in thinkingText color, italic
          this.contentContainer.addChild(
            new Markdown(sanitizeAnsiForRendering(part.text.trim()), CHAT_INDENT, 0, this.markdownTheme, {
              color: (text: string) => theme.fg('thinkingText', text),
              italic: true,
            }),
          );
          this.contentContainer.addChild(new Spacer(1));
        }
      }
    }

    // Check if aborted or error - show after partial content
    const { stopReason, errorMessage } = getStopReason(message);
    if (stopReason === 'aborted') {
      const abortMessage = errorMessage || 'Interrupted';
      this.contentContainer.addChild(new Text(theme.fg('error', abortMessage), CHAT_INDENT, 0));
    } else if (stopReason === 'error') {
      const errorMsg = errorMessage || 'Unknown error';
      this.contentContainer.addChild(new Text(theme.fg('error', `Error: ${errorMsg}`), CHAT_INDENT, 0));
    }
  }
}
