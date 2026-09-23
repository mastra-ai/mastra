// @vitest-environment jsdom
import { cleanup, render, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ToolCallContextValue } from '../tool-call-context';
import { ToolCallProvider, useToolCall } from '../tool-call-context';

afterEach(() => cleanup());

const baseValue: ToolCallContextValue = {
  approveToolcall: vi.fn(),
  declineToolcall: vi.fn(),
  approveToolcallGenerate: vi.fn(),
  declineToolcallGenerate: vi.fn(),
  approveNetworkToolcall: vi.fn(),
  declineNetworkToolcall: vi.fn(),
  isRunning: false,
  toolCallApprovals: { 'call-1': { status: 'approved' } },
  networkToolCallApprovals: {},
};

const wrapperFor = (value: ToolCallContextValue) =>
  function Wrapper({ children }: { children: ReactNode }) {
    return <ToolCallProvider {...value}>{children}</ToolCallProvider>;
  };

describe('useToolCall', () => {
  it('throws when used outside ToolCallProvider', () => {
    expect(() => renderHook(() => useToolCall())).toThrow('useToolCall must be used within a ToolCallProvider');
  });

  it('exposes the handlers and approvals passed to the provider', () => {
    const { result } = renderHook(() => useToolCall(), { wrapper: wrapperFor(baseValue) });

    result.current.approveToolcall('call-1', { ok: true });

    expect(baseValue.approveToolcall).toHaveBeenCalledWith('call-1', { ok: true });
    expect(result.current.toolCallApprovals).toBe(baseValue.toolCallApprovals);
    expect(result.current.isRunning).toBe(false);
  });

  it('keeps a stable context value across re-renders with the same props', () => {
    const { result, rerender } = renderHook(() => useToolCall(), { wrapper: wrapperFor(baseValue) });
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });

  it('produces a new context value when a prop changes', () => {
    const seen: ToolCallContextValue[] = [];
    const Probe = () => {
      seen.push(useToolCall());
      return null;
    };
    const tree = (isRunning: boolean) => (
      <ToolCallProvider {...baseValue} isRunning={isRunning}>
        <Probe />
      </ToolCallProvider>
    );

    const { rerender } = render(tree(false));
    rerender(tree(true));

    expect(seen).toHaveLength(2);
    expect(seen[1]).not.toBe(seen[0]);
    expect(seen[1].isRunning).toBe(true);
  });
});
