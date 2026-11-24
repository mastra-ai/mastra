import type { ChunkType } from '@mastra/core/stream';
import type { OrganizationAnswer, ProcessorState } from './schema.js';

export function textDelta(part: ChunkType, text: string): ChunkType {
  return { type: 'text-delta', runId: part.runId, from: part.from, payload: { id: 'validated-answer', text } };
}

function markdownText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replace(/[\\`*_{}\[\]()#+\-.!|]/g, '\\$&');
}

function markdownCitation(citation: OrganizationAnswer['citations'][number]): string {
  const label = markdownText(`${citation.title} — ${citation.path} (${citation.locator})`);
  if (!citation.url || !isSafeMarkdownUrl(citation.url)) return `- ${label}`;
  return `- [${label}](<${citation.url}>)`;
}

function isSafeMarkdownUrl(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:' && !/[\\<>\s]/.test(url);
  } catch {
    return false;
  }
}

function studioPresentation(result: OrganizationAnswer): string {
  const status = {
    answered: 'Answered',
    insufficient_evidence: 'Insufficient evidence',
    conflicting_evidence: 'Conflicting evidence',
    operational_error: 'Operational error',
    clarification_required: 'Clarification required',
  }[result.status];
  const lines = [`**Status:** ${status}`, '', markdownText(result.answer)];
  if (result.citations.length) lines.push('', '**Citations**', ...result.citations.map(markdownCitation));
  lines.push('', '**Source status**');
  for (const source of result.sourceStatus) {
    const lastSuccess = source.lastSuccessAt ?? 'never';
    const error = source.error ? `; error: ${markdownText(source.error)}` : '';
    lines.push(
      `- ${markdownText(source.sourceId)}: ${source.ready ? 'ready' : 'unavailable'}; ${source.stale ? 'stale' : 'current'}; ${source.records} record${source.records === 1 ? '' : 's'}; last success: ${markdownText(lastSuccess)}${error}`,
    );
  }
  return lines.join('\n');
}

export function presentedResult(result: OrganizationAnswer, state: ProcessorState): string {
  return state.presentation === 'studio' ? studioPresentation(result) : JSON.stringify(result);
}
