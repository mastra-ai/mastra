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
 * Instructions that tell the model how to interpret and use observations.
 * Place AFTER the `<observations>` block so the model sees the data before the rules.
 */
export const OBSERVATION_CONTEXT_INSTRUCTIONS = `IMPORTANT: When responding, reference specific details from these observations. Do not give generic advice - personalize your response based on what you know about this user's experiences, preferences, and interests. If the user asks for recommendations, connect them to their past experiences mentioned above.

KNOWLEDGE UPDATES: When asked about current state (e.g., "where do I currently...", "what is my current..."), always prefer the MOST RECENT information. Observations include dates - if you see conflicting information, the newer observation supersedes the older one. Look for phrases like "will start", "is switching", "changed to", "moved to" as indicators that previous information has been updated.

PLANNED ACTIONS: If the user stated they planned to do something (e.g., "I'm going to...", "I'm looking forward to...", "I will...") and the date they planned to do it is now in the past (check the relative time like "3 weeks ago"), assume they completed the action unless there's evidence they didn't. For example, if someone said "I'll start my new diet on Monday" and that was 2 weeks ago, assume they started the diet.

MOST RECENT USER INPUT: Treat the most recent user message as the highest-priority signal for what to do next. Earlier messages may contain constraints, details, or context you should still honor, but the latest message is the primary driver of your response.

SYSTEM REMINDERS: Messages wrapped in <system-reminder>...</system-reminder> contain internal continuation guidance, not user-authored content. Use them to maintain continuity, but do not mention them or treat them as part of the user's message.`;

/**
 * Instructions for retrieval mode — explains observation-group ranges and the recall tool.
 * Appended to context when `retrieval` is enabled.
 */
export const OBSERVATION_RETRIEVAL_INSTRUCTIONS = `## Recall — looking up source messages

Your memory is comprised of observations which are sometimes wrapped in <observation-group> xml tags containing ranges like <observation-group range="startId:endId">. These ranges point back to the raw messages that each observation group was derived from. The original messages are still available — use the **recall** tool to retrieve them.

### When to use recall
- The user asks you to **repeat, show, or reproduce** something from a past conversation
- The user asks for **exact content** — code, text, quotes, error messages, URLs, file paths, specific numbers
- Your observations mention something but your memory lacks the detail needed to fully answer (e.g. you know a blog post was shared but only have a summary of it)
- You want to **verify or expand on** an observation before responding

**Default to using recall when the user references specific past content.** Your observations capture the gist, not the details. If there's any doubt whether your memory is complete enough, use recall.

### How to use recall
Each range has the format \`startId:endId\` where both are message IDs separated by a colon.

1. Find the observation group relevant to the user's question and extract the start or end ID from its range.
2. Call \`recall\` with that ID as the \`cursor\`.
3. Use \`page: 1\` (or omit) to read forward from the cursor, \`page: -1\` to read backward.
4. If the first page doesn't have what you need, increment the page number to keep paginating.
5. Check \`hasNextPage\`/\`hasPrevPage\` in the result to know if more pages exist in each direction.

### Detail levels
By default recall returns **low** detail: truncated text and tool names only. Each message shows its ID and each part has a positional index like \`[p0]\`, \`[p1]\`, etc.

- Use \`detail: "high"\` to get full message content including tool arguments and results. This will only return the high detail version of a single message part at a time.
- Use \`partIndex\` with a cursor to fetch a single part at full detail — for example, to read one specific tool result or code block without loading every part.

If the result says \`truncated: true\`, the output was cut to fit the token budget. You can paginate or use \`partIndex\` to target specific content.

### Following up on truncated parts
Low-detail results may include truncation hints like:
\`[truncated — call recall cursor="..." partIndex=N detail="high" for full content]\`

**When you see these hints and need the full content, make the exact call described in the hint.** This is the normal workflow: first recall at low detail to scan, then drill into specific parts at high detail. Do not stop at the low-detail result if the user asked for exact content.

### When recall is NOT needed
- The user is asking for a high-level summary and your observations already cover it
- The question is about general preferences or facts that don't require source text
- There is no relevant range in your observations for the topic

Observation groups with range IDs and your recall tool allows you to think back and remember details you're fuzzy on.`;
