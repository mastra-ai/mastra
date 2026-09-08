// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TraceStatusValue } from './trace-status-value';

afterEach(cleanup);

describe('TraceStatusValue', () => {
  it.each([
    ['success', 'Success', 'text-accent1'],
    ['error', 'Error', 'text-error'],
    ['running', 'Running', 'text-neutral4'],
  ] as const)('renders the %s status with its semantic color', (status, label, colorClass) => {
    render(<TraceStatusValue status={status} />);

    const value = screen.getByText(label);
    expect(value.classList.contains(colorClass)).toBe(true);
    expect(value.classList.contains('shimmer-text')).toBe(status === 'running');
  });
});
