/**
 * Thrown when two {@link ToolIntegration} entries share the same `id` during
 * `MastraEditor` construction.
 */
export class DuplicateIntegrationError extends Error {
  readonly ids: readonly string[];

  constructor(ids: readonly string[]) {
    super(`Duplicate tool integration ids: ${ids.join(', ')}`);
    this.name = 'DuplicateIntegrationError';
    this.ids = ids;
  }
}

/**
 * Thrown by `MastraEditor.getToolIntegrationOrThrow` when no registered
 * integration matches the requested id.
 */
export class UnknownIntegrationError extends Error {
  readonly id: string;
  readonly knownIds: readonly string[];

  constructor(id: string, knownIds: readonly string[]) {
    super(`Unknown tool integration "${id}". Known ids: ${knownIds.length ? knownIds.join(', ') : '(none)'}`);
    this.name = 'UnknownIntegrationError';
    this.id = id;
    this.knownIds = knownIds;
  }
}
