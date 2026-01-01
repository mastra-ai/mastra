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
 * The Observer instruction that gets embedded in the Reflector prompt.
 * This helps the Reflector understand how observations were created.
 */
const OBSERVER_INSTRUCTION_FOR_REFLECTOR = `Extract observations that will help the assistant remember:

CRITICAL USER INFORMATION:
- Explicit preferences (e.g., "User wants short answers", "User prefers examples over theory")
- Current projects or context (e.g., "User is building a React app", "User is learning TypeScript")
- Communication style (e.g., "User dislikes verbose explanations", "User appreciates humor")
- Technical level (e.g., "User is familiar with JavaScript", "User is new to async programming")

CONVERSATION CONTEXT:
- What the user is working on or asking about
- Previous topics and their outcomes
- What user understands or needs clarification on
- Specific requirements or constraints mentioned
- Contents of assistant learnings and summaries
- Answers to users questions including full context to remember detailed summaries and explanations
- Relevant code snippets

ACTIONABLE INSIGHTS:
- What worked well in explanations
- What needs follow-up or clarification
- User's stated goals or next steps (note if the user tells you not to do a next step, or asks for something specific, other next steps besides the users request should be marked as "waiting for user", unless the user explicitly says to continue all next steps)

=== OUTPUT FORMAT ===

Your output MUST use XML tags to structure the response:

<observations>
Put all observations here as a markdown list:
- 🔴 [High priority: explicit preferences, critical context, goals achieved, milestones] [labels]
- 🟡 [Medium priority: project details, learned information] [labels]
- 🟢 [Low priority: minor preferences, uncertain observations] [labels]

Include dates/times when relevant:
- 🔴 **User Profile (2025-12-04):** User prefers direct answers [user_preference]
- 🟡 **Task Started (2025-12-04 14:30 PST):** User asked to implement feature X [current_project, goal]

Group related observations by indenting sub-observations:
- 🟡 Agent is working on x [task, tool_use]
  - -> 🟡 agent executed y to view z file [labels]
  - -> 🟡 (next tool observation)
- 🟡 Agent finished working on x and learned y and z [task, tool_use]
</observations>

<current-task>
State the current task(s) explicitly:
- Primary: What the agent is currently working on
- Secondary: Other pending tasks (mark as "waiting for user" if appropriate)
</current-task>

<suggested-response>
Hint for the agent's immediate next message.
</suggested-response>

=== GUIDELINES ===

- Be specific enough for the assistant to act on
- Good: "User prefers short, direct answers without lengthy explanations"
- Bad: "User stated a preference" (too vague)
- Use terse language to save tokens. Sentences should be dense without unnecessary words.
- Do not add repetitive observations that have already been observed.
- If the agent calls tools, observe what was called, why, and what was learned.
- Make sure you start each observation with a priority emoji (🔴, 🟡, 🟢)
- Observe WHAT the agent did and WHAT it means, not HOW well it did it.

Common labels to use:
- user_preference, communication_style, learning_style
- current_project, user_context, technical_level
- topic_discussed, understanding_confirmed, needs_clarification
- explicit_requirement, constraint, goal, goal_achieved, milestone
- worked_well, avoid_this, follow_up_needed, didnt_work
- tool_use, task

Remember: These observations are the assistant's ONLY memory. Make them count.`;

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
${OBSERVER_INSTRUCTION_FOR_REFLECTOR}
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

=== THREAD ATTRIBUTION (Resource Scope) ===

When observations contain <thread id="..."> sections:
- MAINTAIN thread attribution where thread-specific context matters (e.g., ongoing tasks, thread-specific preferences)
- CONSOLIDATE cross-thread facts that are stable/universal (e.g., user profile, general preferences)
- PRESERVE thread attribution for recent or context-specific observations
- When consolidating, you may merge observations from multiple threads if they represent the same universal fact

Example input:
<thread id="thread-1">
- 🔴 User prefers TypeScript
- 🟡 Working on auth feature
</thread>
<thread id="thread-2">
- 🔴 User prefers TypeScript
- 🟡 Debugging API endpoint
</thread>

Example output (consolidated):
- 🔴 User prefers TypeScript
<thread id="thread-1">
- 🟡 Working on auth feature
</thread>
<thread id="thread-2">
- 🟡 Debugging API endpoint
</thread>

=== OUTPUT FORMAT ===

Your output MUST use XML tags to structure the response:

<observations>
Put all consolidated observations here as a markdown list with priority emojis (🔴, 🟡, 🟢).
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

User messages are extremely important. If the user asks a question or gives a new task, make it clear in <current-task> that this is the priority. If the assistant needs to respond to the user, indicate in <suggested-response> that it should pause for user reply before continuing other tasks.`;

/**
 * Compression retry prompt - used when reflection doesn't reduce size
 */
export const COMPRESSION_RETRY_PROMPT = `
## COMPRESSION REQUIRED

Your previous reflection was the same size or larger than the original observations. This defeats the purpose of reflection.

Please re-process with MORE aggressive condensation:
- Towards the beginning, condense more observations into higher-level reflections
- Closer to the end, retain more fine details (recent context matters more)
- Memory is getting long - use a more condensed style throughout
- Combine related items more aggressively
- Completed work should be very brief

Target a significant reduction while preserving critical context.
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

  // Build the observations string with current-task appended
  let observations = parsed.observations || '';

  // Append current-task as XML section if present
  if (parsed.currentTask) {
    observations += `\n<current-task>\n${parsed.currentTask}\n</current-task>`;
  }

  return {
    observations,
    suggestedContinuation: parsed.suggestedResponse || undefined,
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
