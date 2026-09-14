import type { Mastra } from '../mastra';
import type { RequestContext } from '../request-context';

/** Static value or callback resolving a value from the current request context. */
// Preserve the source-derived identity of the destructured binding.
// oxfmt-ignore
export type DynamicArgument<T, TRequestContext extends Record<string, any> | unknown = unknown> =
  | T
  | ((
    /** Request-scoped dependencies available when resolving the value. */
    {
      requestContext,
      mastra,
    }: {
      /** Request context passed to the dynamic value resolver. */
      requestContext: RequestContext<TRequestContext>;
      /** Mastra instance, when available to the resolver. */
      mastra?: Mastra;
    }) => Promise<T> | T);

/** Excludes the empty string literal from a string type. */
export type NonEmpty<T extends string> = T extends '' ? never : T;

/**
 * Context information passed to the ID generator function.
 * This allows users to generate context-aware IDs based on the context
 * in which the ID is being generated.
 */
export type IdGeneratorContext = {
  /**
   * The type of ID being generated.
   * - 'thread': A conversation thread ID
   * - 'message': A message within a thread
   * - 'run': An agent or workflow execution run
   * - 'step': A workflow step
   * - 'generic': A generic ID with no specific type
   */
  idType: 'thread' | 'message' | 'run' | 'step' | 'generic';

  /**
   * The Mastra primitive requesting the ID.
   */
  source?: 'agent' | 'workflow' | 'memory';

  /**
   * The ID of the entity (agent, workflow, etc.) requesting the ID.
   */
  entityId?: string;

  /**
   * The thread ID, if applicable (e.g., for message IDs).
   */
  threadId?: string;

  /**
   * The resource ID, if applicable (e.g., user ID for threads).
   */
  resourceId?: string;

  /**
   * The message role, if generating a message ID.
   */
  role?: string;

  /**
   * The step type, if generating a workflow step ID.
   */
  stepType?: string;
};

/**
 * Custom ID generator function for creating unique identifiers.
 * Receives optional context about what type of ID is being generated
 * and where it's being requested from.
 *
 * @example
 * ```typescript
 * const mastra = new Mastra({
 *   idGenerator: (context) => {
 *     if (context?.idType === 'message' && context?.threadId) {
 *       return `msg-${context.threadId}-${Date.now()}`;
 *     }
 *     if (context?.idType === 'run' && context?.entityId) {
 *       return `run-${context.entityId}-${Date.now()}`;
 *     }
 *     return crypto.randomUUID();
 *   }
 * });
 * ```
 */
export type MastraIdGenerator = (
  /** Identity category and originating primitive, when supplied. */
  context?: IdGeneratorContext,
) => NonEmpty<string>;
