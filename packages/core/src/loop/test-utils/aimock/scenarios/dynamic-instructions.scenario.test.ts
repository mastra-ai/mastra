import type { JournalEntry } from '@copilotkit/aimock';
import { it, expect } from 'vitest';
import { RequestContext } from '../../../../request-context';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Concept: dynamic configuration (instructions resolved from request context).
 *
 * Instructions may be a function `({ requestContext }) => string`. The resolved
 * string must land in the system prompt of the outgoing model request, so the
 * same agent can be re-targeted per request. This pins that resolution path
 * end-to-end through the loop.
 */
describeForAllEngines(
  'AIMock loop scenario: dynamic instructions',
  engine => {
    const getMock = useLoopScenarioAimock();

    function systemPromptOf(request: JournalEntry): string {
      const messages = request.body?.messages ?? [];
      const system = messages.filter(message => (message as { role?: string }).role === 'system');
      return JSON.stringify(system);
    }

    it('resolves instructions from request context into the request system prompt', async () => {
      const requestContext = new RequestContext();
      requestContext.set('userTier', 'enterprise');

      const { requests } = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Hello.',
        requestContext,
        instructions: ({ requestContext: ctx }) =>
          `You are serving a ${ctx.get('userTier')} customer. Be extra thorough.`,
        fixtures: llm => {
          llm.onMessage(/.*/, { content: 'Acknowledged.' });
        },
      });

      expect(requests).toHaveLength(1);
      const systemPrompt = systemPromptOf(requests[0]!);
      expect(systemPrompt).toContain('enterprise customer');
      expect(systemPrompt).not.toContain('free customer');
    });

    it('produces different system prompts for different request contexts', async () => {
      const dynamicInstructions = ({ requestContext: ctx }: { requestContext: RequestContext }) =>
        `You are serving a ${ctx.get('userTier')} customer.`;

      const enterprise = new RequestContext();
      enterprise.set('userTier', 'enterprise');
      const free = new RequestContext();
      free.set('userTier', 'free');

      const enterpriseRun = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Hello.',
        requestContext: enterprise,
        instructions: dynamicInstructions,
        fixtures: llm => llm.onMessage(/.*/, { content: 'Hi enterprise.' }),
      });

      // afterEach clears the journal between tests, but both runs are in one test,
      // so capture the first run's request before the second overwrites nothing
      // (requests accumulate within a single test).
      const enterprisePrompt = systemPromptOf(enterpriseRun.requests.at(-1)!);
      expect(enterprisePrompt).toContain('enterprise customer');

      const freeRun = await runLoopScenario({
        engine,
        llm: getMock(),
        prompt: 'Hello.',
        requestContext: free,
        instructions: dynamicInstructions,
        fixtures: llm => llm.onMessage(/.*/, { content: 'Hi free.' }),
      });

      const freePrompt = systemPromptOf(freeRun.requests.at(-1)!);
      expect(freePrompt).toContain('free customer');
      expect(freePrompt).not.toContain('enterprise customer');
    });
  },
  { skip: ['fs'] },
); // dynamic-function instructions cannot be modeled by an instructions.md body
