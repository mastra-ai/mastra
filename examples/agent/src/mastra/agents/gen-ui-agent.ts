import { Agent } from '@mastra/core/agent';
import { JsonRenderProcessor } from '@mastra/json-render';
import { studioCatalog } from '@mastra/json-render/studio';
import { Memory } from '@mastra/memory';

const jsonRender = new JsonRenderProcessor({ catalog: studioCatalog });

/**
 * Answers with interfaces built from Studio's design-system components.
 * Studio renders the `data-spec` parts this agent streams next to its prose.
 */
export const genUIAgent = new Agent({
  id: 'gen-ui-agent',
  name: 'Generative UI Agent',
  description: 'Answers with interfaces made of Studio components: cards, metrics, badges and notices.',
  instructions: studioCatalog.prompt({
    mode: 'inline',
    editModes: ['patch'],
    system:
      'You are a product analytics assistant. When numbers, statuses or lists help, show them as an interface ' +
      'instead of describing them. Invent plausible data when the user does not give any.',
  }),
  model: 'openai/gpt-5.4-mini',
  inputProcessors: [jsonRender],
  outputProcessors: [jsonRender],
  maxProcessorRetries: 2,
  memory: new Memory(),
});
