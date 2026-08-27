// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { format } from 'date-fns';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { TimelineEntry } from '../timeline-entry';
import { TestLinkProvider } from '@/test/link-provider';

afterEach(() => cleanup());

/** Entity links route through the framework `Link`, which needs its provider. */
const renderEntry = (ui: ReactElement) => render(<TestLinkProvider>{ui}</TestLinkProvider>);

describe('TimelineEntry', () => {
  it('keeps measurements off the first line and groups them in the dimmed meta line', () => {
    renderEntry(
      <TimelineEntry
        span={{
          spanId: 'a',
          spanType: 'model_generation',
          name: "llm: 'gpt-4o'",
          attributes: {
            model: 'gpt-4o',
            usage: { inputTokens: 120, outputTokens: 30 },
            costContext: { estimatedCost: 0.0042, costUnit: 'USD' },
          },
          startedAt: '2026-01-01T10:00:00.000Z',
          endedAt: '2026-01-01T10:00:01.500Z',
        }}
      />,
    );

    const meta = screen.getByTestId('timeline-entry-details').textContent ?? '';
    expect(meta).toContain('1.5 s');
    expect(meta).toContain('120 ↑ / 30 ↓ tokens');
    expect(meta).toContain('0.0042 USD');
    // the humanized name only restates the kind column and the subject: never print it twice
    expect(meta).not.toContain('Generated with model');
    expect(meta).not.toContain("llm: 'gpt-4o'");
  });

  it('states the wall clock once, in the gutter, and keeps the name on hover', () => {
    renderEntry(
      <TimelineEntry
        span={{
          spanId: 'a',
          spanType: 'processor_run',
          name: 'input processor: moderation',
          entityId: 'moderation',
          startedAt: '2026-01-01T10:00:00.000Z',
        }}
      />,
    );

    const clock = format(new Date('2026-01-01T10:00:00.000Z'), 'HH:mm:ss');
    const row = screen.getByTestId('timeline-entry');

    expect(row.textContent).toContain(clock);
    // The gutter already places the step in time: the meta line must not say it a second time.
    const details = screen.queryByTestId('timeline-entry-details')?.textContent ?? '';
    expect(details).not.toContain(clock);
    // "moderation" is already the subject on the first line: the sentence would just repeat it.
    expect(details).not.toContain('Ran processor moderation');

    // it stays reachable on hover, where it costs no visual space.
    expect(screen.getByTestId('timeline-entry').getAttribute('title')).toContain('Ran processor moderation');
  });

  it('links to the entity page when the step has an addressable one', () => {
    renderEntry(<TimelineEntry span={{ spanId: 'a', spanType: 'tool_call', entityId: 'weatherInfo' }} />);

    const link = screen.getByTestId('timeline-entry-link');
    expect(link.getAttribute('href')).toBe('/tools/weatherInfo');
    // the icon carries no text, so the label has to come from the accessible name
    expect(link.getAttribute('aria-label')).toContain('weatherInfo');
  });

  it('omits the link for steps with no addressable entity', () => {
    renderEntry(
      <TimelineEntry span={{ spanId: 'a', spanType: 'model_generation', attributes: { model: 'gpt-4o' } }} />,
    );

    expect(screen.queryByTestId('timeline-entry-link')).toBeNull();
  });

  it('marks failed spans and shows their message', () => {
    renderEntry(
      <TimelineEntry
        span={{ spanId: 'b', spanType: 'tool_call', entityId: 'weatherInfo', error: { message: 'API down' } }}
      />,
    );

    expect(screen.getByTestId('timeline-entry').getAttribute('data-error')).toBe('true');
    expect(screen.getByTestId('timeline-entry-error').textContent).toBe('API down');
  });

  it('renders successful spans without an error block', () => {
    renderEntry(<TimelineEntry span={{ spanId: 'c', spanType: 'tool_call', entityId: 'weatherInfo' }} />);

    expect(screen.getByTestId('timeline-entry').getAttribute('data-error')).toBeNull();
    expect(screen.queryByTestId('timeline-entry-error')).toBeNull();
  });

  it('offers the raw payloads under a collapsed disclosure', () => {
    renderEntry(
      <TimelineEntry
        span={{
          spanId: 'd',
          spanType: 'workspace_action',
          name: 'workspace:filesystem:read_file',
          input: { city: 'Paris' },
          output: { temp: 21 },
        }}
      />,
    );

    // the row prose only names the action; the payloads are what it never shows
    const trigger = screen.getByTestId('span-payload-details');
    expect(screen.queryByText(/"temp"/)).toBeNull();

    fireEvent.click(trigger);
    expect(screen.getByText(/"temp": 21/)).toBeTruthy();
  });

  it('omits the comment bubble when no trace is given', () => {
    renderEntry(<TimelineEntry span={{ spanId: 'f', spanType: 'tool_call', entityId: 'weatherInfo' }} />);

    expect(screen.queryByRole('button', { name: /comment/i })).toBeNull();
  });

  it('offers a comment bubble carrying the span comment count', () => {
    renderEntry(
      <TimelineEntry
        span={{ spanId: 'f', spanType: 'tool_call', entityId: 'weatherInfo' }}
        traceId="trace-1"
        feedbackCount={3}
      />,
    );

    expect(screen.getByRole('button', { name: 'Comments on this step (3)' })).toBeTruthy();
  });

  it('omits the disclosure for spans with nothing left to show', () => {
    renderEntry(
      <TimelineEntry span={{ spanId: 'e', spanType: 'workspace_action', name: 'workspace:filesystem:read_file' }} />,
    );

    expect(screen.queryByTestId('span-payload-details')).toBeNull();
  });

  it('leaves the generic disclosure off a tool call, which carries its own payload', () => {
    renderEntry(
      <TimelineEntry
        span={{ spanId: 'g', spanType: 'tool_call', entityId: 'weatherInfo', input: { city: 'Paris' } }}
      />,
    );

    expect(screen.queryByTestId('span-payload-details')).toBeNull();
    expect(screen.getByTestId('tool-call-entry')).toBeTruthy();
  });

  it('leaves it off a model generation too, whose prompt already opens on the row', () => {
    renderEntry(
      <TimelineEntry
        span={{
          spanId: 'h',
          spanType: 'model_generation',
          attributes: { model: 'gpt-4o', prompt: [{ role: 'user', content: 'hi' }] },
          output: { text: 'hello' },
        }}
      />,
    );

    expect(screen.queryByTestId('span-payload-details')).toBeNull();
  });
});
