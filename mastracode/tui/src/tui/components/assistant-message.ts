/**
 * Component that renders an assistant message with streaming support.
 */

import { Container, Markdown, Spacer, Text } from '@earendil-works/pi-tui';
import type { Component, MarkdownTheme } from '@earendil-works/pi-tui';
import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { getAssistantRenderParts } from '../db-message-parts.js';
import type { AssistantRenderPart } from '../db-message-parts.js';
import { sanitizeAnsiForRendering } from '../sanitize-ansi.js';
import { CHAT_INDENT, getMarkdownTheme, theme } from '../theme.js';
import type { ChatSpacingKind } from './chat-spacing.js';

export interface AssistantSourcePart {
  kind: 'text' | 'thinking';
  text: string;
}

export interface AssistantTerminalStatus {
  stopReason?: string;
  errorMessage?: string;
}

interface RenderNode {
  key: string;
  kind: 'markdown' | 'thinking-markdown' | 'text' | 'spacer';
  text?: string;
}

interface OwnedRenderNode {
  kind: RenderNode['kind'];
  component: Component;
  text?: string;
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
  private sourceParts: AssistantSourcePart[] = [];
  private terminalStatus?: AssistantTerminalStatus;
  private renderNodes = new Map<string, OwnedRenderNode>();
  private renderOrder: string[] = [];
  private quiet = false;

  constructor(message?: MastraDBMessage, hideThinkingBlock = false, markdownTheme: MarkdownTheme = getMarkdownTheme()) {
    super();
    this.hideThinkingBlock = hideThinkingBlock;
    this.markdownTheme = markdownTheme;
    this.contentContainer = new Container();
    this.addChild(this.contentContainer);

    if (message) {
      this.updateContent(message);
    }
  }

  override invalidate(): void {
    super.invalidate();
  }

  setHideThinkingBlock(hide: boolean): void {
    if (this.hideThinkingBlock === hide) return;
    this.hideThinkingBlock = hide;
    this.reconcileChildren();
  }

  setQuietModeDisplay(mode: 'quiet' | 'normal'): void {
    const quiet = mode === 'quiet';
    if (this.quiet === quiet) return;
    this.quiet = quiet;
    this.syncVisibleChildren();
  }

  getChatSpacingKind(): ChatSpacingKind | undefined {
    return this.contentContainer.children.length > 0 ? 'assistant-message' : undefined;
  }

  updateContent(message: MastraDBMessage): void {
    const sourceParts = getAssistantRenderParts(message)
      .filter(
        (part): part is Extract<AssistantRenderPart, { kind: 'text' | 'thinking' }> =>
          part.kind === 'text' || part.kind === 'thinking',
      )
      .map(part => ({ kind: part.kind, text: part.text }));
    this.updateRenderParts(sourceParts, getStopReason(message));
  }

  updateRenderParts(sourceParts: AssistantSourcePart[], terminalStatus: AssistantTerminalStatus = {}): void {
    this.sourceParts = sourceParts;
    this.terminalStatus = terminalStatus;
    this.reconcileChildren();
  }

  /** Release source-only reconciliation data once this segment becomes immutable. */
  finalizeRenderState(): void {
    this.sourceParts = [];
    this.terminalStatus = undefined;
  }

  /** Release every child and source reference when registry ownership is removed. */
  disposeRenderState(): void {
    this.sourceParts = [];
    this.terminalStatus = undefined;
    this.renderNodes.clear();
    this.renderOrder = [];
    this.contentContainer.clear();
  }

  private reconcileChildren(): void {
    const desired = this.buildRenderNodes();
    const nextNodes = new Map<string, OwnedRenderNode>();
    const nextOrder: string[] = [];

    for (const node of desired) {
      const existing = this.renderNodes.get(node.key);
      const owned = existing?.kind === node.kind ? existing : this.createRenderNode(node);
      if (node.text !== undefined && owned.text !== node.text) {
        (owned.component as Markdown | Text).setText(node.text);
        owned.text = node.text;
      }
      nextNodes.set(node.key, owned);
      nextOrder.push(node.key);
    }

    this.renderNodes = nextNodes;
    this.renderOrder = nextOrder;
    this.syncVisibleChildren();
  }

  /**
   * Quiet mode leaves "Thinking..." placeholders out of the chat entirely; the live one is shown in
   * the status line above the input instead, so hiding it never shifts the layout. Works from the
   * owned render nodes so it still applies after finalizeRenderState() has released the source parts.
   */
  private syncVisibleChildren(): void {
    const visible = this.renderOrder
      .filter(key => !this.quiet || !key.includes(':hidden-thinking'))
      .map(key => this.renderNodes.get(key)!.component);

    const current = this.contentContainer.children;
    const changed =
      current.length !== visible.length || visible.some((component, index) => component !== current[index]);
    if (!changed) return;
    this.contentContainer.clear();
    for (const component of visible) {
      this.contentContainer.addChild(component);
    }
  }

  private createRenderNode(node: RenderNode): OwnedRenderNode {
    switch (node.kind) {
      case 'markdown':
        return {
          kind: node.kind,
          component: new Markdown(node.text ?? '', CHAT_INDENT, 0, this.markdownTheme, {
            color: (text: string) => theme.fg('text', text),
          }),
          text: node.text,
        };
      case 'thinking-markdown':
        return {
          kind: node.kind,
          component: new Markdown(node.text ?? '', CHAT_INDENT, 0, this.markdownTheme, {
            color: (text: string) => theme.fg('thinkingText', text),
            italic: true,
          }),
          text: node.text,
        };
      case 'text':
        return {
          kind: node.kind,
          component: new Text(node.text ?? '', CHAT_INDENT, 0),
          text: node.text,
        };
      case 'spacer':
        return { kind: node.kind, component: new Spacer(1) };
    }
  }

  private buildRenderNodes(): RenderNode[] {
    const nodes: RenderNode[] = [];
    let hiddenThinkingRunStart: number | undefined;

    for (let index = 0; index < this.sourceParts.length; index++) {
      const part = this.sourceParts[index]!;
      const text = part.text.trim();
      if (!text) continue;

      if (part.kind === 'text') {
        hiddenThinkingRunStart = undefined;
        nodes.push({
          key: `part:${index}:text`,
          kind: 'markdown',
          text: sanitizeAnsiForRendering(text),
        });
        continue;
      }

      if (!this.hideThinkingBlock) {
        hiddenThinkingRunStart = undefined;
        nodes.push({
          key: `part:${index}:thinking`,
          kind: 'thinking-markdown',
          text: sanitizeAnsiForRendering(text),
        });
        nodes.push({ key: `part:${index}:thinking-spacer`, kind: 'spacer' });
        continue;
      }

      if (hiddenThinkingRunStart === undefined) {
        hiddenThinkingRunStart = index;
        nodes.push({
          key: `part:${index}:hidden-thinking`,
          kind: 'text',
          text: theme.italic(theme.fg('thinkingText', 'Thinking...')),
        });
      }

      const nextRenderedIndex = this.sourceParts.findIndex((candidate, candidateIndex) => {
        return candidateIndex > index && candidate.text.trim().length > 0;
      });
      if (nextRenderedIndex !== -1 && this.sourceParts[nextRenderedIndex]?.kind === 'text') {
        nodes.push({ key: `part:${hiddenThinkingRunStart}:hidden-thinking-spacer`, kind: 'spacer' });
      }
    }

    const { stopReason, errorMessage } = this.terminalStatus ?? {};
    if (stopReason === 'aborted') {
      nodes.push({ key: 'terminal:aborted', kind: 'text', text: theme.fg('error', errorMessage || 'Interrupted') });
    } else if (stopReason === 'error') {
      nodes.push({
        key: 'terminal:error',
        kind: 'text',
        text: theme.fg('error', `Error: ${errorMessage || 'Unknown error'}`),
      });
    }

    return nodes;
  }
}
