import type { ObservationalMemoryRecord, WorkingMemoryResponse } from '../types/index.js';
import { CONFIG } from '../config.js';

/**
 * Format observational memory for injection into the prompt
 */
export function formatObservationsForPrompt(record: ObservationalMemoryRecord | null): string | null {
  if (!record || !record.activeObservations) {
    return null;
  }

  const lines: string[] = ['## Observational Memory'];
  lines.push('');
  lines.push('The following observations were extracted from previous conversations:');
  lines.push('');
  lines.push(record.activeObservations);

  if (record.bufferedObservations) {
    lines.push('');
    lines.push('### Recent Observations (pending consolidation)');
    lines.push('');
    lines.push(record.bufferedObservations);
  }

  return lines.join('\n');
}

/**
 * Format working memory for injection into the prompt
 */
export function formatWorkingMemoryForPrompt(workingMemory: WorkingMemoryResponse | null): string | null {
  if (!workingMemory || !workingMemory.workingMemory) {
    return null;
  }

  const content =
    typeof workingMemory.workingMemory === 'string'
      ? workingMemory.workingMemory
      : JSON.stringify(workingMemory.workingMemory, null, 2);

  if (!content.trim()) {
    return null;
  }

  const lines: string[] = ['## Working Memory'];
  lines.push('');
  lines.push(`Source: ${workingMemory.source}`);
  lines.push('');
  lines.push(content);

  return lines.join('\n');
}

/**
 * Format full context for prompt injection
 */
export function formatContextForPrompt(
  observations: ObservationalMemoryRecord | null,
  workingMemory: WorkingMemoryResponse | null,
): string | null {
  const sections: string[] = [];

  if (CONFIG.injectObservations) {
    const observationsContext = formatObservationsForPrompt(observations);
    if (observationsContext) {
      sections.push(observationsContext);
    }
  }

  if (CONFIG.injectWorkingMemory) {
    const workingMemoryContext = formatWorkingMemoryForPrompt(workingMemory);
    if (workingMemoryContext) {
      sections.push(workingMemoryContext);
    }
  }

  if (sections.length === 0) {
    return null;
  }

  return `[MASTRA OBSERVATIONAL MEMORY]\n\n${sections.join('\n\n---\n\n')}\n\n[/MASTRA OBSERVATIONAL MEMORY]`;
}
