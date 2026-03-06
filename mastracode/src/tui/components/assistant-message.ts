/**
 * Component that renders an assistant message with streaming support.
 * Includes a role indicator and improved thinking block presentation.
 */

import fs from 'node:fs';
import path from 'node:path';
import { Container, Markdown, Spacer, Text } from '@mariozechner/pi-tui';
import type { MarkdownTheme } from '@mariozechner/pi-tui';
import type { HarnessMessage } from '@mastra/core/harness';
import { getMarkdownTheme, theme } from '../theme.js';

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
  private showRoleIndicator: boolean;

  constructor(
    message?: HarnessMessage,
    hideThinkingBlock = false,
    markdownTheme: MarkdownTheme = getMarkdownTheme(),
    showRoleIndicator = false,
  ) {
    super();
    this._id = ++_compId;

    this.hideThinkingBlock = hideThinkingBlock;
    this.markdownTheme = markdownTheme;
    this.showRoleIndicator = showRoleIndicator;

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
    this.lastMessage = {
      ...message,
      content: message.content.map(c => ({ ...c })),
    };

    this.contentContainer.clear();

    const hasVisibleContent = message.content.some(
      c => (c.type === 'text' && c.text.trim()) || (c.type === 'thinking' && c.thinking.trim()),
    );

    if (hasVisibleContent) {
      this.contentContainer.addChild(new Spacer(1));
      if (this.showRoleIndicator) {
        this.contentContainer.addChild(
          new Text(theme.bold(theme.fg('accent', '◆')) + ' ' + theme.bold(theme.fg('text', 'Assistant')), 1, 0),
        );
      }
    }

    for (let i = 0; i < message.content.length; i++) {
      const content = message.content[i]!;

      if (content.type === 'text' && (content as any).text.trim()) {
        this.contentContainer.addChild(new Markdown((content as any).text.trim(), 1, 0, this.markdownTheme));
      } else if (content.type === 'thinking' && (content as any).thinking.trim()) {
        const hasTextAfter = message.content.slice(i + 1).some(c => c.type === 'text' && (c as any).text.trim());
        const thinkingText = (content as any).thinking.trim();
        const thinkingLines = thinkingText.split('\n').length;

        if (this.hideThinkingBlock) {
          const summary = thinkingText.length > 80 ? thinkingText.slice(0, 77) + '...' : thinkingText;
          const firstLine = summary.split('\n')[0] || '';
          const label = thinkingLines > 1
            ? `${firstLine.slice(0, 60)}${firstLine.length > 60 ? '…' : ''} (+${thinkingLines - 1} lines)`
            : firstLine;
          this.contentContainer.addChild(
            new Text(
              theme.fg('dim', '  ') + theme.italic(theme.fg('thinkingText', `💭 ${label}`)) +
              theme.fg('dim', '  ctrl+t to expand'),
              1, 0,
            ),
          );
          if (hasTextAfter) {
            this.contentContainer.addChild(new Spacer(1));
          }
        } else {
          this.contentContainer.addChild(
            new Text(theme.fg('dim', '  ') + theme.italic(theme.fg('thinkingText', '💭 Thinking')), 1, 0),
          );
          this.contentContainer.addChild(
            new Markdown(thinkingText, 1, 0, this.markdownTheme, {
              color: (text: string) => theme.fg('thinkingText', text),
              italic: true,
            }),
          );
          this.contentContainer.addChild(new Spacer(1));
        }
      }
    }

    if (message.stopReason === 'aborted') {
      const abortMessage = message.errorMessage || 'Interrupted';
      this.contentContainer.addChild(new Spacer(1));
      this.contentContainer.addChild(new Text(theme.fg('error', abortMessage), 1, 0));
    } else if (message.stopReason === 'error') {
      const errorMsg = message.errorMessage || 'Unknown error';
      this.contentContainer.addChild(new Spacer(1));
      this.contentContainer.addChild(new Text(theme.fg('error', `Error: ${errorMsg}`), 1, 0));
    }
  }
}
