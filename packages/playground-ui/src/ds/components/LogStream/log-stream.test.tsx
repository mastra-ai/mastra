// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LogStream } from './index';
import { TooltipProvider } from '@/ds/components/Tooltip';

afterEach(cleanup);

const trace = [
  'Error: boom',
  '    at a (a.js:1:1)',
  '    at b (b.js:2:2)',
  '    at c (c.js:3:3)',
  '    at d (d.js:4:4)',
].join('\n');

describe('LogStream', () => {
  it('opens a clickable line without submitting a surrounding form', () => {
    const onSubmit = vi.fn();
    const onClick = vi.fn();
    render(
      <form onSubmit={onSubmit}>
        <LogStream>
          <LogStream.RowButton level="info" onClick={onClick}>
            <LogStream.Line timestamp="2026-11-24T09:31:07.956Z" level="info" message="Process.Start stream ended" />
          </LogStream.RowButton>
        </LogStream>
      </form>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Process\.Start stream ended/ }));

    expect(onClick).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows a read-only line as text that cannot be clicked or focused', () => {
    render(
      <LogStream>
        <LogStream.Row level="info">
          <LogStream.Line timestamp="2026-11-24T09:31:07.956Z" level="info" message="Process.Start stream ended" />
        </LogStream.Row>
      </LogStream>,
    );

    expect(screen.getByText('Process.Start stream ended')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('puts time, level and message in order, with fields after the message', () => {
    render(
      <LogStream>
        <LogStream.Row level="warn">
          <LogStream.Line
            timestamp="2026-11-24T09:29:30.956Z"
            level="warn"
            message="Memory usage above 80% of limit"
            fields={{ used_mb: '842' }}
          />
        </LogStream.Row>
      </LogStream>,
    );

    const time = screen.getByText((_, element) => element?.tagName === 'TIME');
    expect(time.getAttribute('dateTime')).toBe('2026-11-24T09:29:30.956Z');
    expect(time.parentElement?.nextElementSibling?.textContent).toBe('warn');
    expect(time.parentElement?.parentElement?.textContent).toContain('Memory usage above 80% of limitused_mb: 842');
  });

  it('collapses a long stack trace to three lines unless told not to', () => {
    const { rerender } = render(
      <LogStream>
        <LogStream.Row level="error">
          <LogStream.Line timestamp="2026-11-24T09:35:58.956Z" level="error" message={trace} />
        </LogStream.Row>
      </LogStream>,
    );
    expect(screen.getByText('+2 more lines')).toBeTruthy();

    rerender(
      <LogStream>
        <LogStream.Row level="error">
          <LogStream.Line timestamp="2026-11-24T09:35:58.956Z" level="error" message={trace} collapse={false} />
        </LogStream.Row>
      </LogStream>,
    );
    expect(screen.queryByText('+2 more lines')).toBeNull();
    expect(screen.getByText(/at d \(d\.js:4:4\)/)).toBeTruthy();
  });

  it('shows build output without a time or level, with a named icon and terminal colors', () => {
    const esc = String.fromCharCode(27);
    render(
      <LogStream>
        <LogStream.Row>
          <LogStream.Line
            message={`${esc}[32mCompiled successfully${esc}[0m`}
            icon={{ element: <svg />, label: 'Build' }}
          />
        </LogStream.Row>
      </LogStream>,
    );

    expect(screen.queryByText((_, element) => element?.tagName === 'TIME')).toBeNull();
    expect(screen.getByRole('img', { name: 'Build' })).toBeTruthy();
    const colored = screen.getByText('Compiled successfully');
    expect(colored.textContent).not.toContain(esc);
  });

  it('explains a time like RelativeTimestamp, with each zone to the hundredth of a second', async () => {
    render(
      <TooltipProvider delay={0}>
        <LogStream>
          <LogStream.Row level="info">
            <LogStream.Line timestamp="2026-11-24T09:31:07.956Z" level="info" message="Process.Start stream ended" />
          </LogStream.Row>
        </LogStream>
      </TooltipProvider>,
    );

    const time = screen.getByText((_, element) => element?.tagName === 'TIME');
    fireEvent.pointerEnter(time);
    fireEvent.mouseEnter(time);
    fireEvent.pointerMove(time);
    fireEvent.mouseMove(time);

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip.textContent).toContain('UTC');
    expect(tooltip.textContent).toMatch(/9:31:07\.95/);
    expect(tooltip.textContent).not.toMatch(/\.956/);
  });
});
