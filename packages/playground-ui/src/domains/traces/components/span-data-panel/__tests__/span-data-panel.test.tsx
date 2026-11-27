// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import type { SpanTab } from '../../../types';
import { spanFixture } from '../../__tests__/fixtures/span-data-panel-view';
import { toolCallsGenerationSpan, TOOL_CALLS_TRACE_ID } from '../../span-payload/__tests__/fixtures/span-tool-calls';
import { SpanDataPanel } from '../index';
import type { SpanDataPanelProps } from '../index';

// jsdom does not provide PointerEvent, which Base UI tabs dispatch.
beforeAll(() => vi.stubGlobal('PointerEvent', MouseEvent));
afterAll(() => vi.unstubAllGlobals());

type PanelProps = Partial<SpanDataPanelProps>;

/** Rendered without a Mastra client or a React Query provider: a part that fetched would throw. */
const renderPanel = (props: PanelProps = {}) =>
  render(<SpanDataPanel traceId="trace-1" spanId="span-1" span={spanFixture} {...props} />);

const everyTab: PanelProps = {
  header: (
    <SpanDataPanel.Header
      identity={<SpanDataPanel.Identity />}
      actions={<SpanDataPanel.CloseButton onClose={() => {}} />}
    />
  ),
  details: <SpanDataPanel.Details />,
  input: <SpanDataPanel.Input />,
  output: <SpanDataPanel.Output />,
  feedback: <p>Host feedback</p>,
};

const tabNames = () => screen.getAllByRole('tab').map(tab => tab.textContent);

describe('SpanDataPanel', () => {
  describe('when the host fills every slot', () => {
    it('offers Details, Input, Output and Feedback, in that order, on Details', () => {
      renderPanel(everyTab);

      expect(tabNames()).toEqual(['Details', 'Input', 'Output', 'Feedback']);
      expect(screen.getByRole('tabpanel', { name: 'Details' })).toBeTruthy();
    });

    it('names the panel after the span', () => {
      renderPanel(everyTab);

      expect(screen.getByRole('region', { name: 'agent run' })).toBeTruthy();
    });

    it('shows what the host put in the feedback slot on its tab', () => {
      renderPanel(everyTab);

      fireEvent.click(screen.getByRole('tab', { name: /Feedback/ }));

      expect(screen.getByText('Host feedback')).toBeTruthy();
    });

    it('counts the feedback on its tab', () => {
      renderPanel({ ...everyTab, feedbackCount: 3 });

      expect(tabNames()).toContain('Feedback (3)');
    });
  });

  describe('when the host leaves a tab slot empty', () => {
    it('offers no tab for it', () => {
      renderPanel({ details: <SpanDataPanel.Details />, output: <SpanDataPanel.Output /> });

      expect(tabNames()).toEqual(['Details', 'Output']);
    });

    it('opens the first offered tab when the asked one is not offered', () => {
      renderPanel({ output: <SpanDataPanel.Output />, activeTab: 'feedback' });

      expect(screen.getByRole('tabpanel', { name: 'Output' })).toBeTruthy();
    });
  });

  describe('when the host leaves the header out', () => {
    it('draws no header controls', () => {
      renderPanel({ details: <SpanDataPanel.Details /> });

      expect(screen.queryByRole('button', { name: 'Close span' })).toBeNull();
      expect(screen.getByRole('region', { name: 'agent run' })).toBeTruthy();
    });
  });

  describe('when the host puts its own elements in the header', () => {
    it('renders its action next to the standard ones', () => {
      const onShowTrace = vi.fn();
      renderPanel({
        header: (
          <SpanDataPanel.Header
            identity={<SpanDataPanel.Identity />}
            actions={
              <>
                <button type="button">Pin span</button>
                <SpanDataPanel.ShowTraceButton onShowTrace={onShowTrace} />
              </>
            }
          />
        ),
        details: <SpanDataPanel.Details />,
      });

      fireEvent.click(screen.getByRole('button', { name: 'Go to trace' }));

      expect(screen.getByRole('button', { name: 'Pin span' })).toBeTruthy();
      expect(onShowTrace).toHaveBeenCalledWith({ traceId: 'trace-1', spanId: 'span-1' });
    });

    it('steps through spans with the navigation the host wires', () => {
      const onNext = vi.fn();
      renderPanel({
        header: <SpanDataPanel.Header actions={<SpanDataPanel.Navigation onNext={onNext} />} />,
        details: <SpanDataPanel.Details />,
      });

      fireEvent.click(screen.getByRole('button', { name: 'Go to next span' }));

      expect(onNext).toHaveBeenCalledOnce();
    });
  });

  describe('when the host controls the open tab', () => {
    function Controlled({ onTabChange }: { onTabChange: (tab: SpanTab) => void }) {
      const [tab, setTab] = useState<SpanTab>('output');
      return (
        <SpanDataPanel
          traceId="trace-1"
          spanId="span-1"
          span={spanFixture}
          activeTab={tab}
          onTabChange={next => {
            setTab(next);
            onTabChange(next);
          }}
          details={<SpanDataPanel.Details />}
          output={<SpanDataPanel.Output />}
        />
      );
    }

    it('opens the tab it asks for', () => {
      render(<Controlled onTabChange={() => {}} />);

      expect(screen.getByRole('tabpanel', { name: 'Output' })).toBeTruthy();
    });

    it('reports the tab the reader opens', () => {
      const onTabChange = vi.fn<(tab: SpanTab) => void>();
      render(<Controlled onTabChange={onTabChange} />);

      fireEvent.click(screen.getByRole('tab', { name: /Details/ }));

      expect(onTabChange).toHaveBeenCalledWith('details');
    });
  });

  describe('when the reader reads a payload as JSON', () => {
    it('keeps reading the other payload as JSON', () => {
      render(
        <SpanDataPanel
          traceId={TOOL_CALLS_TRACE_ID}
          spanId="generation"
          // Text only: tool calls render through the chat renderer, which loads MCP app tools.
          span={{ ...toolCallsGenerationSpan, output: { text: 'No rain is expected.' } }}
          input={<SpanDataPanel.Input />}
          output={<SpanDataPanel.Output />}
        />,
      );

      fireEvent.click(screen.getByRole('tab', { name: /Input/ }));
      fireEvent.click(screen.getByRole('button', { name: 'Show input as JSON' }));
      fireEvent.click(screen.getByRole('tab', { name: /Output/ }));

      expect(screen.getByRole('group', { name: 'Output' }).dataset.view).toBe('raw');
    });
  });

  describe('when the span failed', () => {
    it('flags the Output tab', () => {
      renderPanel({
        details: <SpanDataPanel.Details />,
        output: <SpanDataPanel.Output />,
        span: { ...spanFixture, error: { message: 'boom' } },
      });

      expect(screen.getByRole('tab', { name: /Output/ }).querySelector('[data-slot="tab-attention"]')).not.toBeNull();
    });
  });

  describe('when the span record is still loading', () => {
    it('says so instead of the tabs', () => {
      renderPanel({ ...everyTab, span: undefined, isLoading: true });

      expect(screen.getByText('Loading span details...')).toBeTruthy();
      expect(screen.queryByRole('tab')).toBeNull();
    });
  });

  describe('when the span was not found', () => {
    it('says so', () => {
      renderPanel({ ...everyTab, span: undefined });

      expect(screen.getByText('Span not found.')).toBeTruthy();
    });

    it('keeps the header to close it', () => {
      renderPanel({ ...everyTab, span: undefined });

      expect(
        within(screen.getByRole('region', { name: 'Span' })).getByRole('button', { name: 'Close span' }),
      ).toBeTruthy();
    });
  });
});
