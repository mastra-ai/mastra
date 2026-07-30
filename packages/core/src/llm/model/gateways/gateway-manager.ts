import { MastraError } from '../../../error/index.js';
import { parseModelRouterId } from '../gateway-resolver.js';
import type { GatewayAuthRequest, GatewayAuthResult, MastraModelGatewayInterface, ProviderConfig } from './base.js';
import { findGatewayForModel, getGatewayId, shouldEnableGateway } from './gateway-helpers.js';

/**
 * MastraError IDs that represent expected "auth not available" states —
 * missing credentials, missing gateway config, or no matching gateway.
 * These are safe to surface as `hasAuth === false` for catalog/UI checks.
 */
const MISSING_AUTH_ERROR_IDS = new Set<string>([
  'MODEL_ROUTER_NO_GATEWAY_FOUND',
  'MASTRA_GATEWAY_NO_API_KEY',
  'NETLIFY_GATEWAY_NO_TOKEN',
  'NETLIFY_GATEWAY_NO_SITE_ID',
  'AZURE_ENTRA_ID_AUTH_NOT_CONFIGURED',
]);

/**
 * Returns true for errors that represent an expected "auth not available"
 * state (no matching gateway, missing credentials/env vars, missing provider
 * config). Real gateway failures (token exchange errors, network bugs,
 * malformed auth hooks) are not matched here so {@link hasAuth} can re-throw
 * them instead of silently hiding them.
 */
function isExpectedMissingAuthError(error: unknown): boolean {
  if (error instanceof MastraError) {
    return MISSING_AUTH_ERROR_IDS.has(error.id);
  }
  if (error instanceof Error) {
    const msg = error.message;
    return (
      /Missing [^ ]+ environment variable/i.test(msg) ||
      /Could not find API key/i.test(msg) ||
      /no api key/i.test(msg) ||
      /Could not find config for provider/i.test(msg) ||
      /Could not identify provider/i.test(msg)
    );
  }
  return false;
}

/**
 * A model entry in the gateway catalog (without use-count tracking).
 */
export interface GatewayModel {
  /** Full model ID (e.g., "anthropic/claude-sonnet-4-20250514") */
  id: string;
  /** Provider prefix (e.g., "anthropic" or "netlify/anthropic") */
  provider: string;
  /** Model name without provider prefix */
  modelName: string;
  /** Whether the provider has valid authentication */
  hasApiKey: boolean;
  /** Environment variable for the provider's API key */
  apiKeyEnvVar?: string;
}

/**
 * Centralises the gateway-chain operations shared between
 * {@link ModelRouterLanguageModel} and the AgentController: gateway merging, model
 * routing, auth resolution, and provider/model listing.
 *
 * The manager owns the *gateway registry* (which gateway owns a model, auth
 * resolution through the chain). Per-instance concerns (explicit config,
 * model-instance caching, websocket/transport, doGenerate/doStream) remain in
 * the consumers.
 */
export class GatewayManager {
  readonly gateways: MastraModelGatewayInterface[];

  constructor(gateways: MastraModelGatewayInterface[] = []) {
    // Filter disabled gateways and deduplicate by gateway ID (first wins).
    // Callers pass custom gateways before default gateways, so first-wins
    // preserves custom-over-default precedence in a single place.
    const seen = new Set<string>();
    this.gateways = gateways.filter(gateway => {
      if (!shouldEnableGateway(gateway)) return false;
      const id = getGatewayId(gateway);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  /**
   * Returns the gateway prefix used for model-id parsing.
   * `models.dev` is a provider registry and doesn't use a prefix.
   */
  static getPrefix(gatewayId: string): string | undefined {
    return gatewayId === 'models.dev' ? undefined : gatewayId;
  }

  /**
   * Returns the prefix to use when parsing `routerId` for the given gateway.
   * A gateway may claim an unprefixed id (e.g. `handlesModel` matching a bare
   * `anthropic/...` id); in that case the gateway's prefix does not appear in
   * the id, so parse it as an unprefixed `provider/model` id.
   */
  private static getPrefixForId(gatewayId: string, routerId: string): string | undefined {
    const prefix = GatewayManager.getPrefix(gatewayId);
    if (prefix && !routerId.startsWith(`${prefix}/`)) {
      return undefined;
    }
    return prefix;
  }

  /** Find the gateway that handles a given model/router id. */
  findGatewayForModel(routerId: string): MastraModelGatewayInterface {
    return findGatewayForModel(routerId, this.gateways);
  }

  /**
   * Resolve the gateway and parsed provider/model components for a router id
   * in a single pass. Centralises gateway selection + id parsing so callers
   * (router constructor, doGenerate/doStream, supportedUrls) don't each
   * re-derive the gateway and prefix separately.
   */
  resolveModelId(routerId: string): {
    gateway: MastraModelGatewayInterface;
    gatewayId: string;
    providerId: string;
    modelId: string;
  } {
    const gateway = this.findGatewayForModel(routerId);
    const gatewayId = getGatewayId(gateway);
    const { providerId, modelId } = parseModelRouterId(routerId, GatewayManager.getPrefixForId(gatewayId, routerId));
    return { gateway, gatewayId, providerId, modelId };
  }

  /** Parse a router id into its provider/model/gateway components. */
  parseModelId(routerId: string): { providerId: string; modelId: string; gatewayId: string } {
    const { gatewayId, providerId, modelId } = this.resolveModelId(routerId);
    return { providerId, modelId, gatewayId };
  }

  /**
   * Resolve auth through the gateway chain: select the gateway via
   * {@link findGatewayForModel}, try its `resolveAuth()` (OAuth / stored
   * credentials), and fall back to `getApiKey()` (which, for registry /
   * openai-compatible providers, reads the API-key env var).
   *
   * The caller is responsible for merging any explicit headers/credentials
   * from per-instance config on top of the result returned here.
   */
  async resolveAuth(routerId: string): Promise<GatewayAuthResult> {
    const { gateway, gatewayId, providerId, modelId } = this.resolveModelId(routerId);
    const request: GatewayAuthRequest = { gatewayId, providerId, modelId, routerId };

    const rawGatewayAuth = await gateway.resolveAuth?.(request);
    const gatewayAuth = rawGatewayAuth?.bearerToken
      ? {
          ...rawGatewayAuth,
          headers: { ...rawGatewayAuth.headers, Authorization: `Bearer ${rawGatewayAuth.bearerToken}` },
        }
      : rawGatewayAuth;

    if (gatewayAuth?.apiKey || gatewayAuth?.headers || gatewayAuth?.bearerToken) {
      return {
        ...gatewayAuth,
        source: gatewayAuth.source ?? 'gateway',
      };
    }

    return {
      apiKey: await gateway.getApiKey(routerId),
      source: 'legacy',
    };
  }

  /**
   * Convenience: whether auth is available for a model.
   * Returns `false` for expected missing-auth states (no matching gateway,
   * missing credentials/env vars) but re-throws unexpected errors (token
   * exchange failures, network bugs, malformed auth hooks) so they surface
   * instead of being silently hidden.
   */
  async hasAuth(routerId: string): Promise<boolean> {
    try {
      const auth = await this.resolveAuth(routerId);
      return Boolean(auth.apiKey || auth.bearerToken || auth.headers);
    } catch (error) {
      if (isExpectedMissingAuthError(error)) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Fetch and flatten providers from all gateways, deduped by provider key
   * (configured / earlier gateway wins). Each gateway's `fetchProviders()`
   * is a network call for gateways like models.dev / Netlify.
   */
  async listProviders(): Promise<Record<string, ProviderConfig & { gateway: string }>> {
    const registry: Record<string, ProviderConfig & { gateway: string }> = {};

    for (const gateway of this.gateways) {
      try {
        const gatewayProviders = await gateway.fetchProviders();
        for (const [providerId, config] of Object.entries(gatewayProviders)) {
          const key = this.getProviderKey(gateway, providerId);
          if (key in registry) continue; // earlier (configured) gateway wins
          registry[key] = { ...config, gateway: getGatewayId(gateway) };
        }
      } catch (error) {
        console.warn(`Failed to load providers from gateway ${getGatewayId(gateway)}:`, error);
      }
    }

    return registry;
  }

  /**
   * Build the model catalog from gateway providers, resolving auth per
   * provider (using the first model). Returns models without use-count.
   */
  async listAvailableModels(): Promise<GatewayModel[]> {
    const registry = await this.listProviders();
    const models: GatewayModel[] = [];

    for (const [provider, providerConfig] of Object.entries(registry)) {
      const apiKeyEnvVar = Array.isArray(providerConfig.apiKeyEnvVar)
        ? providerConfig.apiKeyEnvVar[0]
        : providerConfig.apiKeyEnvVar;
      const modelNames = providerConfig.models;
      if (!Array.isArray(modelNames)) continue;

      // Auth is resolved once per provider (using the first model) via the
      // gateway chain, then applied to every model the provider exposes.
      const hasApiKey = modelNames[0] ? await this.hasAuth(`${provider}/${modelNames[0]}`) : false;

      for (const modelName of modelNames) {
        models.push({
          id: `${provider}/${modelName}`,
          provider,
          modelName,
          hasApiKey,
          apiKeyEnvVar: apiKeyEnvVar || undefined,
        });
      }
    }

    return models;
  }

  /** Provider key used for catalog ids: prefix with the gateway id unless it's the prefix-less models.dev registry. */
  private getProviderKey(gateway: MastraModelGatewayInterface, providerId: string): string {
    const gatewayId = getGatewayId(gateway);
    if (gatewayId === 'models.dev') return providerId;
    return providerId === gatewayId ? gatewayId : `${gatewayId}/${providerId}`;
  }
}
