import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { Agent } from '@mastra/core/agent';
import type { AgentConfig } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { MASTRA_RESOURCE_ID_KEY } from '@mastra/core/request-context';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { Observability, MastraStorageExporter, SensitiveDataFilter } from '@mastra/observability';
import { z } from 'zod';
import type { AssistantConfig } from './config';

function asObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;
}

export function createAssistant(config: AssistantConfig, model: AgentConfig['model'] = { id: config.model }) {
  const runLimits = z.object({ maxSteps: z.number().int().min(1).max(config.maxSteps).optional() });
  let storage: LibSQLStore;
  try {
    mkdirSync(dirname(config.databasePath), { recursive: true });
    storage = new LibSQLStore({ id: 'personal-assistant-storage', url: `file:${config.databasePath}` });
  } catch {
    throw new Error('Could not prepare assistant storage. Check ASSISTANT_DATA_DIR and directory permissions.');
  }
  const memory = new Memory({
    storage,
    options: {
      lastMessages: 40,
      semanticRecall: false,
      observationalMemory: false,
      generateTitle: false,
      workingMemory: {
        enabled: true,
        scope: 'resource',
        template: '# Owner profile\n\n## Preferences\n\n## Relevant long-term context\n',
      },
    },
  });
  const personalAssistant = new Agent({
    id: 'personal-assistant',
    name: 'Personal Assistant',
    instructions: `You are the owner's personal assistant. Help with questions, planning, and writing.
Remember explicit response preferences and relevant long-term context using working memory.
Preserve unrelated preferences when updating it. Never store credentials or permissions in memory.
Use preferences across conversations, while keeping each conversation's history in its own thread.
Be clear about what you can do: external services are not connected in this local assistant.
Do not claim to have searched accounts, changed external records, created goals, or scheduled work.
Ask for missing information and distinguish a proposed action from a completed action.
${config.timezone ? `The owner configured timezone ${config.timezone}.` : 'No scheduling timezone has been configured.'}`,
    model,
    scopes: [`resource:${config.ownerId}`],
    memory,
    defaultOptions: { maxSteps: config.maxSteps },
  });
  return new Mastra({
    agents: { personalAssistant },
    storage,
    server: {
      host: '127.0.0.1',
      middleware: [
        async (c, next) => {
          // Native handlers honor this server-owned value over request bodies and headers.
          c.get('requestContext').set(MASTRA_RESOURCE_ID_KEY, config.ownerId);
          if (c.req.method === 'POST' && c.req.path.includes('/agents/') && c.req.raw.body) {
            let value: unknown;
            try {
              const request = c.req.raw.clone();
              const contentType = c.req.header('content-type') || '';
              if (contentType.includes('multipart/form-data')) {
                const form = await request.formData();
                const fields: Record<string, unknown> = {};
                // Native Hono JSON-decodes form fields and uses the last duplicate value.
                for (const key of ['maxSteps', 'streamOptions', 'ifIdle']) {
                  const field = form.getAll(key).at(-1);
                  if (field === undefined) continue;
                  fields[key] = field;
                  if (typeof field === 'string') {
                    try {
                      fields[key] = JSON.parse(field);
                    } catch {}
                  }
                }
                value = fields;
              } else if (contentType.includes('application/json')) {
                value = await request.json();
              }
            } catch {
              // Native routes own malformed bodies and unsupported content types.
            }
            const body = asObject(value);
            // Only known execution-option objects are inspected, never message contents.
            const options = [body, asObject(body?.streamOptions), asObject(asObject(body?.ifIdle)?.streamOptions)];
            if (options.some(option => option && !runLimits.safeParse(option).success)) {
              return c.json({ error: `maxSteps must be an integer between 1 and ${config.maxSteps}.` }, 400);
            }
          }
          await next();
        },
      ],
    },
    observability: new Observability({
      configs: {
        default: {
          serviceName: 'personal-assistant',
          exporters: [new MastraStorageExporter()],
          spanOutputProcessors: [new SensitiveDataFilter()],
        },
      },
    }),
  });
}
