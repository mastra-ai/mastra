/**
 * Component that renders an assistant message with streaming support.
 */

import fs from 'node:fs';
import path from 'node:path';
import { Container, Markdown, Spacer, Text } from '@mariozechner/pi-tui';
import type { MarkdownTheme } from '@mariozechner/pi-tui';
import type { HarnessMessage } from '@mastra/core/harness';
import { CHAT_INDENT, getMarkdownTheme, theme } from '../theme.js';

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

export class AssistantMessageComponent extends Container {
  private contentContainer: Container;
  private hideThinkingBlock: boolean;
  private markdownTheme: MarkdownTheme;
  private lastMessage?: HarnessMessage;
  private _id: number;

  constructor(message?: HarnessMessage, hideThinkingBlock = false, markdownTheme: MarkdownTheme = getMarkdownTheme()) {
    super();
    this._id = ++_compId;

    this.hideThinkingBlock = hideThinkingBlock;
    this.markdownTheme = markdownTheme;

    // Container for text/thinking content
    this.contentContainer = new Container();
    this.addChild(this.contentContainer);
    this.addChild(new Spacer(1));

    asmDebugLog(`COMP#${this._id} CREATED`);

    if (message) {
      this.updateContent(message);
    }
  }

  override invalidate(): void {
    super.invalidate();
    if (this.lastMessage) {
      const summary = this.lastMessage.content
        .map(c => (c.type === 'text' ? `text(${c.text.length}ch)` : c.type))
        .join(', ');
      asmDebugLog(`COMP#${this._id} INVALIDATE lastMessage=[${summary}]`);
      this.updateContent(this.lastMessage);
    }
  }

  setHideThinkingBlock(hide: boolean): void {
    this.hideThinkingBlock = hide;
  }

  updateContent(message: HarnessMessage): void {
    // Deep copy the message to prevent mutation from the harness's shared content array
    this.lastMessage = {
      ...message,
      content: message.content.map(c => ({ ...c })),
    };

    // Clear content container
    this.contentContainer.clear();

    // Render content in order
    for (let i = 0; i < message.content.length; i++) {
      const content = message.content[i]!;

      if (content.type === 'text' && (content as any).text.trim()) {
        // Assistant text messages - trim the text
        this.contentContainer.addChild(
          new Markdown((content as any).text.trim(), CHAT_INDENT, 0, this.markdownTheme, {
            color: (text: string) => theme.fg('text', text),
          }),
        );
      } else if (content.type === 'thinking' && (content as any).thinking.trim()) {
        // Check if there's text content after this thinking block
        const hasTextAfter = message.content.slice(i + 1).some(c => c.type === 'text' && (c as any).text.trim());

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
            new Markdown((content as any).thinking.trim(), CHAT_INDENT, 0, this.markdownTheme, {
              color: (text: string) => theme.fg('thinkingText', text),
              italic: true,
            }),
          );
          this.contentContainer.addChild(new Spacer(1));
        }
      }
      // Skip tool_call and tool_result - those are rendered by ToolExecutionComponent
    }

    // Check if aborted or error - show after partial content
    if (message.stopReason === 'aborted') {
      const abortMessage = message.errorMessage || 'Interrupted';
      this.contentContainer.addChild(new Text(theme.fg('error', abortMessage), CHAT_INDENT, 0));
    } else if (message.stopReason === 'error') {
      const errorMsg = message.errorMessage || 'Unknown error';
      this.contentContainer.addChild(new Text(theme.fg('error', `Error: ${errorMsg}`), CHAT_INDENT, 0));
    }
  }
}
