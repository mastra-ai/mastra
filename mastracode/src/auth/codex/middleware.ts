import { LanguageModelMiddleware } from "ai"
import { CODEX_INSTRUCTIONS } from "./constants"

/**
 * Middleware for OpenAI Codex - handles any special transformations needed
 */
export const codexMiddleware: LanguageModelMiddleware = {
    specificationVersion: "v3",
    transformParams: async ({ params }) => {
        // Remove topP if temperature is set (OpenAI doesn't like both)
        if (params.temperature) {
            delete params.topP
        }

        // Codex API requires specific settings via providerOptions
        // Use type assertion to satisfy JSONValue constraints
        params.providerOptions = {
            ...params.providerOptions,
            openai: {
                ...(params.providerOptions?.openai ?? {}),
                // Codex API requires instructions
                instructions: CODEX_INSTRUCTIONS,
                // Codex API requires store to be false
                store: false,
            },
        } as typeof params.providerOptions

        return params
    },
}