import { LanguageModelMiddleware } from "ai"

/**
 * Prompt caching middleware for Anthropic
 *
 * Adds cache breakpoints at strategic locations:
 * 1. Last system message (end of static instructions + dynamic memory)
 * 2. Most recent user/assistant message (conversation context)
 *
 * This allows Anthropic to cache:
 * - System prompts and instructions (rarely change)
 * - Conversation history up to the last message
 */
export const promptCacheMiddleware: LanguageModelMiddleware = {
    specificationVersion: "v3",
    transformParams: async ({ params }) => {
        const prompt = [...params.prompt]

        const cacheControl = { type: "ephemeral" as const, ttl: "5m" as const }

        // Helper to add cache control to a message's last content part
        const addCacheToMessage = (msg: any) => {
            // For system messages with string content
            if (typeof msg.content === "string") {
                return {
                    ...msg,
                    providerOptions: {
                        ...msg.providerOptions,
                        anthropic: { ...msg.providerOptions?.anthropic, cacheControl },
                    },
                }
            }

            // For messages with array content, add to last part
            if (Array.isArray(msg.content) && msg.content.length > 0) {
                const content = [...msg.content]
                const lastPart = content[content.length - 1]
                content[content.length - 1] = {
                    ...lastPart,
                    providerOptions: {
                        ...lastPart.providerOptions,
                        anthropic: { ...lastPart.providerOptions?.anthropic, cacheControl },
                    },
                }
                return { ...msg, content }
            }

            return msg
        }

        // Find the last system message index
        let lastSystemIdx = -1
        for (let i = prompt.length - 1; i >= 0; i--) {
            if ((prompt[i] as any).role === "system") {
                lastSystemIdx = i
                break
            }
        }

        // Add cache breakpoint to last system message
        if (lastSystemIdx >= 0) {
            prompt[lastSystemIdx] = addCacheToMessage(prompt[lastSystemIdx])
        }

        // Add cache breakpoint to the most recent message (last in array)
        const lastIdx = prompt.length - 1
        if (lastIdx >= 0 && lastIdx !== lastSystemIdx) {
            prompt[lastIdx] = addCacheToMessage(prompt[lastIdx])
        }

        return { ...params, prompt }
    },
}

// Required for Claude Max plan OAuth - the endpoint checks for this system message
const claudeCodeIdentity =
    "You are Claude Code, Anthropic's official CLI for Claude."

/**
 * Middleware that injects the Claude Code identity system message
 * Required for Claude Max OAuth authentication
 */
export const claudeCodeMiddleware: LanguageModelMiddleware = {
    specificationVersion: "v3",
    transformParams: async ({ params }) => {
        // Prepend the Claude Code identity as the first system message
        const systemMessage = {
            role: "system" as const,
            content: claudeCodeIdentity,
        }

        if (params.temperature) {
            delete params.topP
        }

        return {
            ...params,
            prompt: [systemMessage, ...params.prompt],
        }
    },
}