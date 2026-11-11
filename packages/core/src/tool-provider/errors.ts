/**
 * Thrown when two {@link ToolProvider} entries share the same `id` during
 * editor / Mastra construction.
 */
export class DuplicateToolProviderError extends Error {
  readonly ids: readonly string[];

  constructor(ids: readonly string[]) {
    super(`Duplicate tool provider ids: ${ids.join(', ')}`);
    this.name = 'DuplicateToolProviderError';
    this.ids = ids;
  }
}

/**
 * Thrown when no registered tool provider matches the requested id.
 */
export class UnknownToolProviderError extends Error {
  readonly id: string;
  readonly knownIds: readonly string[];

  constructor(id: string, knownIds: readonly string[]) {
    super(`Unknown tool provider "${id}". Known ids: ${knownIds.length ? knownIds.join(', ') : '(none)'}`);
    this.name = 'UnknownToolProviderError';
    this.id = id;
    this.knownIds = knownIds;
  }
}

export class ToolProviderStepError extends Error {
  readonly providerId: string;
  readonly toolSlug: string;

  constructor(providerId: string, toolSlug: string, reason: string, options?: ErrorOptions) {
    super(`Failed to resolve provider tool "${providerId}/${toolSlug}": ${reason}`, options);
    this.name = 'ToolProviderStepError';
    this.providerId = providerId;
    this.toolSlug = toolSlug;
  }
}
