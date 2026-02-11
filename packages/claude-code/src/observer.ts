import type { ObserverResult } from './types.js';

/**
 * Parse the Observer's XML output to extract observations, current task, and suggested response.
 */
export function parseObserverOutput(output: string): ObserverResult {
  const result: ObserverResult = {
    observations: '',
    currentTask: undefined,
    suggestedResponse: undefined,
  };

  // Extract <observations> content (supports multiple blocks)
  const observationsRegex = /^[ \t]*<observations>([\s\S]*?)^[ \t]*<\/observations>/gim;
  const observationsMatches = [...output.matchAll(observationsRegex)];
  if (observationsMatches.length > 0) {
    result.observations = observationsMatches
      .map(m => m[1]?.trim() ?? '')
      .filter(Boolean)
      .join('\n');
  } else {
    // Fallback: extract list items from raw content
    result.observations = extractListItems(output);
  }

  // Extract <current-task> content
  const currentTaskMatch = output.match(/^[ \t]*<current-task>([\s\S]*?)^[ \t]*<\/current-task>/im);
  if (currentTaskMatch?.[1]) {
    result.currentTask = currentTaskMatch[1].trim();
  }

  // Extract <suggested-response> content
  const suggestedMatch = output.match(/^[ \t]*<suggested-response>([\s\S]*?)^[ \t]*<\/suggested-response>/im);
  if (suggestedMatch?.[1]) {
    result.suggestedResponse = suggestedMatch[1].trim();
  }

  return result;
}

/**
 * Optimize observations for token efficiency.
 * Removes non-critical emojis and extra formatting.
 */
export function optimizeObservations(observations: string): string {
  let optimized = observations;

  // Remove 🟡 and 🟢 emojis (keep 🔴 for critical items)
  optimized = optimized.replace(/🟡\s*/g, '');
  optimized = optimized.replace(/🟢\s*/g, '');

  // Remove arrow indicators
  optimized = optimized.replace(/\s*->\s*/g, ' ');

  // Clean up multiple spaces and newlines
  optimized = optimized.replace(/  +/g, ' ');
  optimized = optimized.replace(/\n{3,}/g, '\n\n');

  return optimized.trim();
}

/**
 * Fallback: Extract only list items when XML tags are missing.
 */
function extractListItems(content: string): string {
  const lines = content.split('\n');
  const listLines: string[] = [];

  for (const line of lines) {
    if (/^\s*[-*]\s/.test(line) || /^\s*\d+\.\s/.test(line)) {
      listLines.push(line);
    }
    // Also keep date headers
    if (/^Date:/i.test(line.trim())) {
      listLines.push(line);
    }
  }

  return listLines.join('\n').trim();
}
