import { MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';
import { createSocSupervisor } from '../../src/mastra/agents/soc-supervisor.js';
import { createIdentityInvestigator } from '../../src/mastra/agents/identity-investigator.js';
import { createEndpointInvestigator } from '../../src/mastra/agents/endpoint-investigator.js';
import { createCloudInvestigator } from '../../src/mastra/agents/cloud-investigator.js';

const textResult = (text: string) => ({
  content: [{ type: 'text' as const, text }],
  finishReason: 'stop' as const,
  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
  warnings: [],
});
export function nativeReviewSupervisor() {
  const childModel = new MastraLanguageModelV2Mock({
    doGenerate: async options => {
      const text = options.prompt
        .flatMap(message =>
          message.role === 'user' ? message.content.flatMap(part => (part.type === 'text' ? [part.text] : [])) : [],
        )
        .join('\n');
      const raw = text.match(/<prompt-safe-facts>(.*?)<\/prompt-safe-facts>/su)?.[1];
      if (!raw) throw new Error('missing server token facts');
      const facts = JSON.parse(raw) as { factToken: string }[];
      return textResult(
        JSON.stringify({
          citedFactTokens: facts.map(fact => fact.factToken),
          gaps: [],
          contradictionFlags: [],
        }),
      );
    },
  });
  const parentModel = new MastraLanguageModelV2Mock({
    doGenerate: async options => {
      for (const message of options.prompt)
        if (message.role === 'tool')
          for (const part of message.content) {
            if (part.type === 'tool-result' && part.output.type === 'text') return textResult(part.output.value);
          }
      const text = options.prompt
        .flatMap(message =>
          message.role === 'user' ? message.content.flatMap(part => (part.type === 'text' ? [part.text] : [])) : [],
        )
        .join('\n');
      const source = text.match(/agent-(identity|endpoint|cloud)Investigator/u)?.[1];
      if (!source) throw new Error('missing fixed source');
      return {
        ...textResult(''),
        content: [
          {
            type: 'tool-call' as const,
            toolCallId: `delegate-${source}`,
            toolName: `agent-${source}Investigator`,
            input: JSON.stringify({
              prompt: 'model supplied prompt replaced by server',
            }),
          },
        ],
        finishReason: 'tool-calls' as const,
      };
    },
  });
  const supervisor = createSocSupervisor(parentModel, {
    identityInvestigator: createIdentityInvestigator(childModel),
    endpointInvestigator: createEndpointInvestigator(childModel),
    cloudInvestigator: createCloudInvestigator(childModel),
  });
  return { supervisor, parentModel, childModel };
}
