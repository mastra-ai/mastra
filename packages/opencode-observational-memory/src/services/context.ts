import { CONFIG } from '../config.js';

/**
 * Format observations for injection into the prompt
 */
export function formatObservationsForPrompt(observations: string | null): string | null {
  if (!observations || !observations.trim()) {
    return null;
  }

  const lines: string[] = ['## Observational Memory'];
  lines.push('');
  lines.push('The following observations were extracted from previous conversations:');
  lines.push('');
  lines.push(observations);

  return lines.join('\n');
}

/**
 * Format working memory for injection into the prompt
 */
export function formatWorkingMemoryForPrompt(workingMemory: string | null): string | null {
  if (!workingMemory || !workingMemory.trim()) {
    return null;
  }

  const lines: string[] = ['## Working Memory'];
  lines.push('');
  lines.push(workingMemory);

  return lines.join('\n');
}

/**
 * Format full context for prompt injection
 */
export function formatContextForPrompt(
  observations: string | null,
  workingMemory: string | null,
): string | null {
  const sections: string[] = [];

  if (CONFIG.injectObservations) {
    const observationsContext = formatObservationsForPrompt(observations);
    if (observationsContext) {
      sections.push(observationsContext);
    }
  }

  const workingMemoryContext = formatWorkingMemoryForPrompt(workingMemory);
  if (workingMemoryContext) {
    sections.push(workingMemoryContext);
  }

  if (sections.length === 0) {
    return null;
  }

  return `[MASTRA OBSERVATIONAL MEMORY]

${sections.join('\n\n---\n\n')}

[/MASTRA OBSERVATIONAL MEMORY]`;
}

/**
 * Format observations for compaction context
 * This is injected during session compaction to preserve important context
 */
export function formatObservationsForCompaction(observations: string | null): string {
  if (!observations || !observations.trim()) {
    return '';
  }

  return `
## Observational Memory (from Mastra)

The following observations should be preserved and referenced in the summary:

${observations}

These observations represent important context from previous conversations that should inform the compacted summary.
`;
}
