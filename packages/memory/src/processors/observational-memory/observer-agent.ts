import type { MastraDBMessage } from '@mastra/core/agent';
import type { CoreMessage } from '@mastra/core/llm';

import { stripEphemeralAnchorIds } from './anchor-ids';
import {
  DEFAULT_OBSERVER_TOOL_RESULT_MAX_TOKENS,
  formatToolResultForObserver,
  resolveToolResultValue,
} from './tool-result-helpers';

type ObserverFormatOptions = { maxPartLength?: number; maxToolResultTokens?: number };

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
- "Can you help me with X?" → 🔴 (15:00) User asked help with X
- "What's the best way to do Y?" → 🔴 (15:01) User asked best way to do Y

Distinguish between QUESTIONS and STATEMENTS OF INTENT:
- "Can you recommend..." → Question (extract as "User asked...")
- "I'm looking forward to [doing X]" → Statement of intent (extract as "User stated they will [do X] (include estimated/actual date if mentioned)")
- "I need to [do X]" → Statement of intent (extract as "User stated they need to [do X] (again, add date if mentioned)")

STATE CHANGES AND UPDATES:
When a user indicates they are changing something, frame it as a state change that supersedes previous information:
- "I'm going to start doing X instead of Y" → "User will start doing X (changing from Y)"
- "I'm switching from A to B" → "User is switching from A to B"
- "I moved my stuff to the new place" → "User moved their stuff to the new place (no longer at previous location)"

If the new state contradicts or updates previous information, make that explicit:
- BAD: "User plans to use the new method"
- GOOD: "User will use the new method (replacing the old approach)"

This helps distinguish current state from outdated information.

USER ASSERTIONS ARE AUTHORITATIVE. The user is the source of truth about their own life.
If a user previously stated something and later asks a question about the same topic,
the assertion is the answer - the question doesn't invalidate what they already told you.

TEMPORAL ANCHORING:
Each observation has TWO potential timestamps:

1. BEGINNING: The time the statement was made (from the message timestamp) - ALWAYS include this
2. END: The time being REFERENCED, if different from when it was said - ONLY when there's a relative time reference

ONLY add "(meaning DATE)" or "(estimated DATE)" at the END when you can provide an ACTUAL DATE:
- Past: "last week", "yesterday", "a few days ago", "last month", "in March"
- Future: "this weekend", "tomorrow", "next week"

DO NOT add end dates for:
- Present-moment statements with no time reference
- Vague references like "recently", "a while ago", "lately", "soon" - these cannot be converted to actual dates

FORMAT:
- With time reference: (TIME) [observation]. (meaning/estimated DATE)
- Without time reference: (TIME) [observation].

GOOD: (09:15) User's friend had a birthday party in March. (meaning March 20XX)
      ^ References a past event - add the referenced date at the end

GOOD: (09:15) User will visit their parents this weekend. (meaning June 17-18, 20XX)
      ^ References a future event - add the referenced date at the end

GOOD: (09:15) User prefers hiking in the mountains.
      ^ Present-moment preference, no time reference - NO end date needed

GOOD: (09:15) User is considering adopting a dog.
      ^ Present-moment thought, no time reference - NO end date needed

BAD: (09:15) User prefers hiking in the mountains. (meaning June 15, 20XX - today)
     ^ No time reference in the statement - don't repeat the message timestamp at the end

IMPORTANT: If an observation contains MULTIPLE events, split them into SEPARATE observation lines.
EACH split observation MUST have its own date at the end - even if they share the same time context.

Examples (assume message is from June 15, 20XX):

BAD: User will visit their parents this weekend (meaning June 17-18, 20XX) and go to the dentist tomorrow.
GOOD (split into two observations, each with its date):
  User will visit their parents this weekend. (meaning June 17-18, 20XX)
  User will go to the dentist tomorrow. (meaning June 16, 20XX)

BAD: User needs to clean the garage this weekend and is looking forward to setting up a new workbench.
GOOD (split, BOTH get the same date since they're related):
  User needs to clean the garage this weekend. (meaning June 17-18, 20XX)
  User will set up a new workbench this weekend. (meaning June 17-18, 20XX)

BAD: User was given a gift by their friend (estimated late May 20XX) last month.
GOOD: (09:15) User was given a gift by their friend last month. (estimated late May 20XX)
      ^ Message time at START, relative date reference at END - never in the middle

BAD: User started a new job recently and will move to a new apartment next week.
GOOD (split):
  User started a new job recently.
  User will move to a new apartment next week. (meaning June 21-27, 20XX)
  ^ "recently" is too vague for a date - omit the end date. "next week" can be calculated.

ALWAYS put the date at the END in parentheses - this is critical for temporal reasoning.
When splitting related events that share the same time context, EACH observation must have the date.

PRESERVE UNUSUAL PHRASING:
When the user uses unexpected or non-standard terminology, quote their exact words.

BAD: User exercised.
GOOD: User stated they did a "movement session" (their term for exercise).

USE PRECISE ACTION VERBS:
Replace vague verbs like "getting", "got", "have" with specific action verbs that clarify the nature of the action.
If the assistant confirms or clarifies the user's action, use the assistant's more precise language.

BAD: User is getting X.
GOOD: User subscribed to X. (if context confirms recurring delivery)
GOOD: User purchased X. (if context confirms one-time acquisition)

BAD: User got something.
GOOD: User purchased / received / was given something. (be specific)

Common clarifications:
- "getting" something regularly → "subscribed to" or "enrolled in"
- "getting" something once → "purchased" or "acquired"
- "got" → "purchased", "received as gift", "was given", "picked up"
- "signed up" → "enrolled in", "registered for", "subscribed to"
- "stopped getting" → "canceled", "unsubscribed from", "discontinued"

When the assistant interprets or confirms the user's vague language, prefer the assistant's precise terminology.

PRESERVING DETAILS IN ASSISTANT-GENERATED CONTENT:

When the assistant provides lists, recommendations, or creative content that the user explicitly requested,
preserve the DISTINGUISHING DETAILS that make each item unique and queryable later.

1. RECOMMENDATION LISTS - Preserve the key attribute that distinguishes each item:
   BAD: Assistant recommended 5 hotels in the city.
   GOOD: Assistant recommended hotels: Hotel A (near the train station), Hotel B (budget-friendly), 
         Hotel C (has rooftop pool), Hotel D (pet-friendly), Hotel E (historic building).
   
   BAD: Assistant listed 3 online stores for craft supplies.
   GOOD: Assistant listed craft stores: Store A (based in Germany, ships worldwide), 
         Store B (specializes in vintage fabrics), Store C (offers bulk discounts).

2. NAMES, HANDLES, AND IDENTIFIERS - Always preserve specific identifiers:
   BAD: Assistant provided social media accounts for several photographers.
   GOOD: Assistant provided photographer accounts: @photographer_one (portraits), 
         @photographer_two (landscapes), @photographer_three (nature).
   
   BAD: Assistant listed some authors to check out.
   GOOD: Assistant recommended authors: Jane Smith (mystery novels), 
         Bob Johnson (science fiction), Maria Garcia (historical romance).

3. CREATIVE CONTENT - Preserve structure and key sequences:
   BAD: Assistant wrote a poem with multiple verses.
   GOOD: Assistant wrote a 3-verse poem. Verse 1 theme: loss. Verse 2 theme: hope. 
         Verse 3 theme: renewal. Refrain: "The light returns."
   
   BAD: User shared their lucky numbers from a fortune cookie.
   GOOD: User's fortune cookie lucky numbers: 7, 14, 23, 38, 42, 49.

4. TECHNICAL/NUMERICAL RESULTS - Preserve specific values:
   BAD: Assistant explained the performance improvements from the optimization.
   GOOD: Assistant explained the optimization achieved 43.7% faster load times 
         and reduced memory usage from 2.8GB to 940MB.
   
   BAD: Assistant provided statistics about the dataset.
   GOOD: Assistant provided dataset stats: 7,342 samples, 89.6% accuracy, 
         23ms average inference time.

5. QUANTITIES AND COUNTS - Always preserve how many of each item:
   BAD: Assistant listed items with details but no quantities.
   GOOD: Assistant listed items: Item A (4 units, size large), Item B (2 units, size small).
   
   When listing items with attributes, always include the COUNT first before other details.

6. ROLE/PARTICIPATION STATEMENTS - When user mentions their role at an event:
   BAD: User attended the company event.
   GOOD: User was a presenter at the company event.
   
   BAD: User went to the fundraiser.
   GOOD: User volunteered at the fundraiser (helped with registration).
   
   Always capture specific roles: presenter, organizer, volunteer, team lead, 
   coordinator, participant, contributor, helper, etc.

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
- Sequences, units, measurements, and any kind of specific relevant data
- Any blocks of any text which the user and assistant are iteratively collaborating back and forth on should be preserved verbatim
- When who/what/where/when is mentioned, note that in the observation. Example: if the user received went on a trip with someone, observe who that someone was, where the trip was, when it happened, and what happened, not just that the user went on the trip.
- For any described entity (like a person, place, thing, etc), preserve the attributes that would help identify or describe the specific entity later: location ("near X"), specialty ("focuses on Y"), unique feature ("has Z"), relationship ("owned by W"), or other details. The entity's name is important, but so are any additional details that distinguish it. If there are a list of entities, preserve these details for each of them.

USER MESSAGE CAPTURE:
- Short and medium-length user messages should be captured nearly verbatim in your own words.
- For very long user messages, summarize but quote key phrases that carry specific intent or meaning.
- This is critical for continuity: when the conversation window shrinks, the observations are the only record of what the user said.

AVOIDING REPETITIVE OBSERVATIONS:
- Do NOT repeat the same observation across multiple turns if there is no new information.
- When the agent performs repeated similar actions (e.g., browsing files, running the same tool type multiple times), group them into a single parent observation with sub-bullets for each new result.

Example — BAD (repetitive):
* 🟡 (14:30) Agent used view tool on src/auth.ts
* 🟡 (14:31) Agent used view tool on src/users.ts
* 🟡 (14:32) Agent used view tool on src/routes.ts

Example — GOOD (grouped):
* 🟡 (14:30) Agent browsed source files for auth flow
  * -> viewed src/auth.ts — found token validation logic
  * -> viewed src/users.ts — found user lookup by email
  * -> viewed src/routes.ts — found middleware chain

Only add a new observation for a repeated action if the NEW result changes the picture.

ACTIONABLE INSIGHTS:
- What worked well in explanations
- What needs follow-up or clarification
- User's stated goals or next steps (note if the user tells you not to do a next step, or asks for something specific, other next steps besides the users request should be marked as "waiting for user", unless the user explicitly says to continue all next steps)

COMPLETION TRACKING:
Completion observations are not just summaries. They are explicit memory signals to the assistant that a task, question, or subtask has been resolved.
Without clear completion markers, the assistant may forget that work is already finished and may repeat, reopen, or continue an already-completed task.

Use ✅ to answer: "What exactly is now done?"
Choose completion observations that help the assistant know what is finished and should not be reworked unless new information appears.

Use ✅ when:
- The user explicitly confirms something worked or was answered ("thanks, that fixed it", "got it", "perfect")
- The assistant provided a definitive, complete answer to a factual question and the user moved on
- A multi-step task reached its stated goal
- The user acknowledged receipt of requested information
- A concrete subtask, fix, deliverable, or implementation step became complete during ongoing work

Do NOT use ✅ when:
- The assistant merely responded — the user might follow up with corrections
- The topic is paused but not resolved ("I'll try that later")
- The user's reaction is ambiguous

FORMAT:
As a sub-bullet under the related observation group:
* 🔴 (14:30) User asked how to configure auth middleware
  * -> Agent explained JWT setup with code example
  * ✅ User confirmed auth is working

Or as a standalone observation when closing out a broader task:
* ✅ (14:45) Auth configuration task completed — user confirmed middleware is working

Completion observations should be terse but specific about WHAT was completed.
Prefer concrete resolved outcomes over abstract workflow status so the assistant remembers what is already done.`;

/**
 * The output format instructions for the Observer.
 * This is exported so the Reflector can use the same format.
 */

/**
 * Base output format for Observer (without patterns section)
 */
export const OBSERVER_OUTPUT_FORMAT_BASE = buildObserverOutputFormat();

export function buildObserverOutputFormat(includeThreadTitle: boolean = false): string {
  const threadTitleSection = includeThreadTitle
    ? `
<thread-title>
A short, noun-phrase title for this conversation (2-5 words). Examples:
- "Auth bug fix" — not "Fixing the auth bug"
- "Dark mode toggle" — not "User wants dark mode toggle added"
- "Deployment pipeline setup" — not "Setting up deployment pipeline for project"
Only update when the topic meaningfully changes.
</thread-title>`
    : '';

  return `Use priority levels:
- 🔴 High: explicit user facts, preferences, unresolved goals, critical context
- 🟡 Medium: project details, learned information, tool results
- 🟢 Low: minor details, uncertain observations
- ✅ Completed: concrete task finished, question answered, issue resolved, goal achieved, or subtask completed in a way that helps the assistant know it is done

Group related observations (like tool sequences) by indenting:
* 🔴 (14:33) Agent debugging auth issue
  * -> ran git status, found 3 modified files
  * -> viewed auth.ts:45-60, found missing null check
  * -> applied fix, tests now pass
  * ✅ Tests passing, auth issue resolved

Group observations by date, then list each with 24-hour time.

<observations>
Date: Dec 4, 2025
* 🔴 (14:30) User prefers direct answers
* 🔴 (14:31) Working on feature X
* 🟡 (14:32) User might prefer dark mode

Date: Dec 5, 2025
* 🔴 (09:15) Continued work on feature X
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
</suggested-response>${threadTitleSection}`;
}

/**
 * The guidelines for the Observer.
 * This is exported so the Reflector can reference them.
 */
export const OBSERVER_GUIDELINES = `- Be specific enough for the assistant to act on
- Good: "User prefers short, direct answers without lengthy explanations"
- Bad: "User stated a preference" (too vague)
- Add 1 to 5 observations per exchange
- Use terse language to save tokens. Sentences should be dense without unnecessary words
- Do not add repetitive observations that have already been observed. Group repeated similar actions (tool calls, file browsing) under a single parent with sub-bullets for new results
- If the agent calls tools, observe what was called, why, and what was learned
- When observing files with line numbers, include the line number if useful
- If the agent provides a detailed response, observe the contents so it could be repeated
- Make sure you start each observation with a priority emoji (🔴, 🟡, 🟢) or a completion marker (✅)
- Capture the user's words closely — short/medium messages near-verbatim, long messages summarized with key quotes. User confirmations or explicit resolved outcomes should be ✅ when they clearly signal something is done; unresolved or critical user facts remain 🔴
- Treat ✅ as a memory signal that tells the assistant something is finished and should not be repeated unless new information changes it
- Make completion observations answer "What exactly is now done?"
- Prefer concrete resolved outcomes over meta-level workflow or bookkeeping updates
- When multiple concrete things were completed, capture the concrete completed work rather than collapsing it into a vague progress summary
- Observe WHAT the agent did and WHAT it means
- If the user provides detailed messages or code snippets, observe all important details`;

/**
 * Build the complete observer system prompt.
 * @param multiThread - Whether this is for multi-thread batched observation (default: false)
 * @param instruction - Optional custom instructions to append to the prompt
 */
export function buildObserverSystemPrompt(
  multiThread: boolean = false,
  instruction?: string,
  includeThreadTitle: boolean = false,
): string {
  const outputFormat = buildObserverOutputFormat(includeThreadTitle);
  const multiThreadTitleInstruction = includeThreadTitle
    ? ` Each thread's observations, current-task, suggested-response, and thread-title should be nested inside a <thread id="..."> block within <observations>.`
    : ` Each thread's observations, current-task, and suggested-response should be nested inside a <thread id="..."> block within <observations>.`;
  const multiThreadTitleExample = includeThreadTitle
    ? `
<thread-title>Feature X implementation</thread-title>`
    : '';
  const multiThreadSecondTitleExample = includeThreadTitle
    ? `
<thread-title>Deployment setup</thread-title>`
    : '';

  if (multiThread) {
    return `You are the memory consciousness of an AI assistant. Your observations will be the ONLY information the assistant has about past interactions with this user.

Extract observations that will help the assistant remember:

${OBSERVER_EXTRACTION_INSTRUCTIONS}

=== MULTI-THREAD INPUT ===

You will receive messages from MULTIPLE conversation threads, each wrapped in <thread id="..."> tags.
Process each thread separately and output observations for each thread.

=== OUTPUT FORMAT ===

Your output MUST use XML tags to structure the response.${multiThreadTitleInstruction}

Use this observation format inside each thread block:

${outputFormat}

For multi-thread output, wrap each thread's observations like this:

<observations>
<thread id="thread_id_1">
Date: Dec 4, 2025
* 🔴 (14:30) User prefers direct answers
* 🔴 (14:31) Working on feature X

<current-task>
What the agent is currently working on in this thread
</current-task>

<suggested-response>
Hint for the agent's next message in this thread
</suggested-response>${multiThreadTitleExample}
</thread>

<thread id="thread_id_2">
Date: Dec 5, 2025
* 🔴 (09:15) User asked about deployment

<current-task>
Current task for this thread
</current-task>

<suggested-response>
Suggested response for this thread
</suggested-response>${multiThreadSecondTitleExample}
</thread>
</observations>

=== GUIDELINES ===

${OBSERVER_GUIDELINES}

Remember: These observations are the assistant's ONLY memory. Make them count.

User messages are extremely important. If the user asks a question or gives a new task, make it clear in <current-task> that this is the priority.${instruction ? `\n\n=== CUSTOM INSTRUCTIONS ===\n\n${instruction}` : ''}`;
  }

  return `You are the memory consciousness of an AI assistant. Your observations will be the ONLY information the assistant has about past interactions with this user.

Extract observations that will help the assistant remember:

${OBSERVER_EXTRACTION_INSTRUCTIONS}

=== OUTPUT FORMAT ===

Your output MUST use XML tags to structure the response. This allows the system to properly parse and manage memory over time.

${outputFormat}

=== GUIDELINES ===

${OBSERVER_GUIDELINES}

=== IMPORTANT: THREAD ATTRIBUTION ===

Do NOT add thread identifiers, thread IDs, or <thread> tags to your observations.
Thread attribution is handled externally by the system.
Simply output your observations without any thread-related markup.

Remember: These observations are the assistant's ONLY memory. Make them count.

User messages are extremely important. If the user asks a question or gives a new task, make it clear in <current-task> that this is the priority. If the assistant needs to respond to the user, indicate in <suggested-response> that it should pause for user reply before continuing other tasks.${instruction ? `\n\n=== CUSTOM INSTRUCTIONS ===\n\n${instruction}` : ''}`;
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

  /** The suggested thread title (short/concise, for thread metadata) */
  threadTitle?: string;

  /** Raw output from the model (for debugging) */
  rawOutput?: string;

  /** True if the output was detected as degenerate (repetition loop) and should be discarded/retried */
  degenerate?: boolean;
}

/**
 * Format messages for the Observer's input.
 * Includes timestamps for temporal context.
 */
type ObserverAttachmentPart =
  | {
      type: 'image';
      image: unknown;
      mimeType?: string;
      filename?: string;
      providerOptions?: unknown;
      providerMetadata?: unknown;
      experimental_providerMetadata?: unknown;
    }
  | {
      type: 'file';
      data: unknown;
      mimeType?: string;
      filename?: string;
      providerOptions?: unknown;
      providerMetadata?: unknown;
      experimental_providerMetadata?: unknown;
    };

type ObserverInputAttachmentPart =
  | {
      type: 'image';
      image: unknown;
      mimeType?: string;
      providerOptions?: unknown;
      providerMetadata?: unknown;
      experimental_providerMetadata?: unknown;
    }
  | {
      type: 'file';
      data: unknown;
      mimeType?: string;
      filename?: string;
      providerOptions?: unknown;
      providerMetadata?: unknown;
      experimental_providerMetadata?: unknown;
    };

interface ObserverFormattedLine {
  date: string;
  time: string;
  title: string;
  body: string;
}

interface ObserverFormattedMessage {
  lines: ObserverFormattedLine[];
  attachments: ObserverInputAttachmentPart[];
}

interface ObserverAttachmentCounter {
  nextImageId: number;
  nextFileId: number;
}

interface ObserverFormattingContext {
  previousDate?: string;
  previousTime?: string;
}

interface ObserverFormattedOutput {
  text: string;
  context: ObserverFormattingContext;
}

const OBSERVER_IMAGE_FILE_EXTENSIONS = new Set([
  'png',
  'jpg',
  'jpeg',
  'webp',
  'gif',
  'bmp',
  'tiff',
  'tif',
  'heic',
  'heif',
  'avif',
]);

function formatObserverDate(createdAt?: Date): string {
  return createdAt
    ? `${createdAt.toLocaleDateString('en-US', {
        month: 'short',
      })} ${createdAt.getDate()} ${createdAt.getFullYear()}`
    : '';
}

function formatObserverTime(createdAt?: Date): string {
  return createdAt
    ? createdAt.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      })
    : '';
}

function getObserverPathExtension(value: string): string | undefined {
  const normalized = value.split('#', 1)[0]?.split('?', 1)[0] ?? value;
  const match = normalized.match(/\.([a-z0-9]+)$/i);
  return match?.[1]?.toLowerCase();
}

function hasObserverImageFilenameExtension(filename: unknown): boolean {
  return typeof filename === 'string' && OBSERVER_IMAGE_FILE_EXTENSIONS.has(getObserverPathExtension(filename) ?? '');
}

function isImageLikeObserverFilePart(part: ObserverAttachmentPart): boolean {
  if (part.type !== 'file') {
    return false;
  }

  if (typeof part.mimeType === 'string' && part.mimeType.toLowerCase().startsWith('image/')) {
    return true;
  }

  if (typeof part.data === 'string' && part.data.startsWith('data:image/')) {
    return true;
  }

  if (part.data instanceof URL && hasObserverImageFilenameExtension(part.data.pathname)) {
    return true;
  }

  if (typeof part.data === 'string') {
    try {
      const url = new URL(part.data);
      if ((url.protocol === 'http:' || url.protocol === 'https:') && hasObserverImageFilenameExtension(url.pathname)) {
        return true;
      }
    } catch {
      // ignore invalid URL string
    }
  }

  return hasObserverImageFilenameExtension(part.filename);
}

function toObserverInputAttachmentPart(part: ObserverAttachmentPart): ObserverInputAttachmentPart {
  if (part.type === 'image') {
    return {
      type: 'image',
      image: part.image,
      mimeType: part.mimeType,
      providerOptions: part.providerOptions,
      providerMetadata: part.providerMetadata,
      experimental_providerMetadata: part.experimental_providerMetadata,
    };
  }

  if (isImageLikeObserverFilePart(part)) {
    return {
      type: 'image',
      image: part.data,
      mimeType: part.mimeType,
      providerOptions: part.providerOptions,
      providerMetadata: part.providerMetadata,
      experimental_providerMetadata: part.experimental_providerMetadata,
    };
  }

  return {
    type: 'file',
    data: part.data,
    mimeType: part.mimeType,
    filename: part.filename,
    providerOptions: part.providerOptions,
    providerMetadata: part.providerMetadata,
    experimental_providerMetadata: part.experimental_providerMetadata,
  };
}

function resolveObserverAttachmentLabel(part: ObserverAttachmentPart): string | undefined {
  if (part.filename?.trim()) {
    return part.filename.trim();
  }

  const asset = part.type === 'image' ? part.image : part.data;
  if (typeof asset !== 'string' || asset.startsWith('data:')) {
    return part.mimeType;
  }

  try {
    const url = new URL(asset);
    const basename = url.pathname.split('/').filter(Boolean).pop();
    return basename ? decodeURIComponent(basename) : part.mimeType;
  } catch {
    return part.mimeType;
  }
}

function formatObserverAttachmentPlaceholder(part: ObserverAttachmentPart, counter: ObserverAttachmentCounter): string {
  const attachmentType = part.type === 'image' || isImageLikeObserverFilePart(part) ? 'Image' : 'File';
  const attachmentId = attachmentType === 'Image' ? counter.nextImageId++ : counter.nextFileId++;
  const label = resolveObserverAttachmentLabel(part);
  return label ? `[${attachmentType} #${attachmentId}: ${label}]` : `[${attachmentType} #${attachmentId}]`;
}

function formatObserverPartLine(title: string, body: string, time: string, previousTime?: string): string {
  const timeLabel = time && time !== previousTime ? ` (${time})` : '';
  return `${title}${timeLabel}: ${body}`;
}

function normalizeObserverCreatedAt(createdAt: unknown): Date | undefined {
  if (createdAt instanceof Date) {
    // Invalid Date objects still satisfy `instanceof Date`, so reject them explicitly.
    if (Number.isNaN(createdAt.getTime())) {
      return undefined;
    }
    return createdAt;
  }

  if (typeof createdAt === 'number' || typeof createdAt === 'string') {
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) {
      return undefined;
    }
    return date;
  }

  return undefined;
}

function formatObserverLines(
  lines: ObserverFormattedLine[],
  context: ObserverFormattingContext = {},
): ObserverFormattedOutput {
  const output: string[] = [];
  let previousDate = context.previousDate;
  let previousTime = context.previousTime;

  for (const line of lines) {
    if (line.date && line.date !== previousDate) {
      output.push(`${line.date}:`);
      previousDate = line.date;
      previousTime = undefined;
    }

    output.push(formatObserverPartLine(line.title, line.body, line.time, previousTime));
    previousTime = line.time || previousTime;
  }

  return {
    text: output.join('\n'),
    context: { previousDate, previousTime },
  };
}

function formatObserverMessage(
  msg: MastraDBMessage,
  counter: ObserverAttachmentCounter,
  options?: ObserverFormatOptions,
): ObserverFormattedMessage {
  const maxLen = options?.maxPartLength;
  const maxToolResultTokens = options?.maxToolResultTokens ?? DEFAULT_OBSERVER_TOOL_RESULT_MAX_TOKENS;
  const role = msg.role.charAt(0).toUpperCase() + msg.role.slice(1);
  const attachments: ObserverInputAttachmentPart[] = [];
  const messageCreatedAt = normalizeObserverCreatedAt(msg.createdAt);

  let lines: ObserverFormattedLine[] = [];

  const pushLine = (title: string, body: string, createdAt?: unknown) => {
    if (!body) {
      return;
    }

    const normalizedCreatedAt = normalizeObserverCreatedAt(createdAt) ?? messageCreatedAt;
    lines.push({
      date: formatObserverDate(normalizedCreatedAt),
      time: formatObserverTime(normalizedCreatedAt),
      title,
      body,
    });
  };

  if (typeof msg.content === 'string') {
    pushLine(role, maybeTruncate(msg.content, maxLen), messageCreatedAt);
  } else if (msg.content?.parts && Array.isArray(msg.content.parts) && msg.content.parts.length > 0) {
    msg.content.parts.forEach(part => {
      const partCreatedAt = normalizeObserverCreatedAt((part as { createdAt?: unknown }).createdAt) ?? messageCreatedAt;

      if (part.type === 'text') {
        pushLine(role, maybeTruncate(part.text, maxLen), partCreatedAt);
        return;
      }

      if (part.type === 'tool-invocation') {
        const inv = part.toolInvocation;
        if (inv.state === 'result') {
          const { value: resultForObserver } = resolveToolResultValue(
            part as { providerMetadata?: Record<string, any> },
            inv.result,
          );
          pushLine(
            `Tool Result ${inv.toolName}`,
            maybeTruncate(formatToolResultForObserver(resultForObserver, { maxTokens: maxToolResultTokens }), maxLen),
            partCreatedAt,
          );
          return;
        }

        pushLine(`Tool Call ${inv.toolName}`, maybeTruncate(JSON.stringify(inv.args, null, 2), maxLen), partCreatedAt);
        return;
      }

      const partType = (part as { type?: string }).type;
      if (partType === 'reasoning') {
        const reasoning = (part as { reasoning?: string }).reasoning;
        if (!reasoning) {
          return;
        }
        pushLine('Reasoning', maybeTruncate(reasoning, maxLen), partCreatedAt);
        return;
      }

      if (partType === 'image' || partType === 'file') {
        const attachment = part as ObserverAttachmentPart;
        const inputAttachment = toObserverInputAttachmentPart(attachment);
        if (inputAttachment) {
          attachments.push(inputAttachment);
        }
        pushLine(
          partType === 'image' ? 'Image' : 'File',
          formatObserverAttachmentPlaceholder(attachment, counter),
          partCreatedAt,
        );
      }
    });
  } else if (msg.content?.content) {
    pushLine(role, maybeTruncate(msg.content.content, maxLen), messageCreatedAt);
  }

  if (lines.length === 0 && attachments.length === 0) {
    return { lines: [], attachments };
  }

  return {
    lines,
    attachments,
  };
}

export function formatMessagesForObserver(messages: MastraDBMessage[], options?: ObserverFormatOptions): string {
  const counter = { nextImageId: 1, nextFileId: 1 };
  const sections: string[] = [];
  let context: ObserverFormattingContext = {};

  for (const message of messages) {
    const formatted = formatObserverMessage(message, counter, options);
    if (formatted.lines.length === 0) {
      continue;
    }

    const rendered = formatObserverLines(formatted.lines, context);
    if (!rendered.text) {
      continue;
    }

    sections.push(rendered.text);
    context = rendered.context;
  }

  return sections.join('\n');
}

function appendFormattedObserverMessage(
  content: any[],
  formatted: ObserverFormattedMessage,
  context: ObserverFormattingContext,
): ObserverFormattingContext {
  const rendered = formatObserverLines(formatted.lines, context);
  if (rendered.text) {
    content.push({ type: 'text', text: rendered.text });
  }
  content.push(...formatted.attachments);
  return rendered.context;
}

export function buildObserverHistoryMessage(messages: MastraDBMessage[], options?: ObserverFormatOptions): CoreMessage {
  const counter = { nextImageId: 1, nextFileId: 1 };
  const content: any[] = [{ type: 'text', text: '## New Message History to Observe\n\n' }];

  let context: ObserverFormattingContext = {};
  messages.forEach(message => {
    const formatted = formatObserverMessage(message, counter, options);
    if (formatted.lines.length === 0 && formatted.attachments.length === 0) return;
    context = appendFormattedObserverMessage(content, formatted, context);
  });

  return {
    role: 'user',
    content,
  } as CoreMessage;
}

/** Truncate a string to maxLen characters, appending a note if truncated. */
function maybeTruncate(str: string, maxLen?: number): string {
  if (!maxLen || str.length <= maxLen) return str;
  const truncated = str.slice(0, maxLen);
  const remaining = str.length - maxLen;
  return `${truncated}\n... [truncated ${remaining} characters]`;
}

/**
 * Format messages from multiple threads for batched observation.
 * Each thread's messages are wrapped in a <thread id="..."> block.
 */
export function formatMultiThreadMessagesForObserver(
  messagesByThread: Map<string, MastraDBMessage[]>,
  threadOrder: string[],
  options?: ObserverFormatOptions,
): string {
  const sections: string[] = [];

  for (const threadId of threadOrder) {
    const messages = messagesByThread.get(threadId);
    if (!messages || messages.length === 0) continue;

    const formattedMessages = formatMessagesForObserver(messages, options);
    sections.push(`<thread id="${threadId}">\n${formattedMessages}\n</thread>`);
  }

  return sections.join('\n\n');
}

export function buildMultiThreadObserverHistoryMessage(
  messagesByThread: Map<string, MastraDBMessage[]>,
  threadOrder: string[],
  options?: ObserverFormatOptions,
): CoreMessage {
  const counter = { nextImageId: 1, nextFileId: 1 };
  const content: any[] = [
    {
      type: 'text',
      text: `## New Message History to Observe\n\nThe following messages are from ${threadOrder.length} different conversation threads. Each thread is wrapped in a <thread id="..."> tag.\n\n`,
    },
  ];

  threadOrder.forEach((threadId, threadIndex) => {
    const messages = messagesByThread.get(threadId);
    if (!messages || messages.length === 0) return;

    const threadContent: any[] = [];
    let context: ObserverFormattingContext = {};
    let hasVisibleContent = false;
    messages.forEach(message => {
      const formatted = formatObserverMessage(message, counter, options);
      if (formatted.lines.length === 0 && formatted.attachments.length === 0) return;
      context = appendFormattedObserverMessage(threadContent, formatted, context);
      hasVisibleContent = true;
    });

    if (!hasVisibleContent) return;

    content.push({ type: 'text', text: `<thread id="${threadId}">\n` });
    content.push(...threadContent);
    content.push({ type: 'text', text: '\n</thread>' });
    if (threadIndex < threadOrder.length - 1) {
      content.push({ type: 'text', text: '\n\n' });
    }
  });

  return {
    role: 'user',
    content,
  } as CoreMessage;
}

export function buildMultiThreadObserverTaskPrompt(
  existingObservations: string | undefined,
  threadOrder?: string[],
  priorMetadataByThread?: Map<string, { currentTask?: string; suggestedResponse?: string; threadTitle?: string }>,
  wasTruncated?: boolean,
  includeThreadTitle?: boolean,
): string {
  let prompt = '';

  if (existingObservations) {
    prompt += `## Previous Observations\n\n${existingObservations}\n\n---\n\n`;
    prompt +=
      'Do not repeat these existing observations. Your new observations will be appended to the existing observations.\n\n';
  }

  const hasTruncatedObservations = wasTruncated ?? false;
  const threadMetadataLines = threadOrder
    ?.map(threadId => {
      const metadata = priorMetadataByThread?.get(threadId);
      const hasRelevantMetadata =
        metadata?.currentTask || metadata?.suggestedResponse || (includeThreadTitle && metadata?.threadTitle);
      if (!hasRelevantMetadata) {
        return '';
      }

      const lines = [`- thread ${threadId}`];
      if (metadata.currentTask) {
        lines.push(`  - prior current-task: ${metadata.currentTask}`);
      }
      if (metadata.suggestedResponse) {
        lines.push(`  - prior suggested-response: ${metadata.suggestedResponse}`);
      }
      if (includeThreadTitle && metadata.threadTitle) {
        lines.push(`  - prior thread-title: ${metadata.threadTitle}`);
      }
      return lines.join('\n');
    })
    .filter(Boolean)
    .join('\n');

  if (threadMetadataLines) {
    prompt += `## Prior Thread Metadata\n\n${threadMetadataLines}\n\n`;
    if (hasTruncatedObservations) {
      prompt += `Previous observations were truncated for context budget reasons.\n`;
      prompt += `The main agent still has full memory context outside this observer window.\n`;
    }
    const titleHint = includeThreadTitle ? ', and thread-title' : '';
    prompt += `Use each thread's prior current-task, suggested-response${titleHint} as continuity hints, then update them based on that thread's new messages.\n\n---\n\n`;
  }

  prompt += `## Your Task\n\n`;
  const titleInstruction = includeThreadTitle ? ', and thread-title' : '';
  prompt += `Extract new observations from each thread. Output your observations grouped by thread using <thread id="..."> tags inside your <observations> block. Each thread block should contain that thread's observations, current-task, suggested-response${titleInstruction}.\n\n`;
  prompt += `Example output format:\n`;
  prompt += `<observations>\n`;
  prompt += `<thread id="thread1">\n`;
  prompt += `Date: Dec 4, 2025\n`;
  prompt += `* 🔴 (14:30) User prefers direct answers\n`;
  prompt += `<current-task>Working on feature X</current-task>\n`;
  prompt += `<suggested-response>Continue with the implementation</suggested-response>\n`;
  if (includeThreadTitle) prompt += `<thread-title>Feature X implementation</thread-title>\n`;
  prompt += `</thread>\n`;
  prompt += `<thread id="thread2">\n`;
  prompt += `Date: Dec 5, 2025\n`;
  prompt += `* 🔴 (09:15) User asked about deployment\n`;
  prompt += `<current-task>Discussing deployment options</current-task>\n`;
  prompt += `<suggested-response>Explain the deployment process</suggested-response>\n`;
  if (includeThreadTitle) prompt += `<thread-title>Deployment setup</thread-title>\n`;
  prompt += `</thread>\n`;
  prompt += `</observations>`;

  return prompt;
}

/**
 * Build the prompt for multi-thread batched observation.
 */
export function buildMultiThreadObserverPrompt(
  existingObservations: string | undefined,
  messagesByThread: Map<string, MastraDBMessage[]>,
  threadOrder: string[],
  priorMetadataByThread?: Map<string, { currentTask?: string; suggestedResponse?: string; threadTitle?: string }>,
  wasTruncated?: boolean,
  options?: ObserverFormatOptions,
  includeThreadTitle?: boolean,
): string {
  const formattedMessages = formatMultiThreadMessagesForObserver(messagesByThread, threadOrder, options);
  return `## New Message History to Observe\n\nThe following messages are from ${threadOrder.length} different conversation threads. Each thread is wrapped in a <thread id="..."> tag.\n\n${formattedMessages}\n\n---\n\n${buildMultiThreadObserverTaskPrompt(existingObservations, threadOrder, priorMetadataByThread, wasTruncated, includeThreadTitle)}`;
}

/**
 * Result from parsing multi-thread Observer output
 */
export interface MultiThreadObserverResult {
  /** Results per thread */
  threads: Map<string, ObserverResult>;
  /** Raw output from the model (for debugging) */
  rawOutput: string;
  /** True if the output was detected as degenerate (repetition loop) and should be discarded/retried */
  degenerate?: boolean;
}

/**
 * Parse multi-thread Observer output to extract per-thread results.
 */
export function parseMultiThreadObserverOutput(output: string): MultiThreadObserverResult {
  const threads = new Map<string, ObserverResult>();

  // Check for degenerate repetition on the whole output
  if (detectDegenerateRepetition(output)) {
    return { threads, rawOutput: output, degenerate: true };
  }

  // Extract the <observations> block first
  const observationsMatch = output.match(/^[ \t]*<observations>([\s\S]*?)^[ \t]*<\/observations>/im);
  const observationsContent = observationsMatch?.[1] ?? output;

  // Find all <thread id="...">...</thread> blocks within observations
  const threadRegex = /<thread\s+id="([^"]+)">([\s\S]*?)<\/thread>/gi;
  let match;

  while ((match = threadRegex.exec(observationsContent)) !== null) {
    const threadId = match[1];
    const threadContent = match[2];
    if (!threadId || !threadContent) continue;

    // Parse this thread's content for observations, current-task, suggested-response
    // Extract observations (everything except current-task and suggested-response)
    let observations = threadContent;

    // Extract and remove current-task
    let currentTask: string | undefined;
    const currentTaskMatch = threadContent.match(/<current-task>([\s\S]*?)<\/current-task>/i);
    if (currentTaskMatch?.[1]) {
      currentTask = currentTaskMatch[1].trim();
      observations = observations.replace(/<current-task>[\s\S]*?<\/current-task>/i, '');
    }

    // Extract and remove suggested-response
    let suggestedContinuation: string | undefined;
    const suggestedMatch = threadContent.match(/<suggested-response>([\s\S]*?)<\/suggested-response>/i);
    if (suggestedMatch?.[1]) {
      suggestedContinuation = suggestedMatch[1].trim();
      observations = observations.replace(/<suggested-response>[\s\S]*?<\/suggested-response>/i, '');
    }

    // Extract and remove thread-title
    let threadTitle: string | undefined;
    const threadTitleMatch = threadContent.match(/<thread-title>([\s\S]*?)<\/thread-title>/i);
    if (threadTitleMatch?.[1]) {
      threadTitle = threadTitleMatch[1].trim();
      observations = observations.replace(/<thread-title>[\s\S]*?<\/thread-title>/i, '');
    }

    // Clean up observations and apply line truncation
    observations = sanitizeObservationLines(observations.trim());

    threads.set(threadId, {
      observations,
      currentTask,
      suggestedContinuation,
      threadTitle,
      rawOutput: threadContent,
    });
  }

  // If no thread blocks found, the caller will need to handle this case
  // (e.g., by falling back to single-thread parsing)

  return {
    threads,
    rawOutput: output,
  };
}

export function buildObserverTaskPrompt(
  existingObservations: string | undefined,
  options?: {
    skipContinuationHints?: boolean;
    priorCurrentTask?: string;
    priorSuggestedResponse?: string;
    priorThreadTitle?: string;
    wasTruncated?: boolean;
    includeThreadTitle?: boolean;
  },
): string {
  let prompt = '';

  if (existingObservations) {
    prompt += `## Previous Observations\n\n${existingObservations}\n\n---\n\n`;
    prompt +=
      'Do not repeat these existing observations. Your new observations will be appended to the existing observations.\n\n';
  }

  const hasTruncatedObservations = options?.wasTruncated ?? false;
  const priorMetadataLines: string[] = [];
  if (options?.priorCurrentTask) {
    priorMetadataLines.push(`- prior current-task: ${options.priorCurrentTask}`);
  }
  if (options?.priorSuggestedResponse) {
    priorMetadataLines.push(`- prior suggested-response: ${options.priorSuggestedResponse}`);
  }
  if (options?.includeThreadTitle && options?.priorThreadTitle) {
    priorMetadataLines.push(`- prior thread-title: ${options.priorThreadTitle}`);
  }

  if (priorMetadataLines.length > 0) {
    prompt += `## Prior Thread Metadata\n\n${priorMetadataLines.join('\n')}\n\n`;
    if (hasTruncatedObservations) {
      prompt += `Previous observations were truncated for context budget reasons.\n`;
      prompt += `The main agent still has full memory context outside this observer window.\n`;
    }
    const titleHint = options?.includeThreadTitle ? ', and thread-title' : '';
    prompt += `Use the prior current-task, suggested-response${titleHint} as continuity hints, then update them based on the new messages.\n\n---\n\n`;
  }

  prompt += `## Your Task\n\n`;
  prompt += `Extract new observations from the message history above. Do not repeat observations that are already in the previous observations. Add your new observations in the format specified in your instructions.`;

  // Add thread title guidance (independent of continuation hints)
  if (options?.includeThreadTitle) {
    prompt += `\n\nAlso output a <thread-title> — a short noun-phrase label for this conversation (2-5 words). Write it like a file name or PR title: "Auth bug fix", "Memory config refactor", "RAG pipeline setup". Avoid verbs/sentences ("Fixing the auth bug"), filler ("Working on stuff"), and generic labels ("Code review"). Only change it from the prior title if the topic meaningfully shifted.`;
  }

  if (options?.skipContinuationHints) {
    prompt += `\n\nIMPORTANT: Do NOT include <current-task> or <suggested-response> sections in your output. Only output <observations>${options?.includeThreadTitle ? ' and <thread-title>' : ''}.`;
  }

  return prompt;
}

/**
 * Build the full prompt for the Observer agent.
 * Includes emphasis on the most recent user message for priority handling.
 */
export function buildObserverPrompt(
  existingObservations: string | undefined,
  messagesToObserve: MastraDBMessage[],
  options?: {
    skipContinuationHints?: boolean;
    priorCurrentTask?: string;
    priorSuggestedResponse?: string;
    priorThreadTitle?: string;
    wasTruncated?: boolean;
    includeThreadTitle?: boolean;
  },
): string {
  const formattedMessages = formatMessagesForObserver(messagesToObserve);
  return `## New Message History to Observe\n\n${formattedMessages}\n\n---\n\n${buildObserverTaskPrompt(existingObservations, options)}`;
}

/**
 * Parse the Observer's output to extract observations, current task, and suggested response.
 * Uses XML tag parsing for structured extraction.
 */
export function parseObserverOutput(output: string): ObserverResult {
  // Check for degenerate repetition before parsing (operates on raw output)
  if (detectDegenerateRepetition(output)) {
    return {
      observations: '',
      rawOutput: output,
      degenerate: true,
    };
  }

  const parsed = parseMemorySectionXml(output);

  // Return observations WITHOUT current-task/suggested-response tags
  // Those are stored separately in thread metadata and injected dynamically
  const observations = sanitizeObservationLines(parsed.observations || '');

  return {
    observations,
    currentTask: parsed.currentTask || undefined,
    suggestedContinuation: parsed.suggestedResponse || undefined,
    threadTitle: parsed.threadTitle || undefined,
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
  threadTitle: string;
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
    threadTitle: '',
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

  // Extract <thread-title> content (first match only)
  // Opening tag must be at the start of a line; closing tag can be on the same line
  // (titles are short, so LLMs typically output them on a single line)
  const threadTitleMatch = content.match(/^[ \t]*<thread-title>([\s\S]*?)<\/thread-title>/im);
  if (threadTitleMatch?.[1]) {
    result.threadTitle = threadTitleMatch[1].trim();
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
 * Maximum length (in characters) for a single observation line.
 * Lines exceeding this are truncated with an ellipsis marker.
 * This guards against LLM degeneration that produces enormous single-line outputs.
 */
const MAX_OBSERVATION_LINE_CHARS = 10_000;

/**
 * Truncate individual observation lines that exceed the maximum length.
 */
export function sanitizeObservationLines(observations: string): string {
  if (!observations) return observations;
  const lines = observations.split('\n');
  let changed = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.length > MAX_OBSERVATION_LINE_CHARS) {
      lines[i] = lines[i]!.slice(0, MAX_OBSERVATION_LINE_CHARS) + ' … [truncated]';
      changed = true;
    }
  }
  return changed ? lines.join('\n') : observations;
}

/**
 * Detect degenerate repetition in observer/reflector output.
 * Returns true if the text contains suspicious levels of repeated content,
 * which indicates an LLM repeat-penalty bug (e.g., Gemini Flash looping).
 *
 * Strategy: sample sequential chunks of the text and check if a high
 * proportion are near-identical to previous chunks.
 */
export function detectDegenerateRepetition(text: string): boolean {
  if (!text || text.length < 2000) return false;

  // Strategy 1: Check for repeated long substrings by sampling fixed-size windows.
  // If the same ~200-char window appears many times, it's degenerate.
  const windowSize = 200;
  const step = Math.max(1, Math.floor(text.length / 50)); // sample ~50 windows
  const seen = new Map<string, number>();
  let duplicateWindows = 0;
  let totalWindows = 0;

  for (let i = 0; i + windowSize <= text.length; i += step) {
    const window = text.slice(i, i + windowSize);
    totalWindows++;
    const count = (seen.get(window) ?? 0) + 1;
    seen.set(window, count);
    if (count > 1) duplicateWindows++;
  }

  // If more than 40% of sampled windows are duplicates, it's degenerate
  if (totalWindows > 5 && duplicateWindows / totalWindows > 0.4) {
    return true;
  }

  // Strategy 2: Check for extremely long lines (a single line with 50k+ chars
  // is almost certainly degenerate enumeration)
  const lines = text.split('\n');
  for (const line of lines) {
    if (line.length > 50_000) return true;
  }

  return false;
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
  const openTag = '<current-task>';
  const closeTag = '</current-task>';
  const startIdx = observations.toLowerCase().indexOf(openTag);
  if (startIdx === -1) return null;
  const contentStart = startIdx + openTag.length;
  const endIdx = observations.toLowerCase().indexOf(closeTag, contentStart);
  if (endIdx === -1) return null;
  const content = observations.slice(contentStart, endIdx).trim();
  return content || null;
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
  let optimized = stripEphemeralAnchorIds(observations);

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
