// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SpanPayloadTool } from '../span-payload-tool';

afterEach(cleanup);

describe('SpanPayloadTool', () => {
  it.each([false, 0, null, ''])('preserves falsy input and output %j', value => {
    render(<SpanPayloadTool value={{ type: 'dynamic-tool', toolName: 'lookup', input: value, output: value }} />);
    fireEvent.click(screen.getByRole('button', { name: /lookup/i }));
    expect(screen.getAllByText(JSON.stringify(value)).length).toBe(2);
    expect(screen.getByRole('button', { name: /lookup/i }).getAttribute('aria-expanded')).toBe('true');
  });
  it('renders incompatible records as JSON', () => {
    render(<SpanPayloadTool value={{ type: 'tool-call', strange: true }} />);
    expect(screen.getByText(/strange/)).toBeTruthy();
  });
  it('shows explicit historical failures without execution actions', () => {
    render(
      <SpanPayloadTool
        value={{
          type: 'tool-invocation',
          toolInvocation: { toolName: 'lookup', state: 'result', isError: true, result: 'failed' },
        }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /lookup/i }));
    expect(screen.getByRole('img', { name: 'Failed' })).toBeTruthy();
    expect(screen.getByText('"failed"')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /approve|resume|execute/i })).toBeNull();
  });
});
