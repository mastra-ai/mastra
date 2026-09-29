import { createOpenAI } from '@ai-sdk/openai-v5';
import { it, expect } from 'vitest';
import { Agent } from '../../../../agent';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';
import { SCENARIO_MODEL_ID } from '../types';

/**
 * Cross-engine coverage for delegation result references (`contextFromRefs`).
 *
 * The engine-sensitive part is the ref registry crossing iteration
 * boundaries: a ref minted when delegation N completes (iteration N) must be
 * resolvable when delegation N+1 starts (iteration N+1). On durable/evented
 * each iteration is a separate event-driven step, so this pins that the
 * registry survives the hop.
 *
 * Pure-function helper behavior (id minting, block formatting, unknown-ref
 * reporting) is engine-agnostic and stays covered by
 * packages/core/src/agent/__tests__/delegation-context-refs.test.ts, which is
 * also where the schema-level assertions (contextFromRefs presence/absence in
 * the tool parameters) live. This port pins the request-observable contract.
 */

const EXPLORER_FINDING = 'Token refresh bug is in src/auth/refresh.ts:88 — the expiry check uses `<` instead of `<=`.';

const SUPERVISOR_INSTRUCTIONS = 'Delegate to the sub-agents.';
const EXPLORER_INSTRUCTIONS = 'Explore the codebase.';
const IMPLEMENTER_INSTRUCTIONS = 'Implement the fix.';

/**
 * Requests whose PRIMARY (first) system message contains the given
 * instructions. The default engine forwards the supervisor's system message
 * into the sub-agent request as an additional system entry, so matching any
 * system message would misclassify sub-agent requests as supervisor ones.
 */
function requestsFor(requests: Array<{ body?: { messages?: any[] } }>, instructions: string) {
  return requests.filter(request => {
    const primary = (request?.body?.messages ?? []).find((message: any) => message?.role === 'system');
    return String(primary?.content ?? '').includes(instructions);
  });
}

/** Tool-role message contents of a request, in order. */
function toolContents(request: { body?: { messages?: any[] } } | undefined): string[] {
  return (request?.body?.messages ?? [])
    .filter((message: any) => message?.role === 'tool')
    .map((message: any) => String(message?.content ?? ''));
}

/** Concatenated user-message text of a request. */
function userTextOf(request: { body?: { messages?: any[] } } | undefined): string {
  return (request?.body?.messages ?? [])
    .filter((message: any) => message?.role === 'user')
    .map((message: any) =>
      Array.isArray(message?.content)
        ? message.content.map((part: any) => (part?.type === 'text' ? part.text : '')).join('\n')
        : String(message?.content ?? ''),
    )
    .join('\n');
}

describeForAllEngines('AIMock loop scenario: delegation context refs', engine => {
  const getMock = useLoopScenarioAimock();

  function makeSubAgent(mockUrl: string, id: string, description: string, instructions: string) {
    const openai = createOpenAI({
      apiKey: 'aimock-test-key',
      baseURL: `${mockUrl.replace(/\/+$/, '')}/v1`,
    });
    return new Agent({ id, name: id, description, instructions, model: openai(SCENARIO_MODEL_ID) });
  }

  function makeAgents(mockUrl: string) {
    return {
      explorer: makeSubAgent(mockUrl, 'explorer', 'Explores the codebase', EXPLORER_INSTRUCTIONS),
      implementer: makeSubAgent(mockUrl, 'implementer', 'Implements fixes', IMPLEMENTER_INSTRUCTIONS),
    };
  }

  it('is off by default: no [ref:] trailer on the delegation result', async () => {
    const mock = getMock();

    const { requests } = await runLoopScenario({
      engine,
      llm: mock,
      prompt: 'go',
      instructions: SUPERVISOR_INSTRUCTIONS,
      agents: makeAgents(mock.url),
      maxSteps: 3,
      fixtures: llm => {
        // Sub-agent fixtures first: AIMock matches in registration order, and
        // the supervisor's turn-1 matcher (hasToolResult: false) would
        // otherwise also catch the explorer's request.
        llm.on({ endpoint: 'chat', systemMessage: EXPLORER_INSTRUCTIONS }, { content: EXPLORER_FINDING });
        llm.on(
          { endpoint: 'chat', systemMessage: SUPERVISOR_INSTRUCTIONS, hasToolResult: false },
          { toolCalls: [{ id: 'call-1', name: 'agent-explorer', arguments: { prompt: 'Find the bug' } }] },
        );
        llm.on({ endpoint: 'chat', systemMessage: SUPERVISOR_INSTRUCTIONS, hasToolResult: true }, { content: 'Done' });
      },
    });

    const continuation = requestsFor(requests as any, SUPERVISOR_INSTRUCTIONS)[1];
    const results = toolContents(continuation);
    expect(results[0]).toBe(EXPLORER_FINDING);
    expect(results[0]).not.toContain('[ref:');
  });

  it('relays an earlier result verbatim to a later delegation', async () => {
    const mock = getMock();

    const { requests } = await runLoopScenario({
      engine,
      llm: mock,
      prompt: 'go',
      instructions: SUPERVISOR_INSTRUCTIONS,
      agents: makeAgents(mock.url),
      maxSteps: 4,
      delegation: { enableResultReferences: true },
      fixtures: llm => {
        llm.on({ endpoint: 'chat', systemMessage: EXPLORER_INSTRUCTIONS }, { content: EXPLORER_FINDING });
        llm.on({ endpoint: 'chat', systemMessage: IMPLEMENTER_INSTRUCTIONS }, { content: 'Fixed.' });
        llm.on(
          { endpoint: 'chat', systemMessage: SUPERVISOR_INSTRUCTIONS, hasToolResult: false },
          { toolCalls: [{ id: 'call-1', name: 'agent-explorer', arguments: { prompt: 'Find the bug' } }] },
        );
        // Turn 3 (both delegations done — the implementer's "Fixed." result is
        // present) must be registered before the turn-2 catch-all.
        llm.on(
          {
            endpoint: 'chat',
            systemMessage: SUPERVISOR_INSTRUCTIONS,
            predicate: request => JSON.stringify(request).includes('Fixed.'),
          },
          { content: 'Done' },
        );
        llm.on(
          { endpoint: 'chat', systemMessage: SUPERVISOR_INSTRUCTIONS, hasToolResult: true },
          {
            toolCalls: [
              {
                id: 'call-2',
                name: 'agent-implementer',
                arguments: { prompt: 'Fix the bug described above', contextFromRefs: ['explorer-1'] },
              },
            ],
          },
        );
      },
    });

    // Parent model sees the ref trailer after the explorer text.
    const supervisorRequests = requestsFor(requests as any, SUPERVISOR_INSTRUCTIONS);
    const firstResult = toolContents(supervisorRequests[1])[0];
    expect(firstResult).toBe(`${EXPLORER_FINDING}\n\n[ref: explorer-1]`);

    // Implementer receives the exact explorer text in a labeled block, then the prompt.
    const implementerPrompt = userTextOf(requestsFor(requests as any, IMPLEMENTER_INSTRUCTIONS)[0]);
    expect(implementerPrompt).toContain(EXPLORER_FINDING);
    expect(implementerPrompt).toMatch(/<delegation_result_[0-9a-f]+ ref="explorer-1" from="explorer">/);
    expect(implementerPrompt.endsWith('Fix the bug described above')).toBe(true);
    expect(implementerPrompt.indexOf(EXPLORER_FINDING)).toBeLessThan(implementerPrompt.indexOf('Fix the bug'));

    // The explorer itself is not affected.
    expect(userTextOf(requestsFor(requests as any, EXPLORER_INSTRUCTIONS)[0])).not.toContain('delegation_result_');

    // The implementer's own result gets its own ref.
    const secondResult = toolContents(supervisorRequests[2])[1];
    expect(secondResult).toBe('Fixed.\n\n[ref: implementer-1]');
  });
});
