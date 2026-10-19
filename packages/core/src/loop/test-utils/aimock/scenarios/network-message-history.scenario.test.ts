import { expect, it } from 'vitest';
import { Agent } from '../../../../agent';
import { MockMemory } from '../../../../memory/mock';
import type { MastraDBMessage } from '../../../../memory/types';
import { describeForAllEngines, useLoopScenarioAimock } from '../aimock-scenario';
import {
  drain,
  fixedScorer,
  isAgentRequest,
  isFinalResultRequest,
  isRoutingRequest,
  requestText,
  routeTo,
  scenarioModel,
  forEngine,
  NETWORK_ENGINE_SKIP,
} from '../network-fixtures';

/**
 * agent.network() message history forwarded to sub-agents: the user's earlier
 * messages reach a sub-agent without its own memory, and the network's internal
 * bookkeeping (routing JSON, completion feedback) never does.
 */
describeForAllEngines(
  'AIMock network scenario: message history sent to sub-agents',
  engine => {
    const getMock = useLoopScenarioAimock();

    it('gives a sub-agent without memory the earlier user messages of the conversation', async () => {
      const llm = getMock();
      llm.on(
        { endpoint: 'chat', predicate: isRoutingRequest },
        routeTo('questionAnswerAgent', 'agent', 'What is my name?'),
      );
      llm.on({ endpoint: 'chat', predicate: isAgentRequest('QA_MARK') }, { content: 'Your name is Alice.' });
      llm.on({ endpoint: 'chat', predicate: isFinalResultRequest }, { content: JSON.stringify({ finalResult: '' }) });
      const questionAnswerAgent = new Agent({
        id: 'questionAnswerAgent',
        name: 'questionAnswerAgent',
        description: 'Answers questions from the conversation',
        instructions: 'QA_MARK',
        model: scenarioModel(llm),
      });
      const network = new Agent({
        id: 'history-network',
        name: 'history-network',
        instructions: 'Route questions.',
        model: scenarioModel(llm),
        agents: { questionAnswerAgent },
        memory: new MockMemory(),
      });

      const chunks = await drain(
        await forEngine(network, engine).network(
          [
            { role: 'user', content: 'My name is Alice.' },
            { role: 'user', content: 'What is my name?' },
          ],
          {
            memory: { thread: 'mh-t', resource: 'mh-r' },
            completion: { scorers: [fixedScorer('pass', 1)] },
          },
        ),
      );

      expect(chunks.at(-1)?.type).toBe('network-execution-event-finish');
      const subAgentRequests = llm.getRequests().filter(r => isAgentRequest('QA_MARK')(r.body));
      expect(subAgentRequests).toHaveLength(1);
      expect(requestText(subAgentRequests[0]!.body)).toContain('My name is Alice.');
    });

    it('keeps network JSON saved without network metadata out of a sub-agent call', async () => {
      // Threads written before internal messages carried `metadata.mode: 'network'` hold only the JSON.
      const llm = getMock();
      llm.on({ endpoint: 'chat', predicate: isRoutingRequest }, routeTo('legacyAgent', 'agent', 'Continue'));
      llm.on({ endpoint: 'chat', predicate: isAgentRequest('LEGACY_MARK') }, { content: 'Continued.' });
      llm.on({ endpoint: 'chat', predicate: isFinalResultRequest }, { content: JSON.stringify({ finalResult: '' }) });
      const memory = new MockMemory();
      const threadId = 'legacy-t';
      const resourceId = 'legacy-r';
      await memory.createThread({ threadId, resourceId });
      const texts: [MastraDBMessage['role'], string][] = [
        ['user', 'Earlier question'],
        ['assistant', JSON.stringify({ primitiveId: 'legacyAgent', selectionReason: 'LEGACY_ROUTING_REASON' })],
        ['assistant', JSON.stringify({ isNetwork: true, result: 'LEGACY_NETWORK_RESULT' })],
        ['assistant', 'Earlier plain answer'],
      ];
      await memory.saveMessages({
        messages: texts.map(([role, text], i) => ({
          id: `legacy-${i}`,
          threadId,
          resourceId,
          role,
          createdAt: new Date(1_000 + i * 1_000),
          content: { format: 2, parts: [{ type: 'text', text }] },
        })),
      });
      const legacyAgent = new Agent({
        id: 'legacyAgent',
        name: 'legacyAgent',
        description: 'Continues the work',
        instructions: 'LEGACY_MARK',
        model: scenarioModel(llm),
      });
      const network = new Agent({
        id: 'legacy-network',
        name: 'legacy-network',
        instructions: 'Route.',
        model: scenarioModel(llm),
        agents: { legacyAgent },
        memory,
      });

      await drain(
        await forEngine(network, engine).network('Continue', {
          memory: { thread: threadId, resource: resourceId },
          completion: { scorers: [fixedScorer('pass', 1)] },
        }),
      );

      const subAgentText = requestText(llm.getRequests().find(r => isAgentRequest('LEGACY_MARK')(r.body))!.body);
      expect(subAgentText).toContain('Earlier plain answer');
      expect(subAgentText).not.toContain('LEGACY_ROUTING_REASON');
      expect(subAgentText).not.toContain('LEGACY_NETWORK_RESULT');
    });

    it('keeps routing JSON and completion feedback out of a later sub-agent call (#12224)', async () => {
      const llm = getMock();
      llm.on({ endpoint: 'chat', predicate: isRoutingRequest }, routeTo('subAgent', 'agent', 'Do the next step'));
      llm.on({ endpoint: 'chat', predicate: isAgentRequest('STEP_MARK') }, { content: 'Step done.' });
      llm.on({ endpoint: 'chat', predicate: isFinalResultRequest }, { content: JSON.stringify({ finalResult: '' }) });
      const memory = new MockMemory();
      const subAgent = new Agent({
        id: 'subAgent',
        name: 'subAgent',
        description: 'Does one step',
        instructions: 'STEP_MARK',
        model: scenarioModel(llm),
        memory,
      });
      const network = new Agent({
        id: 'feedback-network',
        name: 'feedback-network',
        instructions: 'Run steps.',
        model: scenarioModel(llm),
        agents: { subAgent },
        memory,
      });
      let calls = 0;
      const scorer = fixedScorer(
        'fail-then-pass',
        () => (++calls === 1 ? 0 : 1),
        () => (calls === 1 ? 'Task not complete yet, needs more work' : 'Task is now complete'),
      );

      const chunks = await drain(
        await forEngine(network, engine).network('Do a multi-step task', {
          maxSteps: 3,
          completion: { scorers: [scorer] },
          memory: { thread: 'fb-t', resource: 'fb-r' },
        }),
      );

      expect(chunks.at(-1)?.type).toBe('network-execution-event-finish');
      const subAgentRequests = llm.getRequests().filter(r => isAgentRequest('STEP_MARK')(r.body));
      expect(subAgentRequests).toHaveLength(2);
      // The first iteration saved feedback and routing JSON to the shared thread.
      const saved = JSON.stringify((await memory.recall({ threadId: 'fb-t', resourceId: 'fb-r' })).messages);
      expect(saved).toContain('Completion Check Results');
      expect(saved).toContain('selectionReason');
      for (const req of subAgentRequests) {
        const text = requestText(req.body);
        expect(text).not.toContain('isNetwork');
        expect(text).not.toContain('selectionReason');
        expect(text).not.toContain('Completion Check Results');
        expect(text).not.toContain('NOT COMPLETE');
      }
    });
  },
  NETWORK_ENGINE_SKIP,
);
