import { claudeOAuthProvider } from "../claude/oauth"
import { codexOAuthProvider } from "../codex/oauth"
import { OAuthProviderId, OAuthProviderInterface } from "../storage/types"

const oauthProviderRegistry = new Map<string, OAuthProviderInterface>([
    [claudeOAuthProvider.id, claudeOAuthProvider],
    [codexOAuthProvider.id, codexOAuthProvider],
])

/**
 * Get an OAuth provider by ID
 */
export function getOAuthProvider(
    id: OAuthProviderId,
): OAuthProviderInterface | undefined {
    return oauthProviderRegistry.get(id)
}

/**
 * Get all registered OAuth providers
 */
export function getOAuthProviders(): OAuthProviderInterface[] {
    return Array.from(oauthProviderRegistry.values())
}