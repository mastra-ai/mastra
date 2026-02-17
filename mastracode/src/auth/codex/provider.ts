import { createOpenAI } from "@ai-sdk/openai"
import type { MastraModelConfig } from "@mastra/core/llm"
import { wrapLanguageModel } from "ai"
import { CODEX_API_ENDPOINT } from "./constants"
import { codexMiddleware } from "./middleware"
import { getAuthStorage } from "../storage-singleton"

/**
 * Creates an OpenAI model using ChatGPT OAuth authentication
 * Uses OAuth tokens from AuthStorage (auto-refreshes when needed)
 *
 * IMPORTANT: This uses the Codex API endpoint, not the standard OpenAI API.
 * URLs are rewritten from /v1/responses or /chat/completions to the Codex endpoint.
 */
export function codexProvider(
    modelId: string = "codex-mini-latest",
): MastraModelConfig {
    // Test environment: use API key
    if (process.env.NODE_ENV === "test" || process.env.VITEST) {
        const openai = createOpenAI({
            apiKey: process.env.OPENAI_API_KEY || "test-api-key",
        })
        return wrapLanguageModel({
            model: openai.responses(modelId),
            middleware: [codexMiddleware],
        })
    }

    // Custom fetch that handles OAuth and URL rewriting
    const oauthFetch = async (
        url: string | URL | Request,
        init?: Parameters<typeof fetch>[1],
    ) => {
        const authStorage = getAuthStorage()

        // Reload from disk to handle multi-instance refresh
        authStorage.reload()

        // Get credentials (includes accountId)
        const cred = authStorage.get("openai-codex")

        if (!cred || cred.type !== "oauth") {
            throw new Error("Not logged in to OpenAI Codex. Run /login first.")
        }

        // Check if token needs refresh
        let accessToken = cred.access
        if (Date.now() >= cred.expires) {
            // Token expired, need to refresh via getApiKey which handles refresh
            const refreshedToken = await authStorage.getApiKey("openai-codex")
            if (!refreshedToken) {
                throw new Error(
                    "Failed to refresh OpenAI Codex token. Please /login again.",
                )
            }
            accessToken = refreshedToken
            // Reload to get updated accountId
            authStorage.reload()
        }

        // Get accountId from credentials
        const accountId = (cred as any).accountId as string | undefined

        // Build headers - remove any existing authorization header first
        const headers = new Headers()
        if (init?.headers) {
            if (init.headers instanceof Headers) {
                init.headers.forEach((value, key) => {
                    if (key.toLowerCase() !== "authorization") {
                        headers.set(key, value)
                    }
                })
            } else if (Array.isArray(init.headers)) {
                for (const [key, value] of init.headers) {
                    if (key.toLowerCase() !== "authorization" && value !== undefined) {
                        headers.set(key, String(value))
                    }
                }
            } else {
                for (const [key, value] of Object.entries(init.headers)) {
                    if (key.toLowerCase() !== "authorization" && value !== undefined) {
                        headers.set(key, String(value))
                    }
                }
            }
        }

        // Set authorization header with access token
        headers.set("Authorization", `Bearer ${accessToken}`)

        // Set ChatGPT-Account-Id header for organization subscriptions
        if (accountId) {
            headers.set("ChatGPT-Account-Id", accountId)
        }

        // Rewrite URL to Codex endpoint if it's a chat/responses request
        const parsed =
            url instanceof URL
                ? url
                : new URL(typeof url === "string" ? url : (url as Request).url)

        const shouldRewrite =
            parsed.pathname.includes("/v1/responses") ||
            parsed.pathname.includes("/chat/completions")
        const finalUrl = shouldRewrite ? new URL(CODEX_API_ENDPOINT) : parsed

        return fetch(finalUrl, {
            ...init,
            headers,
        })
    }

    const openai = createOpenAI({
        // Use a dummy API key since we're using OAuth
        apiKey: "oauth-dummy-key",
        fetch: oauthFetch as any,
    })

    // Use the responses API for Codex models
    // Wrap with middleware
    return wrapLanguageModel({
        model: openai.responses(modelId),
        middleware: [codexMiddleware],
    })
}