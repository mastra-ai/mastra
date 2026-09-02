// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TraceStatusValue } from './trace-status-value';

afterEach(cleanup);

describe('TraceStatusValue', () => {
  it.each([
    ['success', 'Success', 'text-green-9'],
    ['error', 'Error', 'text-red-9'],
    ['running', 'Running', 'text-gray-10'],
  ] as const)('renders the %s status with its semantic color', (status, label, colorClass) => {
    render(<TraceStatusValue status={status} />);

    const value = screen.getByText(label);
    expect(value.classList.contains(colorClass)).toBe(true);
    expect(value.classList.contains('shimmer-text')).toBe(status === 'running');
  });
});
