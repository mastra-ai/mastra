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
export const OBSERVATION_CONTINUATION_HINT = `This message is not from the user, the conversation history grew too long and wouldn't fit in context! Thankfully the entire conversation is stored in your memory observations. Please continue from where the observations left off. Do not refer to your "memory observations" directly, the user doesn't know about them, they are your memories! Just respond naturally as if you're remembering the conversation (you are!). Do not say "Hi there!" or "based on our previous conversation" as if the conversation is just starting, this is not a new conversation. This is an ongoing conversation, keep continuity by responding based on your memory. For example do not say "I understand. I've reviewed my memory observations", or "I remember [...]". Answer naturally following the suggestion from your memory. Note that your memory may contain a suggested first response, which you should follow.

IMPORTANT: this system reminder is NOT from the user. The system placed it here as part of your memory system. This message is part of you remembering your conversation with the user.

NOTE: Any messages following this system reminder are newer than your memories.`;

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

MOST RECENT USER INPUT: Treat the most recent user message as the highest-priority signal for what to do next. Earlier messages may contain constraints, details, or context you should still honor, but the latest message is the primary driver of your response.`;
