// @vitest-environment jsdom
import { SpanType } from '@mastra/core/observability';
import { fireEvent, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SpanRecord } from '../../../types';
import { SpanDataPanelView } from '../../span-data-panel-view';
import { SpanDetailsView } from '../../span-details-view';
import { makeSpan } from './fixtures/span-payloads';
import { registeredTools } from './fixtures/tools';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

// jsdom does not provide PointerEvent, which Base UI switches dispatch.
beforeAll(() => vi.stubGlobal('PointerEvent', MouseEvent));
afterAll(() => vi.unstubAllGlobals());

beforeEach(() => {
  server.use(http.get(`${TEST_BASE_URL}/api/tools`, () => HttpResponse.json(registeredTools)));
});

// Agents expose each workflow they own as a tool named `workflow-<key>` and each
// sub-agent as `agent-<key>`; the workflow and agent pages resolve that key.
const KINDS = [
  { kind: 'workflow', label: 'Workflow', key: 'myWorkflow', page: '/workflows/myWorkflow' },
  { kind: 'agent', label: 'Agent', key: 'balanceAgent', page: '/agents/balanceAgent' },
] as const;

const LAYOUTS = [
  ['data panel', (span: SpanRecord) => <SpanDataPanelView traceId="t" spanId="s" span={span} />],
  ['details', (span: SpanRecord) => <SpanDetailsView traceId="t" spanId="s" span={span} />],
] as const;

const linksTo = (prefix: string) =>
  screen
    .getAllByRole('link')
    .filter(link => link.getAttribute('href')?.startsWith(prefix))
    .map(link => [link.textContent, link.getAttribute('href')]);

describe.each(KINDS)('$kind tools', ({ kind, label, key, page }) => {
  const toolName = `${kind}-${key}`;
  const pagePrefix = page.slice(0, page.lastIndexOf('/') + 1);

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

  describe.each(LAYOUTS)('%s', (_layout, renderSpan) => {
    const renderWithLinks = (span: SpanRecord) => {
      const view = renderWithProviders(<TestLinkProvider>{renderSpan(span)}</TestLinkProvider>);
      return view;
    };

    it(`links a ${kind} the span offered as a tool to its page`, () => {
      renderWithLinks(offeredSpan);

      const tools = screen.getByText('Available tools (2)').closest('[data-slot="span-payload-section"]');
      if (!(tools instanceof HTMLElement)) throw new Error('Missing Tools section');
      expect(within(tools).getByRole('link', { name: toolName }).getAttribute('href')).toBe(page);
      expect(within(tools).queryByRole('link', { name: `${kind}-` })).toBeNull();
    });

    it(`links a ${kind} the model called from the opened tool call, and only that call`, () => {
      renderWithLinks(calledSpan);

      expect(screen.queryAllByRole('link')).toHaveLength(0);
      for (const button of screen.getAllByRole('button', { name: new RegExp(`^(${label} ${key}|CookingTool)$`) })) {
        fireEvent.click(button);
      }
      expect(screen.getAllByRole('link').map(link => [link.textContent, link.getAttribute('href')])).toEqual([
        [key, page],
      ]);
    });

    it(`links the ${kind} a run suspended in`, () => {
      renderWithLinks(suspendedSpan);
      expect(linksTo(pagePrefix)).toEqual([[toolName, page]]);
    });

    it(`links the ${kind} a run resumed into`, () => {
      renderWithLinks(resumedSpan);
      expect(linksTo(pagePrefix)).toEqual([[toolName, page]]);
    });

    it(`links the ${kind} whose result a processor handled`, () => {
      renderWithLinks(resultProcessorSpan);
      expect(linksTo(pagePrefix)).toEqual([[toolName, page]]);
    });
  });
});
