import type { ReflectorResult } from './types.js';
import type { TokenCounter } from './token-counter.js';

/**
 * Parse the Reflector's XML output.
 */
export function parseReflectorOutput(output: string, tokenCounter: TokenCounter): ReflectorResult {
  let observations = '';

  // Extract <observations> content
  const observationsRegex = /^[ \t]*<observations>([\s\S]*?)^[ \t]*<\/observations>/gim;
  const observationsMatches = [...output.matchAll(observationsRegex)];
  if (observationsMatches.length > 0) {
    observations = observationsMatches
      .map(m => m[1]?.trim() ?? '')
      .filter(Boolean)
      .join('\n');
  } else {
    // Fallback: extract list items or use full content
    const listItems = extractListItems(output);
    observations = listItems || output.trim();
  }

  return {
    observations,
    tokenCount: tokenCounter.count(observations),
  };
}

/**
 * Validate that reflection actually compressed below threshold.
 */
export function validateCompression(reflectedTokens: number, targetThreshold: number): boolean {
  return reflectedTokens < targetThreshold;
}

/**
 * Extract list items from content.
 */
function extractListItems(content: string): string {
  const lines = content.split('\n');
  const listLines: string[] = [];

  for (const line of lines) {
    if (/^\s*[-*]\s/.test(line) || /^\s*\d+\.\s/.test(line)) {
      listLines.push(line);
    }
    if (/^Date:/i.test(line.trim())) {
      listLines.push(line);
    }
  }

  return listLines.join('\n').trim();
}
