import { createAnthropic } from "@ai-sdk/anthropic"
import type { MastraModelConfig } from "@mastra/core/llm"
import { wrapLanguageModel } from "ai"
import { claudeCodeMiddleware, promptCacheMiddleware } from "./middleware"
import { getAuthStorage } from "../storage-singleton"

/**
 * Creates an Anthropic model using Claude Max OAuth authentication
 * Uses OAuth tokens from AuthStorage (auto-refreshes when needed)
 */
export function opencodeClaudeMaxProvider(
    modelId: string = "claude-sonnet-4-20250514",
): MastraModelConfig {
    // Test environment: use API key
    if (process.env.NODE_ENV === "test" || process.env.VITEST) {
        const anthropic = createAnthropic({
            apiKey: process.env.ANTHROPIC_API_KEY || "test-api-key",
        })
        return wrapLanguageModel({
            model: anthropic(modelId),
            middleware: [claudeCodeMiddleware, promptCacheMiddleware],
        })
    }

    // Custom fetch that handles OAuth
    const oauthFetch = async (
        url: string | URL | Request,
        init?: Parameters<typeof fetch>[1],
    ) => {
        const authStorage = getAuthStorage()

        // Reload from disk to handle multi-instance refresh
        authStorage.reload()

        // Get access token (auto-refreshes if expired)
        const accessToken = await authStorage.getApiKey("anthropic")

        if (!accessToken) {
            throw new Error("Not logged in to Anthropic. Run /login first.")
        }

        // Make request with OAuth headers
        return fetch(url, {
            ...init,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "anthropic-beta":
                    "oauth-2025-04-20,claude-code-20250219,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14",
                "anthropic-version": "2023-06-01",
            },
        })
    }

    const anthropic = createAnthropic({
        // Provide a dummy API key - the actual auth is handled via OAuth in oauthFetch
        // This prevents the SDK from throwing "API key is missing" at model creation time
        apiKey: "oauth-placeholder",
        fetch: oauthFetch as any,
    })

    // Wrap with middleware to inject Claude Code identity and enable prompt caching
    return wrapLanguageModel({
        model: anthropic(modelId),
        middleware: [claudeCodeMiddleware, promptCacheMiddleware],
    })
}