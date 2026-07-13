import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BehaviorSignalProvider, InMemoryBehaviorRuntimeStore, loadBehaviorDirectory } from '@mastra/behaviors';
import type { BehaviorResolver, BehaviorRuntimeStore } from '@mastra/behaviors';

import { resolveModel } from '../agents/model.js';
import type { MastraCodePlugin } from '../plugin.js';

export type MastraCodeBehaviorPluginOptions = {
  id: string;
  name?: string;
  version?: string;
  resolver: BehaviorResolver | string;
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
      const resolver =
        typeof options.resolver === 'string'
          ? await loadBehaviorDirectory(
              options.resolver.startsWith('/') ? options.resolver : `${context.cwd}/${options.resolver}`,
              options.id,
            )
          : options.resolver;
      return [
        new BehaviorSignalProvider({
          resolver,
          store: options.store ?? new InMemoryBehaviorRuntimeStore(),
          resolveThreadId: requestContext => {
            const controller = requestContext?.get('controller') as { threadId?: string } | undefined;
            return controller?.threadId ?? requestContext?.get('threadId');
          },
          resolveModel: (model, { requestContext }) => resolveModel(model, { requestContext }),
          resolveSkillInstructions: async skills =>
            Promise.all(
              skills.map(async skill => {
                try {
                  return await readFile(join(skill, 'SKILL.md'), 'utf8');
                } catch {
                  return await readFile(skill, 'utf8');
                }
              }),
            ),
          unavailableModel: 'error',
        }),
      ];
    },
  };
}
