import { createOpenAI } from '@ai-sdk/openai-v5';
import { stepCountIs } from '@internal/ai-sdk-v5';
import { describe, it, expect } from 'vitest';
import { Agent } from '../../../../agent';
import { createTool } from '../../../../tools';
import { z } from 'zod/v4';
import { runLoopScenario, useLoopScenarioAimock } from '../aimock-scenario';
import { SCENARIO_MODEL_ID } from '../types';

/**
 * Regression class: supervisor delegation — includeSubAgentToolResultsInModelContext.
 *
 * When a supervisor delegates to a subagent, the subagent's tool results can
 * optionally be included in the supervisor's model context. This option controls
 * what the supervisor "sees" after delegation:
 *
 * 1. With `includeSubAgentToolResultsInModelContext: false` (default), the
 *    supervisor only sees the subagent's final text response.
 * 2. With `includeSubAgentToolResultsInModelContext: true`, the supervisor
 *    sees the full subagent result including nested tool calls and results.
 *
 * This proves the option correctly controls context pollution.
 */
describe('AIMock loop scenario: includeSubAgentToolResultsInModelContext', () => {
  const getMock = useLoopScenarioAimock();

  it('does NOT include subagent tool results in supervisor context by default', async () => {
    const mock = getMock();

    const openai = createOpenAI({
      apiKey: 'aimock-test-key',
      baseURL: `${mock.url.replace(/\/+$/, '')}/v1`,
    });

    // Subagent tool that returns a distinctive value
    const searchTool = createTool({
      id: 'search',
      description: 'Searches for information',
      inputSchema: z.object({
        query: z.string().describe('Search query'),
      }),
      execute: async ({ query }) => {
        return { results: `SEARCH_RESULTS_789012 for ${query}` };
      },
    });

    const researcher = new Agent({
      id: 'researcher',
      name: 'Researcher',
      description: 'Researches topics using the search tool',
      instructions: 'You are a researcher. Use the search tool to find information.',
      model: openai(SCENARIO_MODEL_ID),
      tools: { searchTool },
    });

    const { output, requests } = await runLoopScenario({
      llm: mock,
      prompt: 'Ask the researcher to find AI trends.',
      agents: { researcher },
      stopWhen: stepCountIs(6),
      delegation: {
        // Default behavior: includeSubAgentToolResultsInModelContext is false
      },
      fixtures: llm => {
        // Supervisor turn 1: delegate to researcher.
        llm.on(
          { endpoint: 'chat', hasToolResult: false, userMessage: /Ask the researcher/ },
          {
            toolCalls: [{ id: 'call_researcher', name: 'agent-researcher', arguments: { prompt: 'Find AI trends' } }],
          },
        );

        // Researcher's own turn 1: calls search tool.
        llm.on(
          { endpoint: 'chat', hasToolResult: false, userMessage: /Find AI trends/ },
          {
            toolCalls: [{ id: 'call_search', name: 'search', arguments: { query: 'AI trends' } }],
          },
        );

        // Researcher turn 2: gets search results, generates summary.
        llm.on(
          { endpoint: 'chat', toolCallId: 'call_search', hasToolResult: true },
          { content: 'AI trends show rapid growth in enterprise adoption.' },
        );

        // Supervisor turn 2: subagent result comes back as tool result; supervisor wraps up.
        llm.on(
          { endpoint: 'chat', toolCallId: 'call_researcher', hasToolResult: true },
          { content: 'Research complete. The researcher found that AI adoption is growing.' },
        );
      },
    });

    // The supervisor produced its final answer incorporating the subagent output.
    const text = await output.text;
    expect(text).toContain('Research complete');

    // Find the supervisor's final turn request (should be last).
    const supervisorFinalRequest = requests.at(-1);
    expect(supervisorFinalRequest).toBeDefined();

    const finalMessages = JSON.stringify(supervisorFinalRequest!.body?.messages);

    // The supervisor should see the researcher's text summary.
    expect(finalMessages).toContain('AI trends show rapid growth');

    // The supervisor should NOT see the raw tool result identifier (context pollution prevented).
    expect(finalMessages).not.toContain('SEARCH_RESULTS_789012');
  });

  it('INCLUDES subagent tool results in supervisor context when enabled', async () => {
    const mock = getMock();

    const openai = createOpenAI({
      apiKey: 'aimock-test-key',
      baseURL: `${mock.url.replace(/\/+$/, '')}/v1`,
    });

    // Subagent tool that returns a distinctive value
    const searchTool = createTool({
      id: 'search',
      description: 'Searches for information',
      inputSchema: z.object({
        query: z.string().describe('Search query'),
      }),
      execute: async ({ query }) => {
        return { results: `SEARCH_RESULTS_789012 for ${query}` };
      },
    });

    const researcher = new Agent({
      id: 'researcher',
      name: 'Researcher',
      description: 'Researches topics using the search tool',
      instructions: 'You are a researcher. Use the search tool to find information.',
      model: openai(SCENARIO_MODEL_ID),
      tools: { searchTool },
    });

    const { output, requests } = await runLoopScenario({
      llm: mock,
      prompt: 'Ask the researcher to find AI trends.',
      agents: { researcher },
      stopWhen: stepCountIs(6),
      delegation: {
        includeSubAgentToolResultsInModelContext: true,
      },
      fixtures: llm => {
        // Supervisor turn 1: delegate to researcher.
        llm.on(
          { endpoint: 'chat', hasToolResult: false, userMessage: /Ask the researcher/ },
          {
            toolCalls: [{ id: 'call_researcher', name: 'agent-researcher', arguments: { prompt: 'Find AI trends' } }],
          },
        );

        // Researcher's own turn 1: calls search tool.
        llm.on(
          { endpoint: 'chat', hasToolResult: false, userMessage: /Find AI trends/ },
          {
            toolCalls: [{ id: 'call_search', name: 'search', arguments: { query: 'AI trends' } }],
          },
        );

        // Researcher turn 2: gets search results, generates summary.
        llm.on(
          { endpoint: 'chat', toolCallId: 'call_search', hasToolResult: true },
          { content: 'AI trends show rapid growth in enterprise adoption.' },
        );

        // Supervisor turn 2: subagent result comes back as tool result; supervisor wraps up.
        llm.on(
          { endpoint: 'chat', toolCallId: 'call_researcher', hasToolResult: true },
          { content: 'Research complete with full tool results included.' },
        );
      },
    });

    // The supervisor produced its final answer.
    const text = await output.text;
    expect(text).toContain('Research complete');

    // Find the supervisor's final turn request (should be last).
    const supervisorFinalRequest = requests.at(-1);
    expect(supervisorFinalRequest).toBeDefined();

    const finalMessages = JSON.stringify(supervisorFinalRequest!.body?.messages);

    // The supervisor should see the researcher's text summary.
    expect(finalMessages).toContain('AI trends show rapid growth');

    // The supervisor SHOULD see the raw tool result identifier (context pollution enabled).
    expect(finalMessages).toContain('SEARCH_RESULTS_789012');
  });
});
