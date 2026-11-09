import type { Catalog, InferActionParams, InferCatalogActions, StateModel, StateStore } from '@json-render/core';
import type { GenUIContextStore } from './context-store';
import type { GenUIDefinition } from './definition';
import { validate } from './validate';

/**
 * What an action handler gets besides its params. `Chat` is whatever the host offers to talk to the agent:
 * a browser chat's send and approval calls, or a bot's reply.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export interface GenUIActionContext<Chat = unknown> {
  /** Spec tool call whose element raised the action. */
  toolCallId: string;
  chat: Chat;
  /** Values published for the agent with the next message. */
  context: GenUIContextStore;
  /** The spec's state as the user sees it. */
  state: StateModel;
  /** Write the spec's state at a JSON pointer, like a `setState` action. */
  setState(path: string, value: unknown): void;
}

/**
 * Handler for an app action declared in the catalog. Receives the params validated against the catalog's
 * `params` schema. Throwing reports the failure to json-render (`onError` bindings).
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export type GenUIActionHandler<P = Record<string, unknown>, Chat = unknown> = (
  params: P,
  context: GenUIActionContext<Chat>,
) => unknown | Promise<unknown>;

/**
 * Handlers for the catalog's actions, typed from their `params` schemas.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export type GenUIActionHandlers<C extends Catalog = Catalog, Chat = unknown> = {
  [K in keyof InferCatalogActions<C> & string]?: GenUIActionHandler<InferActionParams<C, K>, Chat>;
};

/** Where a spec's actions run: its tool call, its json-render state, and whether it may act right now. */
export interface GenUISpecActionScope {
  toolCallId: string;
  store: StateStore;
  /** Only a ready spec acts; a stopped, failed or still-streaming one reflects an outdated model view. */
  isReady(): boolean;
}

/** @experimental Generative UI is in beta and may change without notice. */
export interface CreateGenUIActionRunnerOptions<Chat> {
  definition: GenUIDefinition;
  context: GenUIContextStore;
  /** The handlers to run, read on each action so they can change. */
  handlers(): GenUIActionHandlers<Catalog, Chat>;
  /** The chat handed to handlers, read on each action. Throw when it is not ready. */
  chat(): Chat;
}

/** @experimental Generative UI is in beta and may change without notice. */
export interface GenUIActionRunner {
  /** json-render action handlers for one spec: one per catalog action. */
  handlersFor(scope: GenUISpecActionScope): Record<string, (params: Record<string, unknown>) => Promise<void>>;
  /** Forgets actions in flight, as when the conversation changes. */
  reset(): void;
}

/**
 * Runs a catalog's app actions: validates params against the catalog, skips specs that are not ready, and
 * runs one action per spec at a time so a double click does not run it twice.
 *
 * @experimental Generative UI is in beta and may change without notice.
 */
export function createGenUIActionRunner<Chat>(options: CreateGenUIActionRunnerOptions<Chat>): GenUIActionRunner {
  const { definition, context } = options;
  /** `toolCallId:action` pairs in flight. */
  const running = new Set<string>();

  const handlersFor = ({ toolCallId, store, isReady }: GenUISpecActionScope) =>
    Object.fromEntries(
      Object.values(definition.actions).map(({ name, params: schema }) => [
        name,
        async (raw: Record<string, unknown>) => {
          if (!isReady()) {
            console.warn(`[GenUI] Ignored action "${name}": spec "${toolCallId}" is not ready`);
            return;
          }
          const handler = options.handlers()[name];
          if (!handler) {
            console.warn(`[GenUI] No handler for action "${name}"`);
            return;
          }
          const key = `${toolCallId}:${name}`;
          if (running.has(key)) return;
          let params: unknown = raw ?? {};
          if (schema) {
            const validated = validate(schema, params);
            if (!validated.ok) {
              console.warn(`[GenUI] Ignored action "${name}": invalid params (${validated.error})`);
              return;
            }
            params = validated.value;
          }
          running.add(key);
          try {
            await handler(params, {
              toolCallId,
              chat: options.chat(),
              context,
              state: store.getSnapshot(),
              setState: (path, value) => store.set(path, value),
            });
          } finally {
            running.delete(key);
          }
        },
      ]),
    );

  return { handlersFor, reset: () => running.clear() };
}
