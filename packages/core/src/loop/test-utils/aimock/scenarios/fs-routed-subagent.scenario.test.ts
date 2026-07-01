/**
 * AIMock Scenario: file-routed subagent delegation.
 *
 * Proves an FS-assembled parent agent that declares an FS-assembled subagent
 * (via the `subagents` field of {@link assembleAgentFromFsEntry}) delegates
 * exactly like an inline `agents:` map. This is the true file-routed subagent
 * path: the child is built from its own directory, not spread in as a
 * pre-built `Agent` instance the way the matrix `'fs'` variant does.
 *
 * Both the parent and the child are built through `assembleAgentFromFsEntry` —
 * the same call the bundler emits for `agents/<parent>/subagents/<child>/` — and
 * the parent is registered through the real `Mastra.__registerFsAgents` path.
 * The child is lowered into a model-visible `agent-<childId>` delegation tool by
 * the loop, identical to a code-registered subagent map.
 *
 * The matrix `'fs'` variant cannot model this on its own (it spreads a code
 * `agents:` map), so this is a standalone file. It runs on the normal/evented
 * engines; durable wraps the agent and is orthogonal to the assembly path.
 */

import { createOpenAI } from '@ai-sdk/openai-v5';
import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { Mastra } from '../../../../mastra';
import { assembleAgentFromFsEntry } from '../../../../agent/fs-routing';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';
import { SCENARIO_MODEL_ID } from '../types';

describeForAllEngines(
  'AIMock loop scenario: file-routed subagent delegation',
  engine => {
    const getMock = useLoopScenarioAimock();

    it('delegates from an FS parent to an FS subagent and feeds the result back', async () => {
      const mock = getMock();

      const openai = createOpenAI({
        apiKey: 'aimock-test-key',
        baseURL: `${mock.url.replace(/\/+$/, '')}/v1`,
      });
      const model = openai(SCENARIO_MODEL_ID);

      // Parent + child assembled exactly as the bundler emits for
      // agents/supervisor/subagents/writer/.
      const supervisor = assembleAgentFromFsEntry({
        name: 'supervisor',
        config: { model },
        instructionsMd: 'You are a supervisor. Delegate writing to the writer.',
        subagents: [
          {
            name: 'writer',
            config: { model, description: 'Drafts written content' },
            instructionsMd: 'You are a skilled writer subagent.',
          },
        ],
      });

      // Register through the real file-routing path so the scenario exercises how
      // the bundler injects file-based agents.
      const mastra = new Mastra({ agents: {}, logger: false });
      mastra.__registerFsAgents({ supervisor: supervisor as any });
      const parent = mastra.getAgent('supervisor');

      // The declared subagent is wired into the parent's agents map under its
      // bare id and lowered into an `agent-writer` delegation tool.
      const childAgents = await parent.listAgents();
      expect(Object.keys(childAgents)).toEqual(['writer']);
      expect(childAgents.writer!.getDescription()).toBe('Drafts written content');

      const { output, requests } = await runLoopScenario({
        engine,
        llm: mock,
        prompt: 'Ask the writer to draft a tagline.',
        sharedAgent: { agent: parent, mastra },
        stopWhen: stepCountIs(5),
        fixtures: llm => {
          // Supervisor turn 1: delegate to the writer subagent.
          llm.on(
            { endpoint: 'chat', hasToolResult: false },
            {
              toolCalls: [
                {
                  id: 'call_writer',
                  name: 'agent-writer',
                  arguments: { prompt: 'Draft a tagline for a coffee shop.' },
                },
              ],
            },
          );
          // Subagent's own loop turn: the writer drafts the tagline.
          llm.onMessage(/coffee shop/i, { content: 'Brewed fresh, served warm.' });
          // Supervisor turn 2: the subagent result comes back as a tool result.
          llm.on(
            { endpoint: 'chat', toolCallId: 'call_writer', hasToolResult: true },
            { content: 'The writer suggested: Brewed fresh, served warm.' },
          );
        },
      });

      const text = await output.text;
      expect(text).toContain('Brewed fresh, served warm.');

      // The subagent tool result was plumbed back to the supervisor, keyed to the
      // original delegation call id.
      const supervisorFinalTurn = requests.at(-1)?.body?.messages ?? [];
      const toolMessage = supervisorFinalTurn.find(message => (message as { role?: string }).role === 'tool') as
        | { tool_call_id?: string; content?: unknown }
        | undefined;
      expect(toolMessage?.tool_call_id).toBe('call_writer');
      expect(JSON.stringify(toolMessage?.content)).toContain('Brewed fresh, served warm.');

      // Supervisor delegate, subagent draft, supervisor finalize.
      expect(requests.length).toBeGreaterThanOrEqual(3);
    });
  },
  { skip: ['durable', 'fs'] },
);
