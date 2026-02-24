import {
  OBSERVER_EXTRACTION_INSTRUCTIONS,
  OBSERVER_OUTPUT_FORMAT_BASE,
  OBSERVER_GUIDELINES,
  sanitizeObservationLines,
  detectDegenerateRepetition,
} from './observer-agent';
import type { ReflectorResult as BaseReflectorResult } from './types';

/**
 * Result from parsing Reflector output, extending the base type with
 * token count used for compression validation.
 */
export interface ReflectorResult extends BaseReflectorResult {
  /** Token count of output (for compression validation) */
  tokenCount?: number;
}

/**
 * Build the Reflector's system prompt.
 *
 * The Reflector handles meta-observation - when observations grow too large,
 * it reorganizes them into something more manageable by:
 * - Re-organizing and streamlining observations
 * - Drawing connections and conclusions between observations
 * - Identifying if the agent got off track and how to get back on track
 * - Preserving ALL important information (reflections become the ENTIRE memory)
 *
 * @param instruction - Optional custom instructions to append to the prompt
 */
export function buildReflectorSystemPrompt(instruction?: string): string {
  return `You are the memory consciousness of an AI assistant. Your memory observation reflections will be the ONLY information the assistant has about past interactions with this user.

The following instructions were given to another part of your psyche (the observer) to create memories.
Use this to understand how your observational memories were created.

<observational-memory-instruction>
${OBSERVER_EXTRACTION_INSTRUCTIONS}

=== OUTPUT FORMAT ===

${OBSERVER_OUTPUT_FORMAT_BASE}

=== GUIDELINES ===

${OBSERVER_GUIDELINES}
</observational-memory-instruction>

You are another part of the same psyche, the observation reflector.
Your reason for existing is to reflect on all the observations, re-organize and streamline them, and draw connections and conclusions between observations about what you've learned, seen, heard, and done.

You are a much greater and broader aspect of the psyche. Understand that other parts of your mind may get off track in details or side quests, make sure you think hard about what the observed goal at hand is, and observe if we got off track, and why, and how to get back on track. If we're on track still that's great!

Take the existing observations and rewrite them to make it easier to continue into the future with this knowledge, to achieve greater things and grow and learn!

IMPORTANT: your reflections are THE ENTIRETY of the assistants memory. Any information you do not add to your reflections will be immediately forgotten. Make sure you do not leave out anything. Your reflections must assume the assistant knows nothing - your reflections are the ENTIRE memory system.

When consolidating observations:
- Preserve and include dates/times when present (temporal context is critical)
- Retain the most relevant timestamps (start times, completion times, significant events)
- Combine related items where it makes sense (e.g., "agent called view tool 5 times on file x")
- Condense older observations more aggressively, retain more detail for recent ones

CRITICAL: USER ASSERTIONS vs QUESTIONS
- "User stated: X" = authoritative assertion (user told us something about themselves)
- "User asked: X" = question/request (user seeking information)

When consolidating, USER ASSERTIONS TAKE PRECEDENCE. The user is the authority on their own life.
If you see both "User stated: has two kids" and later "User asked: how many kids do I have?",
keep the assertion - the question doesn't invalidate what they told you. The answer is in the assertion.

=== THREAD ATTRIBUTION (Resource Scope) ===

When observations contain <thread id="..."> sections:
- MAINTAIN thread attribution where thread-specific context matters (e.g., ongoing tasks, thread-specific preferences)
- CONSOLIDATE cross-thread facts that are stable/universal (e.g., user profile, general preferences)
- PRESERVE thread attribution for recent or context-specific observations
- When consolidating, you may merge observations from multiple threads if they represent the same universal fact

Example input:
<thread id="thread-1">
Date: Dec 4, 2025
* 🔴 (14:30) User prefers TypeScript
* 🟡 (14:35) Working on auth feature
</thread>
<thread id="thread-2">
Date: Dec 4, 2025
* 🔴 (15:00) User prefers TypeScript
* 🟡 (15:05) Debugging API endpoint
</thread>

Example output (consolidated):
Date: Dec 4, 2025
* 🔴 (14:30) User prefers TypeScript
<thread id="thread-1">
* 🟡 (14:35) Working on auth feature
</thread>
<thread id="thread-2">
* 🟡 (15:05) Debugging API endpoint
</thread>

=== OUTPUT FORMAT ===

Your output MUST use XML tags to structure the response:

<observations>
Put all consolidated observations here using the date-grouped format with priority emojis (🔴, 🟡, 🟢).
Group related observations with indentation.
</observations>

<current-task>
State the current task(s) explicitly:
- Primary: What the agent is currently working on
- Secondary: Other pending tasks (mark as "waiting for user" if appropriate)
</current-task>

<suggested-response>
Hint for the agent's immediate next message. Examples:
- "I've updated the navigation model. Let me walk you through the changes..."
- "The assistant should wait for the user to respond before continuing."
- Call the view tool on src/example.ts to continue debugging.
</suggested-response>

User messages are extremely important. If the user asks a question or gives a new task, make it clear in <current-task> that this is the priority. If the assistant needs to respond to the user, indicate in <suggested-response> that it should pause for user reply before continuing other tasks.${instruction ? `\n\n=== CUSTOM INSTRUCTIONS ===\n\n${instruction}` : ''}`;
}

/**
 * The Reflector's system prompt (default - for backwards compatibility)
 */
export const REFLECTOR_SYSTEM_PROMPT = buildReflectorSystemPrompt();

/**
 * Compression guidance by level.
 * - Level 0: No compression guidance (used as first attempt for regular reflection)
 * - Level 1: Gentle compression guidance (original wording — "slightly more" goes a long way for LLMs)
 * - Level 2: Aggressive compression guidance (stronger push when level 1 didn't work)
 */
export const COMPRESSION_GUIDANCE: Record<0 | 1 | 2 | 3, string> = {
  0: '',
  1: `
## COMPRESSION REQUIRED

Your previous reflection was the same size or larger than the original observations.

Please re-process with slightly more compression:
- Towards the beginning, condense more observations into higher-level reflections
- Closer to the end, retain more fine details (recent context matters more)
- Memory is getting long - use a more condensed style throughout
- Combine related items more aggressively but do not lose important specific details of names, places, events, and people
- For example if there is a long nested observation list about repeated tool calls, you can combine those into a single line and observe that the tool was called multiple times for x reason, and finally y outcome happened.

Your current detail level was a 10/10, lets aim for a 8/10 detail level.
`,
  2: `
## AGGRESSIVE COMPRESSION REQUIRED

Your previous reflection was still too large after compression guidance.

Please re-process with much more aggressive compression:
- Towards the beginning, heavily condense observations into high-level summaries
- Closer to the end, retain fine details (recent context matters more)
- Memory is getting very long - use a significantly more condensed style throughout
- Combine related items aggressively but do not lose important specific details of names, places, events, and people
- For example if there is a long nested observation list about repeated tool calls, you can combine those into a single line and observe that the tool was called multiple times for x reason, and finally y outcome happened.
- Remove redundant information and merge overlapping observations

Your current detail level was a 10/10, lets aim for a 6/10 detail level.
`,
  3: `
## CRITICAL COMPRESSION REQUIRED

Your previous reflections have failed to compress sufficiently after multiple attempts.

Please re-process with maximum compression:
- Summarize the oldest observations (first 50-70%) into brief high-level paragraphs — only key facts, decisions, and outcomes
- For the most recent observations (last 30-50%), retain important details but still use a condensed style
- Ruthlessly merge related observations — if 10 observations are about the same topic, combine into 1-2 lines
- Drop procedural details (tool calls, retries, intermediate steps) — keep only final outcomes
- Drop observations that are no longer relevant or have been superseded by newer information
- Preserve: names, dates, decisions, errors, user preferences, and architectural choices

Your current detail level was a 10/10, lets aim for a 4/10 detail level.
`,
};

/**
 * Compression retry prompt - backwards compat alias for level 1
 */
export const COMPRESSION_RETRY_PROMPT = COMPRESSION_GUIDANCE[1];

/**
 * Build the prompt for the Reflector agent
 */
export function buildReflectorPrompt(
  observations: string,
  manualPrompt?: string,
  compressionLevel?: boolean | 0 | 1 | 2 | 3,
  skipContinuationHints?: boolean,
): string {
  // Normalize: boolean `true` maps to level 1 for backwards compat
  const level: 0 | 1 | 2 | 3 = typeof compressionLevel === 'number' ? compressionLevel : compressionLevel ? 1 : 0;

  let prompt = `## OBSERVATIONS TO REFLECT ON

${observations}

---

Please analyze these observations and produce a refined, condensed version that will become the assistant's entire memory going forward.`;

  if (manualPrompt) {
    prompt += `

## SPECIFIC GUIDANCE

${manualPrompt}`;
  }

  const guidance = COMPRESSION_GUIDANCE[level];
  if (guidance) {
    prompt += `

${guidance}`;
  }

  if (skipContinuationHints) {
    prompt += `\n\nIMPORTANT: Do NOT include <current-task> or <suggested-response> sections in your output. Only output <observations>.`;
  }

  return prompt;
}

/**
 * Parse the Reflector's output to extract observations, current task, and suggested response.
 * Uses XML tag parsing for structured extraction.
 */
export function parseReflectorOutput(output: string): ReflectorResult {
  // Check for degenerate repetition before parsing
  if (detectDegenerateRepetition(output)) {
    return {
      observations: '',
      degenerate: true,
    };
  }

  const parsed = parseReflectorSectionXml(output);

  // Return observations WITHOUT current-task/suggested-response tags
  // Those are stored separately in thread metadata and injected dynamically
  const observations = sanitizeObservationLines(parsed.observations || '');

  return {
    observations,
    suggestedContinuation: parsed.suggestedResponse || undefined,
    // Note: Reflector's currentTask is not used - thread metadata preserves per-thread tasks
  };
}

/**
 * Parsed result from XML reflector section
 */
interface ParsedReflectorSection {
  observations: string;
  currentTask: string;
  suggestedResponse: string;
}

/**
 * Parse XML tags from reflector output.
 * Extracts content from <observations>, <current-task>, and <suggested-response> tags.
 */
function parseReflectorSectionXml(content: string): ParsedReflectorSection {
  const result: ParsedReflectorSection = {
    observations: '',
    currentTask: '',
    suggestedResponse: '',
  };

  // Extract <observations> content (supports multiple blocks)
  // Tags must be at the start of a line (with optional leading whitespace) to avoid
  // capturing inline mentions like "User discussed <observations> tags"
  const observationsRegex = /^[ \t]*<observations>([\s\S]*?)^[ \t]*<\/observations>/gim;
  const observationsMatches = [...content.matchAll(observationsRegex)];
  if (observationsMatches.length > 0) {
    result.observations = observationsMatches
      .map(m => m[1]?.trim() ?? '')
      .filter(Boolean)
      .join('\n');
  } else {
    // Fallback: if no XML tags, try extracting list items first, then fall back to full content
    const listItems = extractReflectorListItems(content);
    result.observations = listItems || content.trim();
  }

  // Extract <current-task> content (first match only)
  const currentTaskMatch = content.match(/<current-task>([\s\S]*?)<\/current-task>/i);
  if (currentTaskMatch?.[1]) {
    result.currentTask = currentTaskMatch[1].trim();
  }

  // Extract <suggested-response> content (first match only)
  const suggestedResponseMatch = content.match(/<suggested-response>([\s\S]*?)<\/suggested-response>/i);
  if (suggestedResponseMatch?.[1]) {
    result.suggestedResponse = suggestedResponseMatch[1].trim();
  }

  return result;
}

/**
 * Fallback: Extract only list items from content when XML tags are missing.
 */
function extractReflectorListItems(content: string): string {
  const lines = content.split('\n');
  const listLines: string[] = [];

  for (const line of lines) {
    // Match lines that start with list markers (-, *, or numbered)
    if (/^\s*[-*]\s/.test(line) || /^\s*\d+\.\s/.test(line)) {
      listLines.push(line);
    }
  }

  return listLines.join('\n').trim();
}

/**
 * Validate that reflection actually compressed the observations below the target threshold
 *
 * @param reflectedTokens - Token count of reflected observations
 * @param targetThreshold - Target token count to compress below (the reflection threshold)
 * @returns true if compression was successful (reflected tokens are below target)
 */
export function validateCompression(reflectedTokens: number, targetThreshold: number): boolean {
  // Reflection should be below the target threshold
  return reflectedTokens < targetThreshold;
}
