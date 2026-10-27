// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SpanRecord } from '../../../types';
import { SpanDataPanelView } from '../../span-data-panel-view';
import { SpanDetailsView } from '../../span-details-view';
import { makeSpan, modelToolsSpan, processorToolsSpan } from './fixtures/span-payloads';
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

const LAYOUTS = [
  ['data panel', (span: SpanRecord) => <SpanDataPanelView traceId="t" spanId="s" span={span} />],
  ['details', (span: SpanRecord) => <SpanDetailsView traceId="t" spanId="s" span={span} />],
] as const;

const toolsSection = () => {
  const found = screen.getByText(/^Tools \(\d+\)$/).closest('[data-slot="span-payload-section"]');
  if (!(found instanceof HTMLElement)) throw new Error('Missing Tools section');
  return found;
};

describe.each(LAYOUTS)('Tools section (%s)', (_layout, renderSpan) => {
  const renderWithLinks = (span: SpanRecord) =>
    renderWithProviders(<TestLinkProvider>{renderSpan(span)}</TestLinkProvider>);

  describe('when a processor span recorded the tools offered to the model', () => {
    it('lists each tool with its description', () => {
      renderWithLinks(processorToolsSpan);

      const section = toolsSection();
      expect(within(section).getByText('Tools (2)')).toBeTruthy();
      expect(within(section).getByText('Suggests a recipe from what is in the fridge.')).toBeTruthy();
      expect(within(section).getByText('Reads a workspace file.')).toBeTruthy();
    });

    it('links a registered tool to its page, and leaves a tool the registry does not know as text', async () => {
      renderWithLinks(processorToolsSpan);

      const link = await within(toolsSection()).findByRole('link', { name: 'cooking-tool' });
      expect(link.getAttribute('href')).toBe('/tools/cooking-tool');
      expect(within(toolsSection()).queryByRole('link', { name: 'mastra_workspace_read_file' })).toBeNull();
      expect(within(toolsSection()).getByText('mastra_workspace_read_file')).toBeTruthy();
    });

    it('leaves the tools and tool choice out of the input, since the Tools section shows them', () => {
      renderWithLinks(processorToolsSpan);

      const input = screen.getByText('Input').closest('[data-slot="span-payload-section"]');
      if (!(input instanceof HTMLElement)) throw new Error('Missing Input section');
      expect(within(input).queryByText(/^Tools/)).toBeNull();
      expect(within(input).queryByText('Tool choice')).toBeNull();
      expect(within(input).getByText('What should I cook tonight?')).toBeTruthy();
    });
  });

  describe('when a model span recorded its tool definitions', () => {
    it('links a definition by its registry key', async () => {
      renderWithLinks(modelToolsSpan);

      const link = await within(toolsSection()).findByRole('link', { name: 'cookingTool' });
      expect(link.getAttribute('href')).toBe('/tools/cooking-tool');
    });
  });

  describe('when the span offered no tools', () => {
    it('has no Tools section', () => {
      renderWithLinks(makeSpan({ spanId: 'span-no-tools', input: { prompt: 'hi' } }));

      expect(screen.queryByText(/^Tools \(\d+\)$/)).toBeNull();
    });
  });
});
