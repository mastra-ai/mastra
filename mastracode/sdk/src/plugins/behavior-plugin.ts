import { BehaviorSignalProvider, InMemoryBehaviorRuntimeStore, loadBehaviorDirectory } from '@mastra/behaviors';
import type { BehaviorRuntimeStore, NormalizedBehaviorDefinition } from '@mastra/behaviors';

import { resolveModel } from '../agents/model.js';
import type { MastraCodePlugin } from '../plugin.js';

export type MastraCodeBehaviorPluginOptions = {
  id: string;
  name?: string;
  version?: string;
  definition: NormalizedBehaviorDefinition | string;
  store?: BehaviorRuntimeStore;
};

/** Creates a thin Mastra Code plugin backed by the shared behavior signal provider. */
export function createMastraCodeBehaviorPlugin(options: MastraCodeBehaviorPluginOptions): MastraCodePlugin {
  return {
    id: options.id,
    name: options.name ?? options.id,
    version: options.version ?? '1.0.0',
    description: 'Govern the Mastra Code agent with a durable behavior tree',
    signalProviders: async context => {
      const definition =
        typeof options.definition === 'string'
          ? await loadBehaviorDirectory(
              options.definition.startsWith('/') ? options.definition : `${context.cwd}/${options.definition}`,
            )
          : options.definition;
      return [
        new BehaviorSignalProvider({
          definition,
          store: options.store ?? new InMemoryBehaviorRuntimeStore(),
          resolveThreadId: requestContext => {
            const controller = requestContext?.get('controller') as { threadId?: string } | undefined;
            return controller?.threadId ?? requestContext?.get('threadId');
          },
          resolveModel: (model, { requestContext }) => resolveModel(model, { requestContext }),
          unavailableModel: 'error',
        }),
      ];
    },
  };
}
