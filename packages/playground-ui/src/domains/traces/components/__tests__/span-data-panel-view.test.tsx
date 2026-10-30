// @vitest-environment jsdom
import { SpanType } from '@mastra/core/observability';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { SpanDataPanelView } from '../span-data-panel-view';
import type { SpanDataPanelViewProps } from '../span-data-panel-view';
import { spanFixture, traceFixture } from './fixtures/span-data-panel-view';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

// jsdom does not provide PointerEvent, which Base UI tabs dispatch.
beforeAll(() => vi.stubGlobal('PointerEvent', MouseEvent));
afterAll(() => vi.unstubAllGlobals());
beforeEach(() => {
  server.use(http.get(`${TEST_BASE_URL}/api/observability/traces/:traceId`, () => HttpResponse.json(traceFixture)));
});
afterEach(cleanup);

const baseProps: SpanDataPanelViewProps = {
  traceId: 'trace-1',
  spanId: 'span-1',
  span: spanFixture,
};

const valueOf = (label: string) => screen.getByText(label, { selector: 'dt' }).nextElementSibling?.textContent;

describe('SpanDataPanelView', () => {
  describe('header', () => {
    it('names the span and shows how long it took', () => {
      renderWithProviders(<SpanDataPanelView {...baseProps} />);

      expect(screen.getByRole('heading', { name: 'agent run' })).toBeTruthy();
      expect(screen.getByText('1s')).toBeTruthy();
    });

    describe('when the span belongs to an entity', () => {
      it('names it after the entity', () => {
        renderWithProviders(<SpanDataPanelView {...baseProps} span={{ ...spanFixture, entityName: 'chef-agent' }} />);

        expect(screen.getByRole('heading', { name: 'chef-agent' })).toBeTruthy();
      });
    });

    describe('when the span failed', () => {
      it('says so next to the name', () => {
        renderWithProviders(<SpanDataPanelView {...baseProps} span={{ ...spanFixture, error: { message: 'boom' } }} />);

        expect(screen.getByText('Failed')).toBeTruthy();
      });
    });

    describe('when the span succeeded', () => {
      it('adds no status badge', () => {
        renderWithProviders(<SpanDataPanelView {...baseProps} />);

        expect(screen.queryByText('Failed')).toBeNull();
        expect(screen.queryByText(/^Retried/)).toBeNull();
      });
    });
  });

  describe('tabs', () => {
    it('offers Details, Input and Output, with Details open by default', () => {
      renderWithProviders(<SpanDataPanelView {...baseProps} />);

      expect(screen.getByRole('tab', { name: /details/i }).getAttribute('aria-selected')).toBe('true');
      expect(screen.getByRole('tab', { name: /input/i })).toBeTruthy();
      expect(screen.getByRole('tab', { name: /output/i })).toBeTruthy();
      expect(screen.queryByRole('tab', { name: /feedback/i })).toBeNull();
    });

    it('uses the pill-ghost variant, like the agent page tabs', () => {
      const { container } = renderWithProviders(<SpanDataPanelView {...baseProps} />);

      expect(container.querySelector('[data-variant="pill-ghost"]')).not.toBeNull();
    });

    describe('when a feedback slot is provided', () => {
      it('adds a Feedback tab that renders the slot when opened', () => {
        renderWithProviders(<SpanDataPanelView {...baseProps} feedbackTabSlot={() => <div>feedback here</div>} />);

        expect(screen.queryByText('feedback here')).toBeNull();
        fireEvent.click(screen.getByRole('tab', { name: /feedback/i }));
        expect(screen.getByText('feedback here')).toBeTruthy();
      });
    });

    describe('when the caller asks for the feedback tab but offers no feedback', () => {
      it('falls back to Details', () => {
        renderWithProviders(<SpanDataPanelView {...baseProps} activeTab="feedback" />);

        expect(screen.getByRole('tab', { name: /details/i }).getAttribute('aria-selected')).toBe('true');
      });
    });

    it('reports the tab the user opens', () => {
      const onTabChange = vi.fn();
      renderWithProviders(<SpanDataPanelView {...baseProps} onTabChange={onTabChange} />);

      fireEvent.click(screen.getByRole('tab', { name: /output/i }));

      expect(onTabChange).toHaveBeenCalledWith('output');
    });

    it('keeps the open tab when another span is selected', () => {
      const { rerender } = renderWithProviders(<SpanDataPanelView {...baseProps} />);
      fireEvent.click(screen.getByRole('tab', { name: /input/i }));

      rerender(<SpanDataPanelView {...baseProps} spanId="span-2" span={{ ...spanFixture, spanId: 'span-2' }} />);

      expect(screen.getByRole('tab', { name: /input/i }).getAttribute('aria-selected')).toBe('true');
    });
  });

  describe('input and output tabs', () => {
    describe('when the span recorded no payload', () => {
      it('says so', () => {
        renderWithProviders(<SpanDataPanelView {...baseProps} activeTab="input" />);
        expect(screen.getByText('No input recorded.')).toBeTruthy();

        cleanup();
        renderWithProviders(<SpanDataPanelView {...baseProps} activeTab="output" />);
        expect(screen.getByText('No output recorded.')).toBeTruthy();
      });
    });

    describe('when the span failed', () => {
      it('flags the Output tab and explains the failure in it', () => {
        renderWithProviders(
          <SpanDataPanelView {...baseProps} activeTab="output" span={{ ...spanFixture, error: { message: 'boom' } }} />,
        );

        expect(screen.getByText('boom')).toBeTruthy();
      });
    });
  });

  describe('details tab', () => {
    it('lists when the span started and ended, and its precise duration', () => {
      renderWithProviders(<SpanDataPanelView {...baseProps} />);

      expect(screen.getByText('Started', { selector: 'dt' })).toBeTruthy();
      expect(screen.getByText('Ended', { selector: 'dt' })).toBeTruthy();
      expect(valueOf('Duration')).toBe('1.000 s');
    });

    describe('when the span streamed', () => {
      it('lists how long it took to stream its first chunk and first token', () => {
        renderWithProviders(
          <SpanDataPanelView
            {...baseProps}
            span={{ ...spanFixture, timeToFirstChunkMs: 412, timeToFirstTokenMs: 538 }}
          />,
        );

        expect(valueOf('Time to first chunk')).toBe('412 ms');
        expect(valueOf('Time to first token')).toBe('538 ms');
      });
    });

    describe('when the span did not stream', () => {
      it('lists neither timing', () => {
        renderWithProviders(
          <SpanDataPanelView
            {...baseProps}
            span={{ ...spanFixture, timeToFirstChunkMs: null, timeToFirstTokenMs: null }}
          />,
        );

        expect(screen.queryByText('Time to first chunk')).toBeNull();
        expect(screen.queryByText('Time to first token')).toBeNull();
      });
    });

    it('lists the ids the span has, each copyable, and skips the ones it does not', () => {
      renderWithProviders(
        <SpanDataPanelView {...baseProps} span={{ ...spanFixture, runId: 'run-1', sessionId: 'session-1' }} />,
      );

      const identifiers = screen.getByText('Identifiers').closest('section');
      if (!(identifiers instanceof HTMLElement)) throw new Error('Missing Identifiers section');
      expect(within(identifiers).getByText('span-1')).toBeTruthy();
      expect(within(identifiers).getByText('trace-1')).toBeTruthy();
      expect(within(identifiers).getByText('run-1')).toBeTruthy();
      expect(within(identifiers).getByText('session-1')).toBeTruthy();
      expect(within(identifiers).queryByText('Thread')).toBeNull();
      expect(within(identifiers).getByRole('button', { name: /copy run id/i })).toBeTruthy();
    });

    describe('when the span is a model call', () => {
      const modelSpan = {
        ...spanFixture,
        spanType: SpanType.MODEL_GENERATION,
        startedAt: new Date('2026-10-26T11:28:14.930Z'),
        endedAt: new Date('2026-10-26T11:28:20.504Z'),
        attributes: {
          model: 'gpt-5-mini',
          provider: 'openai',
          finishReason: 'stop',
          completionStartTime: '2026-10-26T11:28:16.376Z',
          usage: {
            inputTokens: 6606,
            outputTokens: 365,
            inputDetails: { cacheRead: 5632, cacheWrite: 0, text: 974 },
            outputDetails: { reasoning: 256, text: 109 },
          },
        },
      };

      it('names the span after the model', () => {
        renderWithProviders(<SpanDataPanelView {...baseProps} span={modelSpan} />);

        expect(screen.getByRole('heading', { name: 'gpt-5-mini' })).toBeTruthy();
      });

      it('lists the model, how it finished and its timings', () => {
        renderWithProviders(<SpanDataPanelView {...baseProps} span={modelSpan} />);

        expect(valueOf('Model')).toBe('gpt-5-mini');
        expect(screen.getByRole('img', { name: 'openai logo' })).toBeTruthy();
        expect(valueOf('Provider')).toBe('openai');
        expect(valueOf('Finish reason')).toBe('stop');
        expect(valueOf('First token')).toBe('1.45s');
        expect(valueOf('Speed')).toBe('88 tok/s');
      });

      it('lists its tokens with their breakdown, without the zero counts', () => {
        renderWithProviders(<SpanDataPanelView {...baseProps} span={modelSpan} />);

        expect(valueOf('Input tokens')).toBe('6,606 (5,632 cached · 974 text)');
        expect(valueOf('Output tokens')).toBe('365 (256 reasoning · 109 text)');
        expect(screen.queryByText(/cache write/i)).toBeNull();
      });
    });

    describe('when the span is not a model call', () => {
      it('shows no Model or Token usage section', () => {
        renderWithProviders(<SpanDataPanelView {...baseProps} />);

        expect(screen.queryByText('Model')).toBeNull();
        expect(screen.queryByText('Token usage')).toBeNull();
      });
    });
  });

  describe('close', () => {
    it('renders a close button only when onClose is provided, and calls it', () => {
      const { rerender } = renderWithProviders(<SpanDataPanelView {...baseProps} />);
      expect(screen.queryByRole('button', { name: 'Close span' })).toBeNull();

      const onClose = vi.fn();
      rerender(<SpanDataPanelView {...baseProps} onClose={onClose} />);
      fireEvent.click(screen.getByRole('button', { name: 'Close span' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('go to trace', () => {
    describe('when no onShowTrace callback is provided', () => {
      it('does not offer to go to the trace', () => {
        renderWithProviders(<SpanDataPanelView {...baseProps} />);

        expect(screen.queryByRole('button', { name: 'Go to trace' })).toBeNull();
      });
    });

    describe('when an onShowTrace callback is provided', () => {
      it('calls it with the trace and span ids', () => {
        const onShowTrace = vi.fn();
        renderWithProviders(<SpanDataPanelView {...baseProps} onShowTrace={onShowTrace} />);

        fireEvent.click(screen.getByRole('button', { name: 'Go to trace' }));

        expect(onShowTrace).toHaveBeenCalledWith({ traceId: 'trace-1', spanId: 'span-1' });
      });
    });
  });
});
