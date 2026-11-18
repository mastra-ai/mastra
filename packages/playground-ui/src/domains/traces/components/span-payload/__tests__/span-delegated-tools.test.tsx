// @vitest-environment jsdom
import { SpanType } from '@mastra/core/observability';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { SpanRecord } from '../../../types';
import { SpanDataPanelView } from '../../span-data-panel-view';
import { SpanDetailsView } from '../../span-details-view';
import type { TraceNavigation } from '../../trace-navigation';
import { makeSpan, traceWithoutToolCalls } from './fixtures/span-payloads';
import { registeredTools } from './fixtures/tools';

// jsdom does not provide PointerEvent, which Base UI switches dispatch.
beforeAll(() => vi.stubGlobal('PointerEvent', MouseEvent));
afterAll(() => vi.unstubAllGlobals());

// Agents expose each workflow they own as a tool named `workflow-<key>` and each
// sub-agent as `agent-<key>`; the host opens that key wherever it shows workflows and agents.
const KINDS = [
  { kind: 'workflow', callLabel: 'Run workflow', key: 'myWorkflow', opens: 'onOpenWorkflow' },
  { kind: 'agent', callLabel: 'Delegate', key: 'balanceAgent', opens: 'onOpenAgent' },
] as const;

const LAYOUTS = [
  {
    layout: 'data panel',
    renderSpan: (span: SpanRecord, navigation?: TraceNavigation) => (
      <SpanDataPanelView
        traceId="t"
        spanId="s"
        span={span}
        traceSpans={traceWithoutToolCalls.spans}
        registeredTools={registeredTools}
        navigation={navigation}
      />
    ),
    // What the span got sits in the Input tab, what it produced in the Output tab.
    open: (tab: 'input' | 'output') => fireEvent.click(screen.getByRole('tab', { name: new RegExp(`^${tab}`, 'i') })),
    toolsSection: () => screen.getByRole('region', { name: 'Available tools' }),
  },
  {
    layout: 'details',
    renderSpan: (span: SpanRecord, navigation?: TraceNavigation) => (
      <SpanDetailsView
        traceId="t"
        spanId="s"
        span={span}
        traceSpans={traceWithoutToolCalls.spans}
        registeredTools={registeredTools}
        navigation={navigation}
      />
    ),
    open: () => {},
    toolsSection: () => {
      const found = screen.getByText('Available tools (2)').closest('[data-slot="span-payload-section"]');
      if (!(found instanceof HTMLElement)) throw new Error('Missing Tools section');
      return found;
    },
  },
] as const;

describe.each(KINDS)('$kind tools', ({ kind, callLabel, key, opens }) => {
  const toolName = `${kind}-${key}`;

  const offeredSpan = makeSpan({
    spanId: `span-offered-${kind}`,
    name: 'memory: recall',
    spanType: SpanType.PROCESSOR_RUN,
    entityType: 'input_step_processor',
    attributes: { processorPhase: 'inputStep', processorExecutor: 'legacy', processorIndex: 0 },
    input: {
      messages: [{ role: 'user', content: 'Find me a recipe' }],
      tools: [
        { id: toolName, name: toolName, description: 'Delegated work' },
        { id: `${kind}-`, name: `${kind}-`, description: 'Nothing behind the prefix' },
      ],
    },
  });

  const calledSpan = makeSpan({
    spanId: `span-called-${kind}`,
    input: [
      { role: 'user', content: 'Find me a recipe' },
      {
        role: 'assistant',
        content: [
          { type: 'tool-call', toolCallId: 'call-1', toolName, args: { prompt: 'leek' } },
          { type: 'tool-call', toolCallId: 'call-2', toolName: 'cookingTool', args: { ingredient: 'leek' } },
        ],
      },
    ],
  });

  const suspendedSpan = makeSpan({
    spanId: `span-suspended-in-${kind}`,
    input: 'Find me a recipe',
    output: { status: 'suspended', toolName, toolCallId: 'call-1' },
  });

  const resumedSpan = makeSpan({
    spanId: `span-resumed-into-${kind}`,
    metadata: { resumed: true },
    input: { resumeData: { approved: true }, toolName, toolCallId: 'call-1' },
  });

  const resultProcessorSpan = makeSpan({
    spanId: `span-${kind}-result-processor`,
    name: 'tool result processor: redact',
    spanType: SpanType.PROCESSOR_RUN,
    entityType: 'tool_result_processor',
    attributes: { processorPhase: 'toolResult', processorExecutor: 'legacy', processorIndex: 0 },
    input: { toolName, toolCallId: 'call-1' },
  });

  describe.each(LAYOUTS)('$layout', ({ renderSpan, open, toolsSection }) => {
    // No provider: the span is drawn from its record, and every navigation goes through the host's callbacks.
    const renderWithNavigation = (span: SpanRecord) => {
      const navigation = { onOpenAgent: vi.fn(), onOpenWorkflow: vi.fn(), onOpenTool: vi.fn() };
      const view = render(renderSpan(span, navigation));
      return { ...view, navigation };
    };

    it(`opens a ${kind} the span offered as a tool through ${opens}`, () => {
      const { navigation } = renderWithNavigation(offeredSpan);
      open('input');

      fireEvent.click(within(toolsSection()).getByRole('button', { name: toolName }));

      expect(navigation[opens]).toHaveBeenCalledWith(key);
    });

    it(`leaves a ${kind} prefix with nothing behind it as text`, () => {
      renderWithNavigation(offeredSpan);
      open('input');

      expect(within(toolsSection()).queryByRole('button', { name: `${kind}-` })).toBeNull();
    });

    it(`opens a ${kind} the model called from the opened tool call, and only that call`, () => {
      const { navigation } = renderWithNavigation(calledSpan);
      open('input');

      expect(screen.queryByRole('button', { name: key })).toBeNull();
      for (const button of screen.getAllByRole('button', { name: new RegExp(`^(${callLabel}|CookingTool)$`) })) {
        fireEvent.click(button);
      }
      fireEvent.click(screen.getByRole('button', { name: key }));

      expect(navigation[opens]).toHaveBeenCalledWith(key);
    });

    it(`opens the ${kind} a run suspended in`, () => {
      const { navigation } = renderWithNavigation(suspendedSpan);
      open('output');

      fireEvent.click(screen.getByRole('button', { name: toolName }));

      expect(navigation[opens]).toHaveBeenCalledWith(key);
    });

    it(`opens the ${kind} a run resumed into`, () => {
      const { navigation } = renderWithNavigation(resumedSpan);
      open('input');

      fireEvent.click(screen.getByRole('button', { name: toolName }));

      expect(navigation[opens]).toHaveBeenCalledWith(key);
    });

    it(`opens the ${kind} whose result a processor handled`, () => {
      const { navigation } = renderWithNavigation(resultProcessorSpan);
      open('input');

      fireEvent.click(screen.getByRole('button', { name: toolName }));

      expect(navigation[opens]).toHaveBeenCalledWith(key);
    });

    it(`draws no link to the ${kind}: the host navigates`, () => {
      const { container } = renderWithNavigation(offeredSpan);
      open('input');

      expect(container.querySelectorAll('a')).toHaveLength(0);
    });

    it(`shows the ${kind} as text when the host does not navigate`, () => {
      render(renderSpan(offeredSpan));
      open('input');

      expect(within(toolsSection()).queryByRole('button', { name: toolName })).toBeNull();
      expect(within(toolsSection()).getByText(toolName)).toBeTruthy();
    });
  });
});
