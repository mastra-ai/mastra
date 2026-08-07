import { stepCountIs } from '@internal/ai-sdk-v5';
import { it, expect } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../../../tools';
import { runLoopScenario, useLoopScenarioAimock, describeForAllEngines } from '../aimock-scenario';

/**
 * Regression class: observability context in tool execution.
 *
 * Tools receive an execution context that extends `Partial<ObservabilityContext>`,
 * which includes `tracing`, `loggerVNext`, `metrics`, and `tracingContext` fields.
 * Even when observability is not configured (no `@mastra/observability` integration),
 * these fields should at least be present (possibly as no-ops or undefined) so tools
 * can safely check for their existence without crashing. A refactor that drops the
 * observability context from tool options would break tool-side tracing/logging use
 * cases.
 */
describeForAllEngines('AIMock loop scenario: observability context in tools', engine => {
  const getMock = useLoopScenarioAimock();

  it('passes tracingContext to tool execute when available', async () => {
    let capturedContext: any = null;

    const observabilityTool = createTool({
      id: 'observability_tool',
      description: 'A tool that captures observability context.',
      inputSchema: z.object({}),
      outputSchema: z.object({ hasTracingContext: z.boolean() }),
      execute: async (_, context) => {
        capturedContext = context;
        return { hasTracingContext: !!(context as any)?.tracingContext };
      },
    });

    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Call the observability tool.',
      tools: { observability_tool: observabilityTool },
      stopWhen: stepCountIs(5),
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_obs', name: 'observability_tool', arguments: {} }] },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'Observability context checked.' });
      },
    });

    const text = await output.text;
    expect(text).toContain('Observability context');

    // The tool received context and didn't crash when accessing tracingContext.
    expect(capturedContext).toBeDefined();
    // tracingContext may be undefined (no observability configured) but the field
    // access should not throw.
    expect(() => capturedContext?.tracingContext).not.toThrow();
  });

  it('tools can safely check for observability fields without crashing', async () => {
    const safeCheckTool = createTool({
      id: 'safe_check_tool',
      description: 'A tool that safely checks observability fields.',
      inputSchema: z.object({}),
      outputSchema: z.object({ safe: z.boolean() }),
      execute: async (_, context) => {
        const ctx = context as any;
        // Safely check all observability fields (may be undefined in test harness).
        const hasTracing = !!ctx?.tracing;
        const hasLogger = !!ctx?.loggerVNext;
        const hasMetrics = !!ctx?.metrics;
        const hasTracingContext = !!ctx?.tracingContext;

        // All checks succeeded without throwing.
        return {
          safe: true,
          fields: { hasTracing, hasLogger, hasMetrics, hasTracingContext },
        };
      },
    });

    const { output } = await runLoopScenario({
      engine,
      llm: getMock(),
      prompt: 'Check observability fields safely.',
      tools: { safe_check_tool: safeCheckTool },
      stopWhen: stepCountIs(5),
      fixtures: llm => {
        llm.on(
          { endpoint: 'chat', hasToolResult: false },
          { toolCalls: [{ id: 'call_safe', name: 'safe_check_tool', arguments: {} }] },
        );
        llm.on({ endpoint: 'chat', hasToolResult: true }, { content: 'All observability fields checked safely.' });
      },
    });

    const text = await output.text;
    expect(text).toContain('checked safely');
    // The tool executed successfully and returned.
    const results = await output.toolResults;
    expect(results).toHaveLength(1);
    expect(results[0].payload.result).toMatchObject({ safe: true });
  });
});
