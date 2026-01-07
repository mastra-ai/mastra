import {
  OBSERVER_EXTRACTION_INSTRUCTIONS,
  OBSERVER_OUTPUT_FORMAT,
  OBSERVER_GUIDELINES,
  PATTERN_INSTRUCTIONS,
} from './observer-agent';

/**
 * Result from parsing Reflector output
 */
export interface ReflectorResult {
  /** The refined observations */
  observations: string;
  /** Optional suggested continuation for the Actor */
  suggestedContinuation?: string;
  /** Token count of output (for compression validation) */
  tokenCount?: number;
}

/**
 * The Reflector's system prompt.
 *
 * The Reflector handles meta-observation - when observations grow too large,
 * it reorganizes them into something more manageable by:
 * - Re-organizing and streamlining observations
 * - Drawing connections and conclusions between observations
 * - Identifying if the agent got off track and how to get back on track
 * - Preserving ALL important information (reflections become the ENTIRE memory)
 */
export const REFLECTOR_SYSTEM_PROMPT = `You are the memory consciousness of an AI assistant. Your memory observation reflections will be the ONLY information the assistant has about past interactions with this user.

The following instructions were given to another part of your psyche (the observer) to create memories.
Use this to understand how your observational memories were created.

<observational-memory-instruction>
${OBSERVER_EXTRACTION_INSTRUCTIONS}

=== OUTPUT FORMAT ===

${OBSERVER_OUTPUT_FORMAT}

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

<patterns>
Consolidate and update patterns from the input.
${PATTERN_INSTRUCTIONS}
</patterns>

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

User messages are extremely important. If the user asks a question or gives a new task, make it clear in <current-task> that this is the priority. If the assistant needs to respond to the user, indicate in <suggested-response> that it should pause for user reply before continuing other tasks.`;

/**
 * Compression retry prompt - used when reflection doesn't reduce size
 */
export const COMPRESSION_RETRY_PROMPT = `
## COMPRESSION REQUIRED

Your previous reflection was the same size or larger than the original observations.

Please re-process with slightly more compression:
- Towards the beginning, condense more observations into higher-level reflections
- Closer to the end, retain more fine details (recent context matters more)
- Memory is getting long - use a more condensed style throughout
- Combine related items more aggressively but do not lose important specific details of names, places, events, and people
- For example if there is a long nested observation list about repeated tool calls, you can combine those into a single line and observe that the tool was called multiple times for x reason, and finally y outcome happened.

Your current detail level was a 10/10, lets aim for a 8/10 detail level.
`;

/**
 * Build the prompt for the Reflector agent
 */
export function buildReflectorPrompt(observations: string, manualPrompt?: string, compressionRetry?: boolean): string {
  let prompt = `## OBSERVATIONS TO REFLECT ON

${observations}

---

Please analyze these observations and produce a refined, condensed version that will become the assistant's entire memory going forward.`;

  if (manualPrompt) {
    prompt += `

## SPECIFIC GUIDANCE

${manualPrompt}`;
  }

  if (compressionRetry) {
    prompt += `

${COMPRESSION_RETRY_PROMPT}`;
  }

  return prompt;
}

/**
 * Parse the Reflector's output to extract observations, current task, and suggested response.
 * Uses XML tag parsing for structured extraction.
 */
export function parseReflectorOutput(output: string): ReflectorResult {
  const parsed = parseReflectorSectionXml(output);

  // Return observations WITHOUT current-task/suggested-response tags
  // Those are stored separately in thread metadata and injected dynamically
  const observations = parsed.observations || '';

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
    // Fallback: if no XML tags, treat entire output as observations (legacy support)
    result.observations = extractReflectorListItems(content);
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
 * Validate that reflection actually compressed the observations
 *
 * @param originalTokens - Token count of original observations
 * @param reflectedTokens - Token count of reflected observations
 * @param threshold - Minimum compression ratio (default: 0.9 = must be at least 10% smaller)
 * @returns true if compression was successful
 */
export function validateCompression(originalTokens: number, reflectedTokens: number, threshold: number = 0.9): boolean {
  // Reflection should be smaller than original
  return reflectedTokens < originalTokens * threshold;
}
