import type { MastraDBMessage } from '@mastra/core/agent';
import type { ObservationFocus, ObservationFocusType } from './types';

/**
 * Focus area descriptions for the observer prompt.
 * Maps focus types to their prompt instructions.
 */
const FOCUS_AREA_DESCRIPTIONS: Record<string, string> = {
  'personal-facts': `PERSONAL/BIOGRAPHICAL FACTS (HIGH PRIORITY):
- Education: degrees, schools, majors, graduation dates
- Work history: jobs, companies, roles, career changes
- Personal identity: name, age, location, nationality
- Family: spouse, children, parents, siblings mentioned
- Life events: moves, marriages, milestones
- Any "I am...", "I have...", "I graduated...", "I work at..." statements
- Capture these EXACTLY as stated - they are critical for recall`,

  preferences: `USER PREFERENCES:
- Explicit preferences (e.g., "I prefer short answers", "I like examples")
- Communication style (e.g., "User dislikes verbose explanations")
- Tool/technology preferences
- Format preferences (bullet points, code examples, etc.)`,

  tasks: `CURRENT TASKS & PROJECTS:
- What the user is working on
- Goals and objectives stated
- Progress and milestones
- Next steps mentioned
- Blockers or challenges`,

  technical: `TECHNICAL CONTEXT:
- Programming languages and frameworks used
- Technical level and expertise
- Code snippets and implementations
- Architecture decisions
- Technical requirements and constraints`,

  temporal: `TEMPORAL INFORMATION:
- Specific dates mentioned (deadlines, events, appointments)
- Schedules and routines
- Time-sensitive information
- "Yesterday", "last week", "next month" references with context`,

  relationships: `RELATIONSHIPS & PEOPLE:
- Names of people mentioned (colleagues, friends, family)
- Relationships between people
- Organizations and teams
- Contact information if shared`,

  health: `HEALTH & WELLNESS:
- Health conditions mentioned
- Medications or treatments
- Fitness goals and activities
- Dietary preferences or restrictions`,

  financial: `FINANCIAL INFORMATION:
- Budget constraints mentioned
- Financial goals
- Purchases or expenses discussed
- Financial preferences`,

  location: `LOCATION & TRAVEL:
- Current location/residence
- Places mentioned
- Travel plans or history
- Geographic preferences`,
};

/**
 * Build the focus areas section of the prompt based on configuration.
 */
function buildFocusSection(focus?: ObservationFocus): string {
  // Default focus areas if none specified
  const defaultFocus: ObservationFocusType[] = ['preferences', 'tasks', 'technical'];
  const includedTypes = focus?.include ?? defaultFocus;
  const excludedTypes = focus?.exclude ?? [];

  const sections: string[] = [];

  for (const focusType of includedTypes) {
    // Skip if excluded
    if (typeof focusType === 'string' && excludedTypes.includes(focusType)) {
      continue;
    }

    if (typeof focusType === 'string') {
      const description = FOCUS_AREA_DESCRIPTIONS[focusType];
      if (description) {
        sections.push(description);
      }
    } else if (focusType.custom) {
      // Custom focus area
      sections.push(`CUSTOM FOCUS:\n${focusType.custom}`);
    }
  }

  return sections.join('\n\n');
}

/**
 * The core extraction instructions for the Observer.
 * This is exported so the Reflector can understand how observations were created.
 */
export const OBSERVER_EXTRACTION_INSTRUCTIONS = `CRITICAL: DISTINGUISH USER ASSERTIONS FROM QUESTIONS

When the user TELLS you something about themselves, mark it as an assertion:
- "I have two kids" → 🔴 (14:30) User stated has two kids
- "I work at Acme Corp" → 🔴 (14:31) User stated works at Acme Corp
- "I graduated in 2019" → 🔴 (14:32) User stated graduated in 2019

When the user ASKS about something, mark it as a question/request:
- "Can you help me with X?" → 🟡 (15:00) User asked help with X
- "What's the best way to do Y?" → 🟡 (15:01) User asked best way to do Y

USER ASSERTIONS ARE AUTHORITATIVE. The user is the source of truth about their own life.
If a user previously stated something and later asks a question about the same topic,
the assertion is the answer - the question doesn't invalidate what they already told you.

CONVERSATION CONTEXT:
- What the user is working on or asking about
- Previous topics and their outcomes
- What user understands or needs clarification on
- Specific requirements or constraints mentioned
- Contents of assistant learnings and summaries
- Answers to users questions including full context to remember detailed summaries and explanations
- Assistant explanations, especially complex ones. observe the fine details so that the assistant does not forget what they explained
- Relevant code snippets
- User preferences (like favourites, dislikes, preferences, etc)
- Any specifically formatted text or ascii that would need to be reproduced or referenced in later interactions (preserve these verbatim in memory)
- Any blocks of any text which the user and assistant are iteratively collaborating back and forth on should be preserved verbatim
- When who/what/where/when is mentioned, note that in the observation. Example: if the user received went on a trip with someone, observe who that someone was, where the trip was, when it happened, and what happened, not just that the user went on the trip.

ACTIONABLE INSIGHTS:
- What worked well in explanations
- What needs follow-up or clarification
- User's stated goals or next steps (note if the user tells you not to do a next step, or asks for something specific, other next steps besides the users request should be marked as "waiting for user", unless the user explicitly says to continue all next steps)`;

/**
 * The output format instructions for the Observer.
 * This is exported so the Reflector can use the same format.
 */
export const OBSERVER_OUTPUT_FORMAT = `Use priority levels:
- 🔴 High: explicit user facts, preferences, goals achieved, critical context
- 🟡 Medium: project details, learned information, tool results
- 🟢 Low: minor details, uncertain observations

Group related observations (like tool sequences) by indenting:
* 🟡 (14:33) Agent debugging auth issue
  * -> ran git status, found 3 modified files
  * -> viewed auth.ts:45-60, found missing null check
  * -> applied fix, tests now pass

Group observations by date, then list each with 24-hour time.

<observations>
Date: Dec 4, 2025
* 🔴 (14:30) User prefers direct answers
* 🟡 (14:31) Working on feature X
* 🟢 (14:32) User might prefer dark mode

Date: Dec 5, 2025
* 🟡 (09:15) Continued work on feature X
</observations>

<current-task>
State the current task(s) explicitly. Can be single or multiple:
- Primary: What the agent is currently working on
- Secondary: Other pending tasks (mark as "waiting for user" if appropriate)

If the agent started doing something without user approval, note that it's off-task.
</current-task>

<suggested-response>
Hint for the agent's immediate next message. Examples:
- "I've updated the navigation model. Let me walk you through the changes..."
- "The assistant should wait for the user to respond before continuing."
- Call the view tool on src/example.ts to continue debugging.
</suggested-response>`;

/**
 * The guidelines for the Observer.
 * This is exported so the Reflector can reference them.
 */
export const OBSERVER_GUIDELINES = `- Be specific enough for the assistant to act on
- Good: "User prefers short, direct answers without lengthy explanations"
- Bad: "User stated a preference" (too vague)
- Add 1 to 5 observations per exchange
- Use terse language to save tokens. Sentences should be dense without unnecessary words.
- Do not add repetitive observations that have already been observed.
- If the agent calls tools, observe what was called, why, and what was learned.
- When observing files with line numbers, include the line number if useful.
- If the agent provides a detailed response, observe the contents so it could be repeated.
- Make sure you start each observation with a priority emoji (🔴, 🟡, 🟢)
- Observe WHAT the agent did and WHAT it means, not HOW well it did it.
- If the user provides detailed messages or code snippets, observe all important details.`;

/**
 * Build the complete observer system prompt with focus areas.
 */
export function buildObserverSystemPrompt(_focus?: ObservationFocus): string {
  // const focusSection = buildFocusSection(focus);

  return `You are the memory consciousness of an AI assistant. Your observations will be the ONLY information the assistant has about past interactions with this user.

Extract observations that will help the assistant remember:

${OBSERVER_EXTRACTION_INSTRUCTIONS}

=== OUTPUT FORMAT ===

Your output MUST use XML tags to structure the response. This allows the system to properly parse and manage memory over time.

${OBSERVER_OUTPUT_FORMAT}

=== GUIDELINES ===

${OBSERVER_GUIDELINES}

=== IMPORTANT: THREAD ATTRIBUTION ===

Do NOT add thread identifiers, thread IDs, or <thread> tags to your observations.
Thread attribution is handled externally by the system.
Simply output your observations without any thread-related markup.

Remember: These observations are the assistant's ONLY memory. Make them count.

User messages are extremely important. If the user asks a question or gives a new task, make it clear in <current-task> that this is the priority. If the assistant needs to respond to the user, indicate in <suggested-response> that it should pause for user reply before continuing other tasks.`;
}

/**
 * Observer Agent System Prompt (default - for backwards compatibility)
 *
 * This prompt instructs the Observer to extract observations from message history.
 * The observations become the agent's "subconscious memory" - the ONLY information
 * the main agent will have about past interactions.
 */
export const OBSERVER_SYSTEM_PROMPT = buildObserverSystemPrompt();

/**
 * Result from the Observer agent
 */
export interface ObserverResult {
  /** The extracted observations in markdown format */
  observations: string;

  /** The current task extracted from observations (for thread metadata) */
  currentTask?: string;

  /** Suggested continuation message for the Actor */
  suggestedContinuation?: string;

  /** Raw output from the model (for debugging) */
  rawOutput?: string;
}

/**
 * Format messages for the Observer's input.
 * Includes timestamps for temporal context.
 */
export function formatMessagesForObserver(messages: MastraDBMessage[]): string {
  return messages
    .map(msg => {
      const timestamp = msg.createdAt
        ? new Date(msg.createdAt).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          })
        : '';

      const role = msg.role.charAt(0).toUpperCase() + msg.role.slice(1);
      const timestampStr = timestamp ? ` (${timestamp})` : '';

      // Extract text content from the message
      let content = '';
      if (typeof msg.content === 'string') {
        content = msg.content;
      } else if (msg.content?.content) {
        content = msg.content.content;
      } else if (msg.content?.parts) {
        content = msg.content.parts
          .map(part => {
            if (part.type === 'text') return part.text;
            if (part.type === 'tool-invocation') {
              const inv = part.toolInvocation;
              if (inv.state === 'result') {
                return `[Tool Result: ${inv.toolName}]\n${JSON.stringify(inv.result, null, 2)}`;
              }
              return `[Tool Call: ${inv.toolName}]\n${JSON.stringify(inv.args, null, 2)}`;
            }
            return '';
          })
          .filter(Boolean)
          .join('\n');
      }

      return `**${role}${timestampStr}:**\n${content}`;
    })
    .join('\n\n---\n\n');
}

/**
 * Build the full prompt for the Observer agent.
 * Includes emphasis on the most recent user message for priority handling.
 */
export function buildObserverPrompt(
  existingObservations: string | undefined,
  messagesToObserve: MastraDBMessage[],
): string {
  const formattedMessages = formatMessagesForObserver(messagesToObserve);

  let prompt = '';

  if (existingObservations) {
    prompt += `## Previous Observations\n\n${existingObservations}\n\n---\n\n`;
    prompt +=
      'Do not repeat these existing observations. Your new observations will be appended to the existing observations.\n\n';
  }

  prompt += `## New Message History to Observe\n\n${formattedMessages}\n\n---\n\n`;

  prompt += `## Your Task\n\n`;
  prompt += `Extract new observations from the message history above. Do not repeat observations that are already in the previous observations. Add your new observations in the format specified in your instructions.`;

  return prompt;
}

/**
 * Parse the Observer's output to extract observations, current task, and suggested response.
 * Uses XML tag parsing for structured extraction.
 */
export function parseObserverOutput(output: string): ObserverResult {
  const parsed = parseMemorySectionXml(output);

  // Return observations WITHOUT current-task/suggested-response tags
  // Those are stored separately in thread metadata and injected dynamically
  const observations = parsed.observations || '';

  if (!parsed.currentTask) {
    console.warn('[OM Observer] Warning: Observations missing <current-task> section.');
  }

  return {
    observations,
    currentTask: parsed.currentTask || undefined,
    suggestedContinuation: parsed.suggestedResponse || undefined,
    rawOutput: output,
  };
}

/**
 * Parsed result from XML memory section
 */
interface ParsedMemorySection {
  observations: string;
  currentTask: string;
  suggestedResponse: string;
}

/**
 * Parse XML tags from observer/reflector output.
 * Extracts content from <observations>, <current-task>, and <suggested-response> tags.
 */
export function parseMemorySectionXml(content: string): ParsedMemorySection {
  const result: ParsedMemorySection = {
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
    // Fallback: if no XML tags, extract list items from raw content
    // This handles cases where the LLM doesn't follow the XML format exactly
    result.observations = extractListItemsOnly(content);
  }

  // Extract <current-task> content (first match only)
  // Tags must be at the start of a line to avoid capturing inline mentions
  const currentTaskMatch = content.match(/^[ \t]*<current-task>([\s\S]*?)^[ \t]*<\/current-task>/im);
  if (currentTaskMatch?.[1]) {
    result.currentTask = currentTaskMatch[1].trim();
  }

  // Extract <suggested-response> content (first match only)
  // Tags must be at the start of a line to avoid capturing inline mentions
  const suggestedResponseMatch = content.match(/^[ \t]*<suggested-response>([\s\S]*?)^[ \t]*<\/suggested-response>/im);
  if (suggestedResponseMatch?.[1]) {
    result.suggestedResponse = suggestedResponseMatch[1].trim();
  }

  return result;
}

/**
 * Fallback: Extract only list items from content when XML tags are missing.
 * Preserves nested list items (indented with spaces/tabs).
 */
function extractListItemsOnly(content: string): string {
  const lines = content.split('\n');
  const listLines: string[] = [];

  for (const line of lines) {
    // Match lines that start with list markers (-, *, or numbered)
    // Allow leading whitespace for nested items
    if (/^\s*[-*]\s/.test(line) || /^\s*\d+\.\s/.test(line)) {
      listLines.push(line);
    }
  }

  return listLines.join('\n').trim();
}

/**
 * Check if observations contain a Current Task section.
 * Supports both XML format and legacy markdown format.
 */
export function hasCurrentTaskSection(observations: string): boolean {
  // Check for XML format first
  if (/<current-task>/i.test(observations)) {
    return true;
  }

  // Legacy markdown patterns
  const currentTaskPatterns = [
    /\*\*Current Task:?\*\*/i,
    /^Current Task:/im,
    /\*\*Current Task\*\*:/i,
    /## Current Task/i,
  ];

  return currentTaskPatterns.some(pattern => pattern.test(observations));
}

/**
 * Extract the Current Task content from observations.
 */
export function extractCurrentTask(observations: string): string | null {
  const xmlMatch = observations.match(/<current-task>([\s\S]*?)<\/current-task>/i);
  if (xmlMatch?.[1]) {
    return xmlMatch[1].trim();
  }
  return null;
}

/**
 * Optimize observations for token efficiency before presenting to the Actor.
 *
 * This removes:
 * - Non-critical emojis (🟡 and 🟢, keeping only 🔴)
 * - Semantic tags [label, label]
 * - Arrow indicators (->)
 * - Extra whitespace
 *
 * The full format is preserved in storage for analysis.
 */
export function optimizeObservationsForContext(observations: string): string {
  let optimized = observations;

  // Remove 🟡 and 🟢 emojis (keep 🔴 for critical items)
  optimized = optimized.replace(/🟡\s*/g, '');
  optimized = optimized.replace(/🟢\s*/g, '');

  // Remove semantic tags like [label, label] but keep collapsed markers like [72 items collapsed - ID: b1fa]
  optimized = optimized.replace(/\[(?![\d\s]*items collapsed)[^\]]+\]/g, '');

  // Remove arrow indicators
  optimized = optimized.replace(/\s*->\s*/g, ' ');

  // Clean up multiple spaces
  optimized = optimized.replace(/  +/g, ' ');

  // Clean up multiple newlines
  optimized = optimized.replace(/\n{3,}/g, '\n\n');

  return optimized.trim();
}
