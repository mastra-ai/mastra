import type { DataOmPart } from '@mastra/memory/processors';
import type { MemoryMessage } from '../types';

export interface ExtractedOmMarker {
  type: 'status' | 'observation-start' | 'observation-end' | 'buffering-start' | 'buffering-end' | 'activation';
  timestamp: string;
  pendingTokens?: number;
  observationTokens?: number;
  observationThreshold?: number;
  reflectionThreshold?: number;
  generationCount?: number;
}

interface MastraV2Content {
  format?: number;
  parts: Array<{ type: string; [key: string]: unknown }>;
}

function parseContent(content: unknown): unknown {
  let value = content;
  for (let i = 0; i < 3 && typeof value === 'string'; i++) {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === 'object' && parsed !== null) return parsed;
      if (typeof parsed === 'string' && parsed !== value) {
        value = parsed;
        continue;
      }
      break;
    } catch {
      break;
    }
  }
  return value;
}

function isMastraV2(content: unknown): content is MastraV2Content {
  return (
    typeof content === 'object' &&
    content !== null &&
    'parts' in content &&
    Array.isArray((content as { parts?: unknown }).parts)
  );
}

type OmMarkerPart = Extract<
  DataOmPart,
  {
    type:
      | 'data-om-status'
      | 'data-om-observation-start'
      | 'data-om-observation-end'
      | 'data-om-buffering-start'
      | 'data-om-buffering-end'
      | 'data-om-activation';
  }
>;

function isOmMarkerPart(part: { type: string }): part is OmMarkerPart {
  const t = part.type;
  return (
    t === 'data-om-status' ||
    t === 'data-om-observation-start' ||
    t === 'data-om-observation-end' ||
    t === 'data-om-buffering-start' ||
    t === 'data-om-buffering-end' ||
    t === 'data-om-activation'
  );
}

function mapMarker(part: OmMarkerPart, messageCreatedAt: string): ExtractedOmMarker {
  switch (part.type) {
    case 'data-om-status':
      return {
        type: 'status',
        timestamp: messageCreatedAt,
        pendingTokens: part.data.windows?.active?.messages?.tokens,
        observationTokens: part.data.windows?.active?.observations?.tokens,
        observationThreshold: part.data.windows?.active?.messages?.threshold,
        reflectionThreshold: part.data.windows?.active?.observations?.threshold,
      };
    case 'data-om-observation-start':
      return {
        type: 'observation-start',
        timestamp: part.data.startedAt,
        pendingTokens: part.data.tokensToObserve,
        observationThreshold: part.data.config?.messageTokens,
        reflectionThreshold: part.data.config?.observationTokens,
      };
    case 'data-om-observation-end':
      return {
        type: 'observation-end',
        timestamp: part.data.completedAt,
        observationTokens: part.data.observationTokens,
      };
    case 'data-om-buffering-start':
      return {
        type: 'buffering-start',
        timestamp: part.data.startedAt,
        pendingTokens: part.data.tokensToBuffer,
        observationThreshold: part.data.config?.messageTokens,
        reflectionThreshold: part.data.config?.observationTokens,
      };
    case 'data-om-buffering-end':
      return {
        type: 'buffering-end',
        timestamp: part.data.completedAt,
        observationTokens: part.data.bufferedTokens,
      };
    case 'data-om-activation':
      return {
        type: 'activation',
        timestamp: part.data.activatedAt,
        pendingTokens: part.data.tokensActivated,
        observationTokens: part.data.observationTokens,
        observationThreshold: part.data.config?.messageTokens,
        reflectionThreshold: part.data.config?.observationTokens,
        generationCount: part.data.generationCount,
      };
  }
}

export function extractOmMarkers(messages: MemoryMessage[]): ExtractedOmMarker[] {
  const markers: ExtractedOmMarker[] = [];

  for (const msg of messages) {
    const content = parseContent(msg.content);
    if (!isMastraV2(content)) continue;

    for (const part of content.parts) {
      if (isOmMarkerPart(part)) {
        markers.push(mapMarker(part, new Date(msg.createdAt).toISOString()));
      }
    }
  }

  markers.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return markers;
}
