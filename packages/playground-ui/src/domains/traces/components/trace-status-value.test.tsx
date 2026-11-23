// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TraceStatusValue } from './trace-status-value';

afterEach(cleanup);

describe('TraceStatusValue', () => {
  it.each([
    ['success', 'Success', 'bg-badge-green-subtle'],
    ['error', 'Error', 'bg-badge-red-subtle'],
    ['running', 'Running', 'bg-fill-subtle'],
  ] as const)('reads a %s status in a matching badge, and shimmers only while it runs', (status, label, tone) => {
    render(<TraceStatusValue status={status} />);

    const text = screen.getByText(label);
    expect(text.classList.contains('shimmer-text')).toBe(status === 'running');
    expect(text.parentElement?.classList.contains(tone)).toBe(true);
  });
});
