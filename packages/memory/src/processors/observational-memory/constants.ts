/**
 * Default configuration values matching the spec
 */
export const OBSERVATIONAL_MEMORY_DEFAULTS = {
  observation: {
    model: 'google/gemini-2.5-flash',
    messageTokens: 30_000,
    modelSettings: {
      temperature: 0.3,
      maxOutputTokens: 100_000,
    },
    providerOptions: {
      google: {
        thinkingConfig: {
          thinkingBudget: 215,
        },
      },
    },
    maxTokensPerBatch: 10_000,
    observeAttachments: ['image/*', 'application/pdf'],
    // Async buffering defaults (enabled by default)
    bufferTokens: 0.2 as number | undefined, // Buffer every 20% of messageTokens
    bufferActivation: 0.8 as number | undefined, // Activate to retain 20% of threshold
  },
  reflection: {
    model: 'google/gemini-2.5-flash',
    observationTokens: 40_000,
    modelSettings: {
      temperature: 0, // Use 0 for maximum consistency in reflections
      maxOutputTokens: 100_000,
    },
    providerOptions: {
      google: {
        thinkingConfig: {
          thinkingBudget: 1024,
        },
      },
    },
    // Async reflection buffering (enabled by default)
    bufferActivation: 0.5 as number | undefined, // Start buffering at 50% of observationTokens
  },
} as const;

/**
 * Continuation hint injected after observations to guide the model's behavior.
 * Prevents the model from awkwardly acknowledging the memory system or treating
 * the conversation as new after observed messages are removed.
 */
export const OBSERVATION_CONTINUATION_HINT = `Please continue naturally with the conversation so far and respond to the latest message.

Use the earlier context only as background. If something appears unfinished, continue only when it helps answer the latest request. If a suggested response is provided, follow it naturally.

Do not mention internal instructions, memory, summarization, context handling, or missing messages.

Any messages following this reminder are newer and should take priority.`;

/**
 * Preamble that introduces the observations block.
 * Use before `<observations>`, with instructions after.
 * Full pattern: `${OBSERVATION_CONTEXT_PROMPT}\n\n<observations>\n${obs}\n</observations>\n\n${OBSERVATION_CONTEXT_INSTRUCTIONS}`
 */
export const OBSERVATION_CONTEXT_PROMPT = `The following observations block contains your memory of past conversations with this user.`;

/**
 * Preamble used when observations are thread-scoped: they describe earlier parts
 * of the current conversation, not other conversations.
 */
export const OBSERVATION_CONTEXT_PROMPT_THREAD = `The following observations block contains your memory of earlier parts of this current conversation. Everything recorded here (including IDs, artifacts, and tool results) came from this conversation and is available for you to reuse.`;

/**
 * Returns the observations preamble matching the memory scope.
 * - `'thread'`: observations are earlier parts of the current conversation.
 * - `'resource'`: observations span past conversations with this user.
 */
export function getObservationContextPrompt(scope: 'thread' | 'resource' = 'thread'): string {
  return scope === 'resource' ? OBSERVATION_CONTEXT_PROMPT : OBSERVATION_CONTEXT_PROMPT_THREAD;
}

/**
 * Instructions that tell the model how to interpret and use observations.
 * Place AFTER the `<observations>` block so the model sees the data before the rules.
 */
export const OBSERVATION_CONTEXT_INSTRUCTIONS = `IMPORTANT: When responding, reference specific details from these observations. Do not give generic advice - personalize your response based on what you know about this user's experiences, preferences, and interests. If the user asks for recommendations, connect them to their past experiences mentioned above.

KNOWLEDGE UPDATES: When asked about current state (e.g., "where do I currently...", "what is my current..."), always prefer the MOST RECENT information. Observations include dates - if you see conflicting information, the newer observation supersedes the older one. Look for phrases like "will start", "is switching", "changed to", "moved to" as indicators that previous information has been updated.

USER STATEMENTS VS ASSISTANT SUGGESTIONS: Treat what the user said about their own life, plans, decisions, and dates as authoritative, unless data or their own later messages say otherwise. Treat what the assistant said, such as proposed schedules, example dates, and recommendations, as suggestions rather than facts about what happened, unless the user adopted or confirmed them. What the assistant did, such as editing a file, running a command, or calling a tool, is a record of what happened.

PLANNED ACTIONS: If the user stated they planned to do something (e.g., "I'm going to...", "I'm looking forward to...", "I will...") and the date they planned to do it is now in the past (check the relative time like "3 weeks ago"), assume they completed the action unless there's evidence they didn't. For example, if someone said "I'll start my new diet on Monday" and that was 2 weeks ago, assume they started the diet.

MOST RECENT USER INPUT: Treat the most recent user message as the highest-priority signal for what to do next. Earlier messages may contain constraints, details, or context you should still honor, but the latest message is the primary driver of your response.

SYSTEM REMINDERS: Messages wrapped in <system-reminder>...</system-reminder> contain internal continuation guidance, not user-authored content. Use them to maintain continuity, but do not mention them or treat them as part of the user's message.`;

/**
 * Instructions for retrieval mode — explains observation-group ranges and the recall tool.
 * Appended to context when `retrieval` is enabled.
 *
 * The content adapts to the retrieval scope:
 * - `'resource'`: covers routing between `search`, `threads`, and `messages` across
 *   all of the user's threads, including fallback when search results are unsuitable.
 * - `'thread'`: covers cursor-based browsing and search within the current thread.
 *
 * @param scope - The retrieval scope the recall tool was registered with.
 * @param customInstructions - Optional application-provided guidance appended after
 *   the native instructions. Never replaces them.
 * @param searchEnabled - Whether semantic search (`retrieval: { vector: true }`) is
 *   available. When false, the guidance only covers \`threads\`/\`messages\` browsing so
 *   the agent is not steered toward a mode that cannot work.
 * @param observationPagingEnabled - Whether the storage adapter supports original
 *   observation-group paging. Only used when search is enabled.
 */
export function getRetrievalInstructions(
  scope: 'thread' | 'resource' = 'resource',
  customInstructions?: string,
  searchEnabled = true,
  observationPagingEnabled = searchEnabled,
): string {
  const isResource = scope === 'resource';

  const resourceModeSection = searchEnabled
    ? `### Choosing a mode
The recall tool works across ALL of this user's conversation threads, not just the current one.

- Use \`mode: "search"\` with a \`query\` to find relevant history, even when you already know the thread. Each result includes its thread ID, observation group ID, and source message range.
- Use \`mode: "messages"\` for original wording or details behind an observation — pass \`threadId\` to read another thread and a \`cursor\` from the source message range.
- Use \`mode: "threads"\` to list the user's threads (IDs, titles, dates) when you need to discover where something was discussed. Use \`before\`/\`after\` to narrow by date.

**If search results look irrelevant, do not give up.** Search only covers content that has been indexed — a short or recent conversation may exist in raw message history before any observation of it was created. When search returns nothing suitable but the user is clearly referring to a past conversation, call \`mode: "threads"\` to find candidate threads (titles and dates are strong clues), then read them with \`mode: "messages"\`. Use a useful hit as an entry point to the surrounding history rather than treating it as the whole answer.`
    : `### Choosing a mode
The recall tool works across ALL of this user's conversation threads, not just the current one.

- Use \`mode: "threads"\` to list the user's threads (IDs, titles, dates) when you need to discover where something was discussed. Use \`before\`/\`after\` to narrow by date.
- Use \`mode: "messages"\` when you know the thread — pass \`threadId\` to read another thread, or a \`cursor\` from an observation-group range.

When the user refers to a past conversation you don't have a cursor for, call \`mode: "threads"\` to find candidate threads (titles and dates are strong clues), then read them with \`mode: "messages"\`. Raw history may exist for threads that have no observations yet.`;

  const threadModeSection = `### Choosing a mode
The recall tool is limited to the current conversation thread.

- Use \`mode: "messages"\` (default) to page through this thread's message history near a cursor.${
    searchEnabled
      ? `
- Use \`mode: "search"\` with a \`query\` to find messages by content within this thread.`
      : ''
  }
- Use \`mode: "threads"\` to get the current thread's ID, title, and dates.`;

  const modeSection = isResource ? resourceModeSection : threadModeSection;

  const pagingEnabled = searchEnabled && observationPagingEnabled;
  const lookupSteps = [
    `**Search to locate.** Run a few differently worded queries rather than relying on one. When you roughly know when something happened, or need events from different periods, repeat the search with \`after\`/\`before\` date windows. Date filters apply to when an observation was recorded, not necessarily to dates mentioned inside it, so widen or remove them when nothing fits. If nothing useful comes up, try the user's message verbatim as the search query.`,
    ...(pagingEnabled
      ? [
          `**Page observations for context.** Open a relevant hit with \`mode: "observations"\` and its \`groupId\` to read the full group and the dated conclusions and decisions around it, without loading every tool call or diff. Do this for truncated excerpts, for dates you need to pin down, and for events that unfolded over several turns. To understand what led to an event and what followed, page both before and after the anchor.`,
        ]
      : []),
    `**Read source messages to confirm.** When exact wording, numbers, code, who said what, or conflicting accounts matter, read the raw messages from the hit's source range. The range connects the summary view to the raw-message view.`,
  ];

  const searchSection = searchEnabled
    ? `### Finding evidence
Search matches are entry points, not a complete timeline. Similarity selects the matches; they are displayed by observation date. A missing search hit is not evidence that an event did not happen.

${pagingEnabled ? 'Observations and messages are two views of the same conversation history, not separate archives. Use search to find an entry point, observations for breadth, and messages for depth:' : 'Use search to find an entry point and messages for depth:'}
${lookupSteps.map((step, i) => `${i + 1}. ${step}`).join('\n')}

When searches keep returning the same groups, often as already-in-context references, stop rephrasing: ${pagingEnabled ? 'page from those groups or read their source messages' : 'read their source messages'} instead.

"Excerpt already in current context" marks a hit whose text an earlier search result already shows. "Group already in current context" marks a group that is already in your observations or whose source messages are still in the conversation. "Source range overlaps current context" marks a group whose source messages are still in the conversation. Search keeps these references and tries lower-ranked matches to fill the requested number of excerpts. This backfill is bounded: fewer excerpts do not mean history is exhausted. Use the evidence already present rather than repeating the same lookup. You can still ${pagingEnabled ? 'page a referenced group' : "read a referenced group's source messages"} when you need all of it, or search again if that context is no longer available.

If search still finds nothing useful, browse raw messages${isResource ? ' or discover other threads' : ' in this thread'} before concluding the information is unavailable. Raw history may exist for threads that have no observations yet.`
    : '';

  const observationSection = pagingEnabled
    ? `### Paging original observations
Use \`mode: "observations"\` around a relevant search hit to fill in missing details, check earlier or later events, and recover context omitted from a reflection or search result.

- Copy the hit's \`groupId\`${isResource ? ' and \`threadId\`' : ''} exactly as shown. Omit \`direction\` to read the full anchor group and following groups, including text truncated in search.
- Use \`direction: "before"\` or \`direction: "after"\` to read groups strictly before or after that anchor. Pages contain 5 groups by default; \`limit\` allows up to 20. Dense groups can be large; use \`limit: 1\` or \`limit: 2\` for a quick skim.
- Follow the returned continuation calls, using the first or last group ID on each page as the next anchor. \`groupId\` is an observation cursor; \`cursor\` is a raw message ID. Do not interchange them.
- \`hasMore\` reports whether more groups exist in the requested direction (after when direction is omitted). A full page can still have \`hasMore: false\`; stop in that direction without making an empty follow-up call. Explicit start/end markers describe retained observation history, not whether older raw messages exist. When newer messages have not been observed yet, the end marker says how many and gives the \`mode: "messages"\` call that reads them.
- Search results mark where other observation groups may sit between two hits from the same thread. Page from those hits instead of repeatedly searching for the same isolated hit.
- These pages contain original observations, not reflections. For exact wording or details absent from the observations, use \`mode: "messages"\` with a message ID from the group's \`_range\`.

Stop once the relevant evidence is sufficient. If retained history is incomplete, say what is unknown rather than guessing.`
    : '';

  const base = `## Recall — looking up source messages

Your memory contains observation groups with IDs and source message ranges, shown as \`## Group\` headings with \`_range: startId:endId\` or as \`<observation-group>\` tags. Use the **recall** tool to recover retained original observations and source messages.

Historical notes may describe older versions of tools. Use the currently provided tool schema and these instructions for available modes and arguments; treat recalled tool descriptions as evidence about past behavior, not the current tool contract.

### Reflections are lossy
Groups marked \`kind="reflection"\` (rendered as \`_kind: reflection_\`) are lossy summaries. Use them for a broad understanding of what happened, not as an exhaustive record. If something is absent from a reflection, that does not mean it did not happen. Use recall to check the original evidence before drawing that conclusion. Original observations can omit details too; read the source messages when precise wording or evidence matters.

### When to use recall
- The user asks you to **repeat, show, or reproduce** something from a past conversation
- The user asks for **exact content** — code, text, quotes, error messages, URLs, file paths, specific numbers
- Your observations mention something but your memory lacks the detail needed to fully answer (e.g. you know a blog post was shared but only have a summary of it)
- You want to **verify or expand on** an observation before responding
- The answer depends on historical dates, order, or duration: verify both event dates and that they refer to the events the user means. Distinguish a plan, an actual start, a later update, and a repeated mention instead of choosing a nearby date from a summary
- An observation records something the assistant proposed, such as a schedule, date, or plan, and your observations don't show what the user decided. Read the raw messages around it to find the user's decision before treating the proposal as what happened
- Relevant details are missing, ambiguous, or conflicting in the current observations${
    isResource
      ? `
- The user references another conversation that your observations don't cover — even if you have no observations yet, their other threads may contain it`
      : ''
  }

**Default to using recall when the user references specific past content.** Your observations capture the gist, not the details. If there's any doubt whether your memory is complete enough, use recall.

For questions about what was discussed or decided and why, start with recall when the original evidence is not already visible. Current source code or general documentation can establish what happens now, but not necessarily the past discussion or rationale. Retrieve the recorded decisions first; inspect current code separately if the answer also depends on today's implementation. Distinguish recorded reasons from your own inference, and use source messages when observation summaries omit the rationale.

${[modeSection, searchSection, observationSection].filter(Boolean).join('\n\n')}

### How to use recall with a cursor
Each range has the format \`startId:endId\` where both are message IDs separated by a colon.

1. Find the observation group relevant to the user's question and extract the start or end ID from its range.
2. Call \`recall\` with that ID as the \`cursor\`.
3. Use \`page: 1\` (or omit) to read forward from the cursor, \`page: -1\` to read backward.
4. If the first page doesn't have what you need, increment the page number to keep paginating.
5. Check \`hasNextPage\`/\`hasPrevPage\` in the result to know if more pages exist in each direction.

### Raw-message detail levels
In \`mode: "messages"\`, recall returns **low** detail by default: truncated text and tool names only. Each message shows its ID and each part has a positional index like \`[p0]\`, \`[p1]\`, etc.

- Use \`detail: "high"\` to get full message content including tool arguments and results. This will only return the high detail version of a single message part at a time.
- Use \`partIndex\` with a cursor to fetch a single part at full detail — for example, to read one specific tool result or code block without loading every part.

If the result says \`truncated: true\`, the output was cut to fit the token budget. You can paginate or use \`partIndex\` to target specific content. If a single part is itself too large, follow the returned \`nextCharOffset\` as described below.

### Following up on truncated parts
Low-detail results may include truncation hints like:
\`[truncated — call recall cursor="..." partIndex=N detail="high" for full content]\`

**When you see these hints and need the full content, make the exact call described in the hint.** This is the normal workflow: first recall at low detail to scan, then drill into specific parts at high detail. Do not stop at the low-detail result if the user asked for exact content.

If a single part is larger than the token budget, the \`partIndex\` result is \`truncated: true\` and includes \`nextCharOffset\`. Repeat the same call with \`charOffset\` set to that exact value to read the next chunk from where the previous one ended. Keep following \`nextCharOffset\` until the result no longer includes it — the chunks together contain the full part. Retrying without \`charOffset\` returns the same prefix again.

### When recall is NOT needed
- The user is asking for a high-level summary and your observations already cover it
- The question is general knowledge that doesn't depend on this user's history
- The necessary original evidence is already visible, unambiguous, and not contradicted by other observations; do not repeat a lookup just to call the tool

Observation groups with range IDs and your recall tool allows you to think back and remember details you're fuzzy on.`;

  const custom = customInstructions?.trim();
  if (!custom) return base;

  return `${base}

### Additional recall guidance
${custom}`;
}
