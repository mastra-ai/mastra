/**
 * Example Convex Queries for Mastra
 *
 * Copy this to your `convex/mastra/queries.ts` file.
 * These queries enable real-time subscriptions in your React app.
 */

export {
  // ============================================================================
  // Live Queries (Real-time subscriptions)
  // ============================================================================

  /**
   * Watch a single thread by ID.
   * Updates automatically when the thread changes.
   *
   * @example
   * const thread = useQuery(api.mastra.queries.watchThread, { threadId: '...' });
   */
  watchThread,

  /**
   * Watch messages for a thread.
   * Updates automatically when messages are added/modified.
   *
   * @example
   * const messages = useQuery(api.mastra.queries.watchMessages, {
   *   threadId: '...',
   *   limit: 100,
   *   order: 'asc',
   * });
   */
  watchMessages,

  /**
   * Watch threads for a resource (user).
   *
   * @example
   * const threads = useQuery(api.mastra.queries.watchThreadsByResource, {
   *   resourceId: userId,
   *   limit: 20,
   * });
   */
  watchThreadsByResource,

  /**
   * Watch a specific workflow run.
   *
   * @example
   * const run = useQuery(api.mastra.queries.watchWorkflowRun, {
   *   workflowName: 'my-workflow',
   *   runId: 'run-123',
   * });
   */
  watchWorkflowRun,

  /**
   * Watch workflow runs for a workflow or resource.
   *
   * @example
   * const runs = useQuery(api.mastra.queries.watchWorkflowRuns, {
   *   workflowName: 'my-workflow',
   *   limit: 50,
   * });
   */
  watchWorkflowRuns,

  /**
   * Watch a resource's working memory.
   *
   * @example
   * const resource = useQuery(api.mastra.queries.watchResource, {
   *   resourceId: userId,
   * });
   */
  watchResource,

  // ============================================================================
  // Count Queries (Efficient aggregations)
  // ============================================================================

  /**
   * Count messages in a thread.
   * Returns { count, isEstimate } - isEstimate is true if > 1000.
   *
   * @example
   * const { count, isEstimate } = useQuery(api.mastra.queries.countMessages, {
   *   threadId: '...',
   * });
   */
  countMessages,

  /**
   * Count threads, optionally filtered by resource.
   *
   * @example
   * const { count } = useQuery(api.mastra.queries.countThreads, {
   *   resourceId: userId,
   * });
   */
  countThreads,

  /**
   * Count workflow runs with optional filters.
   *
   * @example
   * const { count } = useQuery(api.mastra.queries.countWorkflowRuns, {
   *   workflowName: 'my-workflow',
   * });
   */
  countWorkflowRuns,

  // ============================================================================
  // Paginated Queries (Cursor-based pagination)
  // ============================================================================

  /**
   * Paginated messages with cursor support.
   * Returns { items, nextCursor, hasMore }.
   *
   * @example
   * const [cursor, setCursor] = useState();
   * const result = useQuery(api.mastra.queries.paginatedMessages, {
   *   threadId: '...',
   *   cursor,
   *   limit: 20,
   * });
   * // Load more: setCursor(result.nextCursor)
   */
  paginatedMessages,

  /**
   * Paginated threads with cursor support.
   *
   * @example
   * const result = useQuery(api.mastra.queries.paginatedThreads, {
   *   resourceId: userId,
   *   cursor,
   *   limit: 20,
   * });
   */
  paginatedThreads,

  /**
   * Paginated workflow runs with cursor support.
   *
   * @example
   * const result = useQuery(api.mastra.queries.paginatedWorkflowRuns, {
   *   workflowName: 'my-workflow',
   *   cursor,
   *   limit: 20,
   * });
   */
  paginatedWorkflowRuns,

  // ============================================================================
  // Vector Search
  // ============================================================================

  /**
   * Vector similarity search.
   * Uses native vector index if available, falls back to brute-force.
   *
   * @example
   * const results = useQuery(api.mastra.queries.vectorSearch, {
   *   indexName: 'documents',
   *   queryVector: embedding,
   *   topK: 10,
   * });
   */
  vectorSearch,
} from '@mastra/convex/server';
