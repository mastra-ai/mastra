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

// Agents expose each workflow they own as a tool named `workflow-<key>`; the
// workflow page resolves that key, so every tool name with the prefix links to it.
const offeredWorkflowSpan = makeSpan({
  spanId: 'span-offered-workflow',
  name: 'memory: recall',
  spanType: SpanType.PROCESSOR_RUN,
  entityType: 'input_step_processor',
  attributes: { processorPhase: 'inputStep', processorExecutor: 'legacy', processorIndex: 0 },
  input: {
    messages: [{ role: 'user', content: 'Find me a recipe' }],
    tools: [
      { id: 'workflow-myWorkflow', name: 'workflow-myWorkflow', description: 'Returns a recipe' },
      { id: 'workflow-', name: 'workflow-', description: 'Not a workflow' },
    ],
  },
});

const calledWorkflowSpan = makeSpan({
  spanId: 'span-called-workflow',
  input: [
    { role: 'user', content: 'Find me a recipe' },
    {
      role: 'assistant',
      content: [
        { type: 'tool-call', toolCallId: 'call-1', toolName: 'workflow-myWorkflow', args: { ingredient: 'leek' } },
        { type: 'tool-call', toolCallId: 'call-2', toolName: 'cookingTool', args: { ingredient: 'leek' } },
      ],
    },
  ],
});

const suspendedInWorkflowSpan = makeSpan({
  spanId: 'span-suspended-in-workflow',
  input: 'Find me a recipe',
  output: { status: 'suspended', toolName: 'workflow-myWorkflow', toolCallId: 'call-1' },
});

const resumedIntoWorkflowSpan = makeSpan({
  spanId: 'span-resumed-into-workflow',
  metadata: { resumed: true },
  input: { resumeData: { approved: true }, toolName: 'workflow-myWorkflow', toolCallId: 'call-1' },
});

const workflowResultProcessorSpan = makeSpan({
  spanId: 'span-workflow-result-processor',
  name: 'tool result processor: redact',
  spanType: SpanType.PROCESSOR_RUN,
  entityType: 'tool_result_processor',
  attributes: { processorPhase: 'toolResult', processorExecutor: 'legacy', processorIndex: 0 },
  input: { toolName: 'workflow-myWorkflow', toolCallId: 'call-1' },
});

const LAYOUTS = [
  ['data panel', (span: SpanRecord) => <SpanDataPanelView traceId="t" spanId="s" span={span} />],
  ['details', (span: SpanRecord) => <SpanDetailsView traceId="t" spanId="s" span={span} />],
] as const;

const workflowLinks = () =>
  screen.getAllByRole('link').filter(link => link.getAttribute('href')?.startsWith('/workflows/'));

describe.each(LAYOUTS)('Workflow tools (%s)', (_layout, renderSpan) => {
  const renderWithLinks = (span: SpanRecord) =>
    renderWithProviders(<TestLinkProvider>{renderSpan(span)}</TestLinkProvider>);

  it('links a workflow the span offered as a tool to its workflow page', () => {
    renderWithLinks(offeredWorkflowSpan);

    const tools = screen.getByText('Tools (2)').closest('[data-slot="span-payload-section"]');
    if (!(tools instanceof HTMLElement)) throw new Error('Missing Tools section');
    const link = within(tools).getByRole('link', { name: 'workflow-myWorkflow' });
    expect(link.getAttribute('href')).toBe('/workflows/myWorkflow');
    expect(within(tools).queryByRole('link', { name: 'workflow-' })).toBeNull();
  });

  it('links a workflow the model called from the opened tool call, and only that call', () => {
    renderWithLinks(calledWorkflowSpan);

    expect(screen.queryAllByRole('link')).toHaveLength(0);
    for (const button of screen.getAllByRole('button', { name: /^(Workflow myWorkflow|CookingTool)$/ })) {
      fireEvent.click(button);
    }
    expect(workflowLinks().map(link => [link.textContent, link.getAttribute('href')])).toEqual([
      ['myWorkflow', '/workflows/myWorkflow'],
    ]);
  });

  it('links the workflow a run suspended in', () => {
    renderWithLinks(suspendedInWorkflowSpan);

    expect(workflowLinks().map(link => [link.textContent, link.getAttribute('href')])).toEqual([
      ['workflow-myWorkflow', '/workflows/myWorkflow'],
    ]);
  });

  it('links the workflow a run resumed into', () => {
    renderWithLinks(resumedIntoWorkflowSpan);

    expect(workflowLinks().map(link => [link.textContent, link.getAttribute('href')])).toEqual([
      ['workflow-myWorkflow', '/workflows/myWorkflow'],
    ]);
  });

  it('links the workflow whose result a processor handled', () => {
    renderWithLinks(workflowResultProcessorSpan);

    expect(workflowLinks().map(link => [link.textContent, link.getAttribute('href')])).toEqual([
      ['workflow-myWorkflow', '/workflows/myWorkflow'],
    ]);
  });
});
