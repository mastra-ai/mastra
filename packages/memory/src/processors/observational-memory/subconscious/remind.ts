import { Agent } from '@mastra/core/agent';
import { canonicalizeKnowledgeScope } from '@mastra/core/storage';

import { Extractor } from '../extractor';
import { publishSubconsciousActivity } from './activity';
import { createKnowledgeTools } from './knowledge-tools';
import type { ResolvedSubconsciousAgent } from './types';

const NO_REMINDER = '<no-reminder />';
const DEFAULT_INSTRUCTIONS = `Review the current observations and use the knowledge tools to find prior knowledge that is directly relevant now.

Be selective. Treat future-dated facts as relevant when their time is imminent or useful to the current task. When the observations show whether an earlier reminder was used, tune your selectivity accordingly without storing hit/miss counters.
If nothing is relevant, respond with exactly ${NO_REMINDER} and nothing else.
If knowledge is relevant, return one concise reminder that explains why it matters and includes source record or fact IDs. Do not invent knowledge and do not expose knowledge outside the tools' scoped results.`;

function resolveScope(context: {
  requestContext?: { get(key: string): unknown };
  resourceId?: string;
  threadId: string;
}) {
  const organizationId = context.requestContext?.get('organizationId');
  if (typeof organizationId !== 'string' || !organizationId.trim()) {
    throw new Error('Subconscious remind requires organizationId in the request context.');
  }
  if (!context.resourceId) {
    throw new Error('Subconscious remind requires a resourceId.');
  }

  return canonicalizeKnowledgeScope([
    `org:${organizationId}`,
    `resource:${context.resourceId}`,
    `thread:${context.threadId}`,
  ]);
}

export class SubconsciousRemindExtractor extends Extractor<string> {
  constructor(config: ResolvedSubconsciousAgent) {
    super({
      name: 'Remind',
      mode: 'hook',
      metadataKeyPath: false,
      onExtracted: async context => {
        if (!context.rawObservations?.trim() || !context.memory || !context.mainAgent || !context.sendSignal) {
          return;
        }

        const scope = resolveScope(context);
        try {
          const model = await context.mainAgent.getModel({
            requestContext: context.requestContext,
            ...(config.model ? { modelConfig: config.model } : {}),
          });
          const agent = new Agent({
            id: `subconscious-remind-${context.threadId}`,
            name: 'Subconscious Remind',
            instructions: [DEFAULT_INSTRUCTIONS, config.instructions?.trim()].filter(Boolean).join('\n\n'),
            model,
            tools: createKnowledgeTools(context.memory, scope),
          });
          const result = await agent.generate(
            `Current time: ${new Date().toISOString()}\n\nCurrent observations:\n${context.rawObservations}`,
            {
              requestContext: context.requestContext,
              maxSteps: config.maxSteps,
            },
          );
          const reminder = result.text.trim();
          if (!reminder || reminder === NO_REMINDER || reminder === '<no-reminder/>') {
            return;
          }

          await context.sendSignal({
            id: `__subconscious_remembered_${crypto.randomUUID()}`,
            type: 'reactive',
            tagName: 'remembered',
            contents: reminder,
            createdAt: new Date(),
            attributes: {
              source: 'subconscious',
              agent: 'remind',
              threadId: context.threadId,
            },
          });
        } catch (error) {
          const store = await context.memory.storage.getStore('knowledge');
          if (store) {
            await publishSubconsciousActivity({
              store,
              scope,
              recentUpdates: 10,
              sendStateSignal: context.sendStateSignal,
              errors: [`remind: ${error instanceof Error ? error.message : String(error)}`],
            });
          }
          throw error;
        }
      },
    });
  }
}
