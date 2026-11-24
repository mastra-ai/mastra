// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { SpanRecord } from '../../../types';
import { SpanDataPanelView } from '../../span-data-panel-view';
import { SpanDetailsView } from '../../span-details-view';
import type { TraceNavigation } from '../../trace-navigation';
import { makeSpan, modelToolsSpan, processorToolsSpan } from './fixtures/span-payloads';
import { registeredTools } from './fixtures/tools';

// jsdom does not provide PointerEvent, which Base UI switches dispatch.
beforeAll(() => vi.stubGlobal('PointerEvent', MouseEvent));
afterAll(() => vi.unstubAllGlobals());

const section = (selector: string, name: string) => () => {
  const found = screen.getByText(name).closest(selector);
  if (!(found instanceof HTMLElement)) throw new Error(`Missing ${name} section`);
  return found;
};

const LAYOUTS = [
  {
    layout: 'data panel',
    // Tools sit in the Input tab, under the input they were offered with.
    renderSpan: (span: SpanRecord, navigation?: TraceNavigation) => (
      <SpanDataPanelView
        traceId="t"
        spanId="s"
        span={span}
        activeTab="input"
        registeredTools={registeredTools}
        navigation={navigation}
      />
    ),
    toolsSection: () => screen.getByRole('region', { name: 'Available tools' }),
    toolsHeading: (tools: HTMLElement, count: number) => {
      const heading = within(tools).getByText('Available tools');
      return within(heading).getByText(String(count));
    },
    inputSection: () => screen.getByRole('tabpanel', { name: 'Input' }),
  },
  {
    layout: 'details',
    renderSpan: (span: SpanRecord, navigation?: TraceNavigation) => (
      <SpanDetailsView traceId="t" spanId="s" span={span} registeredTools={registeredTools} navigation={navigation} />
    ),
    toolsSection: () => {
      const found = screen.getByText(/^Available tools \(\d+\)$/).closest('[data-slot="span-payload-section"]');
      if (!(found instanceof HTMLElement)) throw new Error('Missing Tools section');
      return found;
    },
    toolsHeading: (tools: HTMLElement, count: number) => within(tools).getByText(`Available tools (${count})`),
    inputSection: section('[data-slot="span-payload-section"]', 'Input'),
  },
] as const;

describe.each(LAYOUTS)('Tools section ($layout)', ({ renderSpan, toolsSection, toolsHeading, inputSection }) => {
  // No provider: the host opens tools through its own callback.
  const renderWithLinks = (span: SpanRecord) => {
    const navigation = { onOpenTool: vi.fn() };
    const view = render(renderSpan(span, navigation));
    return { ...view, navigation };
  };

  describe('when a processor span recorded the tools offered to the model', () => {
    it('lists each tool with its description', () => {
      renderWithLinks(processorToolsSpan);

      const tools = toolsSection();
      expect(toolsHeading(tools, 2)).toBeTruthy();
      expect(within(tools).getByText('Suggests a recipe from what is in the fridge.')).toBeTruthy();
      expect(within(tools).getByText('Reads a workspace file.')).toBeTruthy();
    });

    it('opens a registered tool through onOpenTool, and leaves a tool the registry does not know as text', async () => {
      const { navigation } = renderWithLinks(processorToolsSpan);

      fireEvent.click(await within(toolsSection()).findByRole('button', { name: 'cooking-tool' }));

      expect(navigation.onOpenTool).toHaveBeenCalledWith('cooking-tool');
      expect(within(toolsSection()).queryByRole('button', { name: 'mastra_workspace_read_file' })).toBeNull();
      expect(within(toolsSection()).getByText('mastra_workspace_read_file')).toBeTruthy();
    });

    it('shows every tool as text when the host does not navigate', () => {
      render(renderSpan(processorToolsSpan));

      expect(within(toolsSection()).queryByRole('button', { name: 'cooking-tool' })).toBeNull();
      expect(within(toolsSection()).getByText('cooking-tool')).toBeTruthy();
    });

    it('leaves the tools and tool choice out of the input, since the Tools section shows them', () => {
      renderWithLinks(processorToolsSpan);

      const input = inputSection();
      expect(within(input).queryByText(/^Available tools \(/)).toBeNull();
      expect(within(input).queryByText('Tool choice')).toBeNull();
      expect(within(input).getByText('What should I cook tonight?')).toBeTruthy();
    });
  });

  describe('when a model span recorded its tool definitions', () => {
    it('opens a definition by its registry key', async () => {
      const { navigation } = renderWithLinks(modelToolsSpan);

      fireEvent.click(await within(toolsSection()).findByRole('button', { name: 'cookingTool' }));

      expect(navigation.onOpenTool).toHaveBeenCalledWith('cooking-tool');
    });
  });

  describe('when the span offered no tools', () => {
    it('has no Tools section', () => {
      renderWithLinks(makeSpan({ spanId: 'span-no-tools', input: { prompt: 'hi' } }));

      expect(screen.queryByText(/^Available tools/)).toBeNull();
    });
  });
});
