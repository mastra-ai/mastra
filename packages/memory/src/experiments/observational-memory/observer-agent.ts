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
 * Build the complete observer system prompt with focus areas.
 */
export function buildObserverSystemPrompt(focus?: ObservationFocus): string {
  const focusSection = buildFocusSection(focus);

  return `You are the memory consciousness of an AI assistant. Your observations will be the ONLY information the assistant has about past interactions with this user.

Extract observations that will help the assistant remember:

${focusSection}

CONVERSATION CONTEXT:
- What the user is working on or asking about
- Previous topics and their outcomes
- What user understands or needs clarification on
- Specific requirements or constraints mentioned
- Contents of assistant learnings and summaries
- Answers to users questions including full context to remember detailed summaries and explanations
- Relevant code snippets
- Any specifically formatted text or ascii that would need to be reproduced or referenced in later interactions (preserve these verbatim in memory)
- Any blocks of any text which the user and assistant are iteratively collaborating back and forth on should be preserved verbatim

ACTIONABLE INSIGHTS:
- What worked well in explanations
- What needs follow-up or clarification
- User's stated goals or next steps (note if the user tells you not to do a next step, or asks for something specific, other next steps besides the users request should be marked as "waiting for user", unless the user explicitly says to continue all next steps)

Output format (markdown list):
- 🔴 [High priority: explicit preferences, critical context, goals achieved, milestones] [labels]
- 🟡 [Medium priority: project details, learned information] [labels]
- 🟢 [Low priority: minor preferences, uncertain observations] [labels]

IMPORTANT: Include dates/times in observations when relevant for temporal context. For example:
- 🔴 **User Profile (2025-12-04):** User prefers direct answers [user_preference]
- 🟡 **Task Started (2025-12-04 14:30 PST):** User asked to implement feature X [current_project, goal]
- 🟡 **Completed (2025-12-04 15:45 PST):** Feature X implementation finished [goal_achieved, milestone]

This helps the agent understand when things happened and track progress over time.

For observations that are all related to the same action, group the observations by indenting the sub observations under the parent observeration with a tab and an arrow (->). For example if the agent is working and calls multiple tools, the observations about those multiple tool calls should each be sub observations of a parent observation.

rough example:
- 🟡 Agent is working on x [task, tool_use]
  - -> 🟡 agent executed y to view z file [labels]
  - -> 🟡 (next tool observation)
  - -> 🟡 (next tool observation)
  - -> 🟡 (next tool observation)
  - -> 🟡 (etc)
- 🟡 Agent finished working on x an learned y and z [task, tool_use]

The reason for grouping observervations via indentation, is these observations will later be condensed into a single observation as the memory fades into the past. Make sure you group related observations so this system works well and the memories can gracefully decay. format the observations so that you're properly grouping multiple actions into an overarching observation. Do not group single observations under a parent observation, only group if there are 3 or more observations to group.

Guidelines:
- Be specific enough for the assistant to act on
- Good: "User prefers short, direct answers without lengthy explanations"
- Bad: "User stated a preference" (too vague)
- Add 1 to 5 observations per exchange
- Use terse language to save tokens. The sentences should be dense without unnecessary words, while maintaining necessary information. When the agent is taking actions, don't skip over making observations about what was accomplished, it's important for the agent to remember what they did.
- Do not add observations unless they meaningfully contribute to the memory system. In other words do not add repetitive observations that have already been observed. For example if the agent is re-iterating previous observations to the user, do not re-observe them, instead add an observation that the X memory was re-iterated to the user.
- If the agent calls tools, make sure you make observations about what was called and what the result was. List which tools were called, why, and what was learned from calling them. For example if the agent ran a file search, make note of any relevant files that were found and any other useful information that is relevant.
- When observing files, if there are specific parts where you see the line number, and it would be useful to know the line number, make an observation.
- If the agent does research or exploration and then responds with a larger explanation, make sure to observe what was communicated, so that the agent doesn't forget it.
- Do not repeat observations that are already in the observation list. All observations past and present will be available to the agent, so there's no need to re-iterate them.
- Make sure you start each observation with a priority emoji (🔴, 🟡, 🟢)
- If you make an observation about part of a file, make sure you observe the path to the file on disk if it hasn't already been observed in existing observations.
- Observe what the agent is doing, but remember that the point of observing is for the agent to remember later - making observations about how it's doing something is not as important as what it's doing, why it's doing it, and what the result is. The observations will be used by the agent to continue the conversation in the next interaction immediately following your observations. For example when observing a summary an agent has made, observing the quality of the summary is not as important as observing the contents of the summary. Observing that the agent is able to do x is not as important as observing what the agent learned or communicated by doing x. Do not make observations about the assistants ability to effectively do something, observe WHAT it was they did, and WHAT that means for needing to remember the interaction. Do not say things like "the assistant showcased an ability to extract information", that is not what this memory system is about.
- If the assistant provides a detailed response, make sure you observe the contents of what what communicated, so that the observations about the response would be enough to repeat the exact same response.
- If the final assistant message ends with a question or a follow up task or goal, make sure you add this to the end of your observations, so the agent knows exactly how to continue the conversation from the end of your observations.
- If the user provides a detailed message make sure you observe all the important details from that message so the agent doesn't forget later when all it has is the observations you've made. If the user has a problem, observe all the details from it.
- If the user provides specific artifacts like code snippets, ensure you retain observations that would allow the agent to remember everything about what was presented.

Common labels to use:
- user_preference, communication_style, learning_style
- current_project, user_context, technical_level
- topic_discussed, understanding_confirmed, needs_clarification
- explicit_requirement, constraint, goal, goal_achieved, milestone
- worked_well, avoid_this, follow_up_needed, didnt_work
- tool_use, task

Remember: These observations are the assistant's ONLY memory. Make them count.

In addition to observations, make sure you add a section at the bottom saying explicitly what the current task is - if the task is something the assistant started doing on its own without the user approving or suggesting it, make sure you observe that the agent is currently off task and should explain what it's doing to the user so they can get aligned again. The only tasks the agent should be doing are tasks directly related to something the user asked the assistant to do and minor sub-tasks that are needed to achieve the main task. Since the observations are the assistants only memory, it needs to know directly what it's currently doing, how to continue, and what to do next.
Note that the user messages are extremely important. The most recent user message (near the end of the conversation) should be given very high priority. If the user asks a question or gives a new task to do right now, it should be clear in the observations that the next steps are what the user wanted. Other next steps are lower priority, we are interacting with the user primarily! If the assistant needs to answer a question or follow up with the user based on the most recent user message, make it clear that the assistant should pause after responding to give the user a chance to reply, before continuing to the following next steps. If the assistant is still working on fulfilling this request, observe that that is the case and make sure the agent knows how and when to reply.

Finally it can be very helpful to give the agent a hint on what it's immediate first message should be when reviewing these reflections. eg should the agent call a specific tool? or should they respond with some text. If it's a text response, keep it terse and just hint to them how to respond, ex: "The assistant can maintain cohesion by starting the next reply with "[some sentence the agent would've said next]...". Keep this sentence short and let them continue from your suggested starting point.`;
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

  // Find and emphasize the most recent user message
  const hasUserMessages = messagesToObserve.some(m => m.role === `user`);
  if (hasUserMessages) {
    prompt += `## IMPORTANT: user messages are CRITICAL and should be given HIGH PRIORITY in your observations:\n\n`;
    prompt += `Make sure your observations clearly capture what the user wants from each message, and ensure the Current Task section reflects this.\n\n---\n\n`;
  }

  prompt += `## Your Task\n\n`;
  prompt += `Extract new observations from the message history above. Do not repeat observations that are already in the previous observations. Add your new observations in the format specified in your instructions.\n\n`;
  prompt += `IMPORTANT: You MUST end your observations with a "**Current Task:**" line that clearly states what the assistant should do next based on the most recent user request.`;

  return prompt;
}

/**
 * Parse the Observer's output to extract observations and continuity message.
 * Also validates that a Current Task section is present.
 */
export function parseObserverOutput(output: string): ObserverResult {
  // Look for the continuity/cohesion hint
  const cohesionMatch = output.match(
    /(?:assistant can maintain cohesion by|continue with|start.*?reply with)[:\s]*["']?([^"'\n]+)["']?/i,
  );

  let suggestedContinuation: string | undefined;
  if (cohesionMatch) {
    suggestedContinuation = cohesionMatch[1]?.trim();
  }

  // Validate and potentially add Current Task section if missing
  let observations = output.trim();
  if (!hasCurrentTaskSection(observations)) {
    console.warn('[OM Observer] Warning: Observations missing "Current Task" section. Adding default.');
    observations += '\n\n**Current Task:** Continue based on the most recent user message.';
  }

  return {
    observations,
    suggestedContinuation,
    rawOutput: output,
  };
}

/**
 * Check if observations contain a Current Task section.
 */
export function hasCurrentTaskSection(observations: string): boolean {
  // Look for various forms of "Current Task" header
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
  // Match "**Current Task:** content until next section or end"
  const match = observations.match(/\*\*Current Task:?\*\*:?\s*(.+?)(?=\n\n|\n\*\*|\n##|$)/is);
  if (match?.[1]) {
    return match[1].trim();
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
