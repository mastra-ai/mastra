import type { Mastra } from '../mastra';
import type { RequestContext } from '../request-context';

export type DynamicArgument<T> =
  | T
  | (({ requestContext, mastra }: { requestContext: RequestContext; mastra?: Mastra }) => Promise<T> | T);

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
export type MastraIdGenerator = (context?: IdGeneratorContext) => NonEmpty<string>;
