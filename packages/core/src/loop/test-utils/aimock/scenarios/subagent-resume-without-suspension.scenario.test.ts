import { createOpenAI } from '@ai-sdk/openai-v5';
import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { Agent } from '../../../../agent';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';
import { SCENARIO_MODEL_ID } from '../types';

/**
 * A sub-agent delegation must not take the resume path just because the model
 * populated `resumeData`.
 *
 * `resumeData` is an always-exposed optional field on the generated sub-agent
 * tool schema, while the instruction explaining it is only injected when a
 * suspension actually exists. Models therefore fill it unprompted — and the
 * delegation step then called resumeGenerate/resumeStream with an undefined
 * runId, which threw AGENT_RESUME_NO_SNAPSHOT_FOUND before the sub-agent ever
 * ran.
 *
 * Ported from packages/core/src/agent/__tests__/subagent-resume-without-suspension.test.ts
 * to the cross-engine scenario matrix.
 *
 * Related: https://github.com/mastra-ai/mastra/issues/21608
 */

const SUB_AGENT_INSTRUCTIONS = 'Do the work described in the prompt.';

function mentionsNoSnapshotError(value: unknown): boolean {
  return JSON.stringify(value ?? '')?.includes('AGENT_RESUME_NO_SNAPSHOT_FOUND') ?? false;
}

describeForAllEngines('AIMock loop scenario: subagent resume without suspension', engine => {
  const getMock = useLoopScenarioAimock();

  it('runs the sub-agent instead of resuming when the model authors resumeData', async () => {
    const mock = getMock();

    // The sub-agent shares the same AIMock-backed provider as the supervisor.
    const openai = createOpenAI({
      apiKey: 'aimock-test-key',
      baseURL: `${mock.url.replace(/\/+$/, '')}/v1`,
    });

    const subAgent = new Agent({
      id: 'sub-agent',
      name: 'Sub Agent',
      description: 'Does the work.',
      instructions: SUB_AGENT_INSTRUCTIONS,
      model: openai(SCENARIO_MODEL_ID),
    });

    const { output, requests, chunks } = await runLoopScenario({
      engine,
      llm: mock,
      prompt: 'do the work',
      agents: { subAgent },
      stopWhen: stepCountIs(3),
      collectChunks: true,
      fixtures: llm => {
        // AIMock matches fixtures in registration order (first match wins), so
        // the sub-agent's fixture must come first: the supervisor's turn-1
        // matcher below (`hasToolResult: false`) would otherwise also match the
        // sub-agent's first request and feed it the delegation tool call.
        llm.on({ endpoint: 'chat', systemMessage: SUB_AGENT_INSTRUCTIONS }, { content: 'work done' });
        // Supervisor turn 1: a single delegation carrying model-authored
        // `resumeData` and no suspendedToolRunId — nothing is suspended anywhere.
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          {
            toolCalls: [
              {
                id: 'sup-tc-1',
                name: 'agent-subAgent',
                arguments: {
                  prompt: 'do the work',
                  resumeData: { fileUrl: ['https://example.com/f.pdf'] },
                },
              },
            ],
          },
        );
        // Supervisor turn 2: the sub-agent result comes back; the supervisor wraps up.
        llm.on({ endpoint: 'chat', toolCallId: 'sup-tc-1', hasToolResult: true }, { content: 'all done' });
      },
    });

    // The run completed without an AGENT_RESUME_NO_SNAPSHOT_FOUND error anywhere.
    expect((chunks ?? []).some(mentionsNoSnapshotError)).toBe(false);
    expect(await output.text).toBe('all done');

    // The sub-agent ran exactly once — a fresh run, not a resume attempt.
    const subAgentRequests = requests.filter(request =>
      JSON.stringify(request.body ?? {}).includes(SUB_AGENT_INSTRUCTIONS),
    );
    expect(subAgentRequests).toHaveLength(1);
  });
});
