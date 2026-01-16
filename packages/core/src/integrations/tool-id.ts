/**
 * Tool ID Utilities
 *
 * This module provides utilities for generating and parsing integration tool IDs.
 * Tool IDs follow the format: `provider_toolkitSlug_toolSlug`
 *
 * @example
 * ```typescript
 * // Generate a tool ID
 * const id = generateToolId({
 *   provider: 'composio',
 *   toolkitSlug: 'github',
 *   toolSlug: 'GITHUB_CREATE_ISSUE'
 * });
 * // => 'composio_github_GITHUB_CREATE_ISSUE'
 *
 * // Parse a tool ID
 * const parsed = parseToolId('composio_github_GITHUB_CREATE_ISSUE');
 * // => { provider: 'composio', toolkitSlug: 'github', toolSlug: 'GITHUB_CREATE_ISSUE', valid: true }
 * ```
 */

import type { IntegrationProviderType } from './providers/types';

/** Separator used in tool IDs */
const TOOL_ID_SEPARATOR = '_';

/** Valid provider types for tool IDs */
const VALID_PROVIDERS: IntegrationProviderType[] = ['composio', 'arcade', 'mcp', 'smithery'];

/**
 * Parsed integration tool ID components
 */
export interface ParsedToolId {
  /** Integration provider type */
  provider: IntegrationProviderType;
  /** Toolkit/app slug */
  toolkitSlug: string;
  /** Tool slug (may contain underscores) */
  toolSlug: string;
  /** Whether parsing was successful */
  valid: boolean;
}

/**
 * Options for generating tool IDs
 */
export interface GenerateToolIdOptions {
  provider: IntegrationProviderType;
  toolkitSlug: string;
  toolSlug: string;
}

/**
 * Generate a consistent tool ID from components
 *
 * Format: `provider_toolkitSlug_toolSlug`
 *
 * @param options - The components to generate the tool ID from
 * @returns The generated tool ID string
 *
 * @example
 * ```typescript
 * generateToolId({
 *   provider: 'composio',
 *   toolkitSlug: 'github',
 *   toolSlug: 'GITHUB_CREATE_ISSUE'
 * });
 * // => 'composio_github_GITHUB_CREATE_ISSUE'
 * ```
 */
export function generateToolId(options: GenerateToolIdOptions): string {
  const { provider, toolkitSlug, toolSlug } = options;

  if (!provider || !toolkitSlug || !toolSlug) {
    throw new Error('generateToolId: provider, toolkitSlug, and toolSlug are all required');
  }

  return [provider, toolkitSlug, toolSlug].join(TOOL_ID_SEPARATOR);
}

/**
 * Parse a tool ID into its components
 *
 * Handles tool slugs that contain underscores by taking only
 * the first two parts as provider and toolkit.
 *
 * @param toolId - The tool ID string to parse
 * @returns Parsed components with validity flag
 *
 * @example
 * ```typescript
 * parseToolId('composio_github_GITHUB_CREATE_ISSUE');
 * // => {
 * //   provider: 'composio',
 * //   toolkitSlug: 'github',
 * //   toolSlug: 'GITHUB_CREATE_ISSUE',
 * //   valid: true
 * // }
 *
 * parseToolId('invalid');
 * // => { provider: '', toolkitSlug: '', toolSlug: '', valid: false }
 * ```
 */
export function parseToolId(toolId: string): ParsedToolId {
  if (!toolId || typeof toolId !== 'string') {
    return {
      provider: '' as IntegrationProviderType,
      toolkitSlug: '',
      toolSlug: '',
      valid: false,
    };
  }

  const parts = toolId.split(TOOL_ID_SEPARATOR);

  if (parts.length < 3) {
    return {
      provider: '' as IntegrationProviderType,
      toolkitSlug: '',
      toolSlug: '',
      valid: false,
    };
  }

  const [provider, toolkitSlug, ...toolSlugParts] = parts;
  const toolSlug = toolSlugParts.join(TOOL_ID_SEPARATOR);

  // Validate provider type
  const isValidProvider = VALID_PROVIDERS.includes(provider as IntegrationProviderType);

  return {
    provider: provider as IntegrationProviderType,
    toolkitSlug: toolkitSlug!,
    toolSlug,
    valid: isValidProvider && !!toolkitSlug && !!toolSlug,
  };
}

/**
 * Check if a string is a valid integration tool ID format
 *
 * @param toolId - The string to validate
 * @returns True if the string is a valid tool ID format
 */
export function isValidToolId(toolId: string): boolean {
  return parseToolId(toolId).valid;
}

/**
 * Extract provider from a tool ID without full parsing
 *
 * More efficient than parseToolId when you only need the provider.
 *
 * @param toolId - The tool ID string
 * @returns The provider type or null if invalid
 */
export function getProviderFromToolId(toolId: string): IntegrationProviderType | null {
  if (!toolId || typeof toolId !== 'string') {
    return null;
  }

  const firstUnderscoreIndex = toolId.indexOf(TOOL_ID_SEPARATOR);
  if (firstUnderscoreIndex === -1) {
    return null;
  }

  const provider = toolId.slice(0, firstUnderscoreIndex);

  return VALID_PROVIDERS.includes(provider as IntegrationProviderType)
    ? (provider as IntegrationProviderType)
    : null;
}

/**
 * Extract toolkit slug from a tool ID without full parsing
 *
 * @param toolId - The tool ID string
 * @returns The toolkit slug or null if invalid
 */
export function getToolkitFromToolId(toolId: string): string | null {
  if (!toolId || typeof toolId !== 'string') {
    return null;
  }

  const parts = toolId.split(TOOL_ID_SEPARATOR);
  if (parts.length < 3) {
    return null;
  }

  return parts[1] || null;
}

/**
 * Create a tool ID matcher function for filtering
 *
 * @param criteria - Criteria to match against
 * @returns A function that returns true if a tool ID matches the criteria
 *
 * @example
 * ```typescript
 * const isComposioGitHub = createToolIdMatcher({
 *   provider: 'composio',
 *   toolkitSlug: 'github'
 * });
 *
 * isComposioGitHub('composio_github_GITHUB_CREATE_ISSUE'); // true
 * isComposioGitHub('composio_slack_SLACK_SEND_MESSAGE'); // false
 * ```
 */
export function createToolIdMatcher(criteria: {
  provider?: IntegrationProviderType;
  toolkitSlug?: string;
}): (toolId: string) => boolean {
  return (toolId: string): boolean => {
    const parsed = parseToolId(toolId);
    if (!parsed.valid) {
      return false;
    }

    if (criteria.provider && parsed.provider !== criteria.provider) {
      return false;
    }

    if (criteria.toolkitSlug && parsed.toolkitSlug !== criteria.toolkitSlug) {
      return false;
    }

    return true;
  };
}
