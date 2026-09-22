import type { Agent } from '@mastra/core/agent';
import { RequestContext } from '@mastra/core/request-context';
import { DomainError } from '../../domain/errors.js';
import type { EvidenceSourceV1 } from '../../evidence/contracts.js';
import {
  InvestigatorOutputSchema,
  investigatorPrompt,
  UNTRUSTED_DATA_INSTRUCTIONS,
  type InvestigatorInvoker,
  type InvestigatorOutput,
} from './investigator-output.js';

/** Provider collection stays in the graph. Native delegation only validates its
 * token projection; neither model owns scope, evidence metadata or capabilities. */
export function createDelegatedInvestigator(supervisor: Agent, source: EvidenceSourceV1): InvestigatorInvoker {
  return async (input, _attempt, signal) => {
    const childPrompt = investigatorPrompt(input);
    const expectedTokens = input.facts.map(fact => fact.factToken);
    const expectedId = `${source}-investigator`;
    let started = 0;
    let failed = false;
    let childOutput: InvestigatorOutput | undefined;
    const reject = (): never => {
      failed = true;
      throw new DomainError('VALIDATION_FAILED');
    };
    const validate = (text: string) => {
      let output: InvestigatorOutput;
      try {
        // Models can wrap otherwise valid JSON in a Markdown code fence.
        // Accept only a whole fenced document; field and token checks stay strict.
        const json = text.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/u, '$1');
        output = InvestigatorOutputSchema.parse(JSON.parse(json));
      } catch {
        return reject();
      }
      if (
        output.gaps.length ||
        output.contradictionFlags.length ||
        JSON.stringify(output.citedFactTokens) !== JSON.stringify(expectedTokens)
      )
        return reject();
      return output;
    };
    const response = await supervisor.generate(
      `Delegate exactly once to agent-${source}Investigator to validate the server-supplied fact tokens. Then return the child's JSON unchanged. No other delegation or capability is permitted.`,
      {
        maxSteps: 2,
        requestContext: new RequestContext(),
        ...(signal ? { abortSignal: signal } : {}),
        delegation: {
          hookErrorStrategy: 'throw',
          messageFilter: () => [],
          onDelegationStart: context => {
            if (
              context.primitiveType !== 'agent' ||
              context.primitiveId !== expectedId ||
              started !== 0 ||
              context.params.threadId ||
              context.params.resourceId
            )
              return reject();
            started += 1;
            return {
              proceed: true,
              modifiedPrompt: childPrompt,
              modifiedInstructions: `${UNTRUSTED_DATA_INSTRUCTIONS}\nReturn only this JSON object, with no Markdown or additional fields: ${JSON.stringify({ citedFactTokens: expectedTokens, gaps: [], contradictionFlags: [] })}. Do not call tools.`,
              modifiedMaxSteps: 1,
            };
          },
          onDelegationComplete: context => {
            if (
              !context.success ||
              context.primitiveId !== expectedId ||
              started !== 1 ||
              childOutput ||
              context.result.finishReason !== 'stop' ||
              (context.result.subAgentToolResults?.length ?? 0) !== 0
            )
              return reject();
            childOutput = validate(context.result.text);
            return { resultText: JSON.stringify(childOutput) };
          },
        },
      },
    );
    if (
      failed ||
      started !== 1 ||
      !childOutput ||
      response.toolCalls.length !== 1 ||
      response.toolCalls[0]?.payload.toolName !== `agent-${source}Investigator`
    )
      return reject();
    const parentOutput = validate(response.text);
    if (JSON.stringify(parentOutput) !== JSON.stringify(childOutput)) return reject();
    return childOutput;
  };
}
