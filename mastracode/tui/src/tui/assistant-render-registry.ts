import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { AssistantMessageComponent } from './components/assistant-message.js';
import type { TUIState } from './state.js';
import { getMarkdownTheme } from './theme.js';

export interface AssistantRenderSegment {
  key: string;
  component: AssistantMessageComponent;
  finalized: boolean;
}

export interface AssistantRenderRecord {
  messageId: string;
  segments: Map<string, AssistantRenderSegment>;
  activeSegmentKey?: string;
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
    result.segment.component.updateContent(message);
    return result;
  }

  reconcileActive(messageId: string, message: MastraDBMessage): AssistantRenderSegment | undefined {
    const segment = this.getActive(messageId);
    segment?.component.updateContent(message);
    return segment;
  }

  finalizeActive(messageId: string): AssistantRenderSegment | undefined {
    const record = this.records.get(messageId);
    if (!record?.activeSegmentKey) return undefined;
    const segment = record.segments.get(record.activeSegmentKey);
    if (!segment) return undefined;
    segment.finalized = true;
    segment.component.finalizeRenderState();
    record.activeSegmentKey = undefined;
    return segment;
  }

  finalize(messageId: string): void {
    const record = this.records.get(messageId);
    if (!record) return;
    for (const segment of record.segments.values()) {
      if (!segment.finalized) {
        segment.finalized = true;
        segment.component.finalizeRenderState();
      }
    }
    record.activeSegmentKey = undefined;
  }

  dispose(messageId: string): void {
    const record = this.records.get(messageId);
    if (!record) return;
    for (const segment of record.segments.values()) {
      segment.component.disposeRenderState();
    }
    record.segments.clear();
    record.activeSegmentKey = undefined;
    this.records.delete(messageId);
  }

  clear(): void {
    for (const messageId of [...this.records.keys()]) {
      this.dispose(messageId);
    }
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
