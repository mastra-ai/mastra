// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { TraceStatusValue } from './trace-status-value';

afterEach(cleanup);

describe('TraceStatusValue', () => {
  it.each([
    ['success', 'Success'],
    ['error', 'Error'],
    ['running', 'Running'],
  ] as const)('reads a %s status, and shimmers only while it runs', (status, label) => {
    render(<TraceStatusValue status={status} />);

    expect(screen.getByText(label).classList.contains('shimmer-text')).toBe(status === 'running');
  });
});
