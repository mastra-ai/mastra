import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { AssistantMessageComponent } from './components/assistant-message.js';
import type { AssistantSourcePart, AssistantTerminalStatus } from './components/assistant-message.js';
import type { AssistantRenderPart } from './db-message-parts.js';
import { getAssistantRenderParts } from './db-message-parts.js';
import type { TUIState } from './state.js';
import { getMarkdownTheme } from './theme.js';

interface AssistantPartAccumulator {
  kind: AssistantSourcePart['kind'];
  base: string;
  chunks: string[];
  latestText: string;
}

interface AssistantSourceState {
  parts: AssistantPartAccumulator[];
  terminalStatus: AssistantTerminalStatus;
}

export interface AssistantRenderSegment {
  key: string;
  component: AssistantMessageComponent;
  finalized: boolean;
  source?: AssistantSourceState;
  pendingApply?: boolean;
  afterApply?: () => void;
}

export interface AssistantRenderRecord {
  messageId: string;
  segments: Map<string, AssistantRenderSegment>;
  activeSegmentKey?: string;
}

export interface AssistantQueueResult {
  mode: 'append' | 'replace' | 'unchanged';
  appendedChunks: number;
}

export interface AppliedAssistantState {
  messageId: string;
  segmentKey: string;
  component: AssistantMessageComponent;
}

function getSourceParts(message: MastraDBMessage): AssistantSourcePart[] {
  return getAssistantRenderParts(message)
    .filter(
      (part): part is Extract<AssistantRenderPart, { kind: 'text' | 'thinking' }> =>
        part.kind === 'text' || part.kind === 'thinking',
    )
    .map(part => ({ kind: part.kind, text: part.text }));
}

function getTerminalStatus(message: MastraDBMessage): AssistantTerminalStatus {
  const content = message.content;
  if (typeof content === 'string') return {};
  const metadata = content.metadata as AssistantTerminalStatus | undefined;
  return { stopReason: metadata?.stopReason, errorMessage: metadata?.errorMessage };
}

function replaceParts(parts: AssistantSourcePart[]): AssistantPartAccumulator[] {
  return parts.map(part => ({ kind: part.kind, base: part.text, chunks: [], latestText: part.text }));
}

export function getAssistantSegmentKey(messageId: string, precedingToolCallId?: string): string {
  return precedingToolCallId ? `${messageId}:segment:after-tool:${precedingToolCallId}` : `${messageId}:segment:part:0`;
}

export class AssistantRenderRegistry {
  private records = new Map<string, AssistantRenderRecord>();

  get size(): number {
    return this.records.size;
  }

  get(messageId: string): AssistantRenderRecord | undefined {
    return this.records.get(messageId);
  }

  getActive(messageId: string): AssistantRenderSegment | undefined {
    const record = this.records.get(messageId);
    return record?.activeSegmentKey ? record.segments.get(record.activeSegmentKey) : undefined;
  }

  start(
    messageId: string,
    segmentKey: string,
    createComponent: () => AssistantMessageComponent,
  ): { segment: AssistantRenderSegment; created: boolean } {
    let record = this.records.get(messageId);
    if (!record) {
      record = { messageId, segments: new Map() };
      this.records.set(messageId, record);
    }

    const existing = record.segments.get(segmentKey);
    if (existing) {
      existing.finalized = false;
      record.activeSegmentKey = segmentKey;
      return { segment: existing, created: false };
    }

    const segment = { key: segmentKey, component: createComponent(), finalized: false };
    record.segments.set(segmentKey, segment);
    record.activeSegmentKey = segmentKey;
    return { segment, created: true };
  }

  reconcile(
    messageId: string,
    segmentKey: string,
    message: MastraDBMessage,
    createComponent: () => AssistantMessageComponent,
  ): { segment: AssistantRenderSegment; created: boolean } {
    const result = this.start(messageId, segmentKey, createComponent);
    this.queueSegment(result.segment, message);
    this.applySegment(result.segment);
    return result;
  }

  reconcileActive(messageId: string, message: MastraDBMessage): AssistantRenderSegment | undefined {
    const segment = this.getActive(messageId);
    if (!segment) return undefined;
    this.queueSegment(segment, message);
    this.applySegment(segment);
    return segment;
  }

  queueActive(messageId: string, message: MastraDBMessage, afterApply?: () => void): AssistantQueueResult | undefined {
    const segment = this.getActive(messageId);
    return segment ? this.queueSegment(segment, message, afterApply) : undefined;
  }

  queueActiveTerminalStatus(messageId: string, terminalStatus: AssistantTerminalStatus): boolean {
    const segment = this.getActive(messageId);
    if (!segment) return false;
    if (!segment.source) {
      segment.source = { parts: [], terminalStatus };
      segment.pendingApply = true;
      return true;
    }
    if (
      segment.source.terminalStatus.stopReason === terminalStatus.stopReason &&
      segment.source.terminalStatus.errorMessage === terminalStatus.errorMessage
    ) {
      return false;
    }
    segment.source.terminalStatus = terminalStatus;
    segment.pendingApply = true;
    return true;
  }

  applyPending(messageId?: string): AppliedAssistantState[] {
    const applied: AppliedAssistantState[] = [];
    const records = messageId
      ? [this.records.get(messageId)].filter(record => record !== undefined)
      : this.records.values();
    for (const record of records) {
      for (const segment of record.segments.values()) {
        if (this.applySegment(segment)) {
          applied.push({ messageId: record.messageId, segmentKey: segment.key, component: segment.component });
        }
      }
    }
    return applied;
  }

  finalizeActive(messageId: string): AssistantRenderSegment | undefined {
    const record = this.records.get(messageId);
    if (!record?.activeSegmentKey) return undefined;
    const segment = record.segments.get(record.activeSegmentKey);
    if (!segment) return undefined;
    this.applySegment(segment);
    segment.finalized = true;
    segment.source = undefined;
    segment.pendingApply = false;
    segment.afterApply = undefined;
    segment.component.finalizeRenderState();
    record.activeSegmentKey = undefined;
    return segment;
  }

  finalize(messageId: string): void {
    const record = this.records.get(messageId);
    if (!record) return;
    for (const segment of record.segments.values()) {
      this.applySegment(segment);
      if (!segment.finalized) {
        segment.finalized = true;
        segment.component.finalizeRenderState();
      }
      segment.source = undefined;
      segment.pendingApply = false;
      segment.afterApply = undefined;
    }
    record.activeSegmentKey = undefined;
  }

  dispose(messageId: string): void {
    const record = this.records.get(messageId);
    if (!record) return;
    for (const segment of record.segments.values()) {
      this.disposeSegment(segment);
    }
    record.segments.clear();
    record.activeSegmentKey = undefined;
    this.records.delete(messageId);
  }

  disposeComponents(components: ReadonlySet<unknown>): string[] {
    const disposedMessageIds: string[] = [];
    for (const [messageId, record] of this.records) {
      for (const [segmentKey, segment] of record.segments) {
        if (!components.has(segment.component)) continue;
        this.disposeSegment(segment);
        record.segments.delete(segmentKey);
        if (record.activeSegmentKey === segmentKey) record.activeSegmentKey = undefined;
      }
      if (record.segments.size === 0) {
        this.records.delete(messageId);
        disposedMessageIds.push(messageId);
      }
    }
    return disposedMessageIds;
  }

  clear(): void {
    for (const messageId of [...this.records.keys()]) {
      this.dispose(messageId);
    }
  }

  private disposeSegment(segment: AssistantRenderSegment): void {
    segment.source = undefined;
    segment.pendingApply = false;
    segment.afterApply = undefined;
    segment.component.disposeRenderState();
  }

  private queueSegment(
    segment: AssistantRenderSegment,
    message: MastraDBMessage,
    afterApply?: () => void,
  ): AssistantQueueResult {
    const nextParts = getSourceParts(message);
    const nextTerminalStatus = getTerminalStatus(message);
    const current = segment.source?.parts;
    const sameStructure =
      current?.length === nextParts.length && current.every((part, index) => part.kind === nextParts[index]?.kind);
    const appendOnly =
      sameStructure && current.every((part, index) => nextParts[index]!.text.startsWith(part.latestText));

    if (!appendOnly) {
      segment.source = {
        parts: replaceParts(nextParts),
        terminalStatus: nextTerminalStatus,
      };
      segment.pendingApply = true;
      segment.afterApply = afterApply ?? segment.afterApply;
      return { mode: 'replace', appendedChunks: 0 };
    }

    let appendedChunks = 0;
    for (let index = 0; index < current.length; index++) {
      const part = current[index]!;
      const nextText = nextParts[index]!.text;
      const suffix = nextText.slice(part.latestText.length);
      if (suffix) {
        part.chunks.push(suffix);
        appendedChunks += 1;
      }
      part.latestText = nextText;
    }
    const terminalStatusChanged =
      segment.source!.terminalStatus.stopReason !== nextTerminalStatus.stopReason ||
      segment.source!.terminalStatus.errorMessage !== nextTerminalStatus.errorMessage;
    segment.source!.terminalStatus = nextTerminalStatus;
    segment.pendingApply = segment.pendingApply || appendedChunks > 0 || terminalStatusChanged;
    segment.afterApply = afterApply ?? segment.afterApply;
    return { mode: appendedChunks > 0 ? 'append' : 'unchanged', appendedChunks };
  }

  private applySegment(segment: AssistantRenderSegment): boolean {
    const source = segment.source;
    if (!source || !segment.pendingApply) return false;
    const sourceParts = source.parts.map(part => {
      const text = part.chunks.length > 0 ? part.base + part.chunks.join('') : part.base;
      part.base = text;
      part.latestText = text;
      part.chunks = [];
      return { kind: part.kind, text };
    });
    const afterApply = segment.afterApply;
    segment.pendingApply = false;
    segment.afterApply = undefined;
    segment.component.updateRenderParts(sourceParts, source.terminalStatus);
    afterApply?.();
    return true;
  }
}

export function ensureAssistantRenderSegment(
  state: TUIState,
  messageId: string,
  addChild: (component: AssistantMessageComponent) => void,
  precedingToolCallId?: string,
): AssistantMessageComponent {
  const key = getAssistantSegmentKey(messageId, precedingToolCallId);
  const { segment, created } = state.assistantRenderRegistry.start(
    messageId,
    key,
    () => new AssistantMessageComponent(undefined, state.hideThinkingBlock, getMarkdownTheme()),
  );
  state.streamingComponent = segment.component;
  if (created) addChild(segment.component);
  return segment.component;
}

export function finalizeStreamingAssistant(state: TUIState): void {
  const messageId = state.streamingMessage?.id;
  if (messageId) state.assistantRenderRegistry.finalizeActive(messageId);
  state.streamingComponent = undefined;
  state.streamingMessage = undefined;
}

export function disposeAssistantRenderState(state: TUIState): void {
  state.assistantRenderRegistry.clear();
  state.streamingComponent = undefined;
  state.streamingMessage = undefined;
}
