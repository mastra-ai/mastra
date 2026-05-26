// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useAgentBuilderInternalRedirect } from '../use-agent-builder-internal-redirect';

const { useStoredAgentsMock } = vi.hoisted(() => ({
  useStoredAgentsMock: vi.fn(),
}));

vi.mock('@/domains/agents/hooks/use-stored-agents', () => ({
  useStoredAgents: useStoredAgentsMock,
}));

type Result = { data?: { agents?: unknown[] }; isLoading: boolean };

const mockStoredAgents = (drafts: Result, published: Result) => {
  useStoredAgentsMock.mockImplementation((params?: { status?: string }) => {
    if (params?.status === 'draft') return drafts;
    if (params?.status === 'published') return published;
    throw new Error(`Unexpected useStoredAgents params: ${JSON.stringify(params)}`);
  });
};

afterEach(() => {
  useStoredAgentsMock.mockReset();
});

describe('useAgentBuilderInternalRedirect', () => {
  it('queries both draft and published stored agents', () => {
    mockStoredAgents({ data: { agents: [] }, isLoading: false }, { data: { agents: [] }, isLoading: false });

    renderHook(() => useAgentBuilderInternalRedirect());

    expect(useStoredAgentsMock).toHaveBeenCalledTimes(2);
    expect(useStoredAgentsMock).toHaveBeenNthCalledWith(1, { status: 'draft' });
    expect(useStoredAgentsMock).toHaveBeenNthCalledWith(2, { status: 'published' });
  });

  it('reports isLoading=true when only the draft query is loading', () => {
    mockStoredAgents({ data: undefined, isLoading: true }, { data: { agents: [] }, isLoading: false });

    const { result } = renderHook(() => useAgentBuilderInternalRedirect());

    expect(result.current).toEqual({ isLoading: true, hasAgents: false });
  });

  it('reports isLoading=true when only the published query is loading', () => {
    mockStoredAgents({ data: { agents: [] }, isLoading: false }, { data: undefined, isLoading: true });

    const { result } = renderHook(() => useAgentBuilderInternalRedirect());

    expect(result.current).toEqual({ isLoading: true, hasAgents: false });
  });

  it('reports isLoading=true when both queries are loading', () => {
    mockStoredAgents({ data: undefined, isLoading: true }, { data: undefined, isLoading: true });

    const { result } = renderHook(() => useAgentBuilderInternalRedirect());

    expect(result.current).toEqual({ isLoading: true, hasAgents: false });
  });

  it('reports hasAgents=false when both lists are empty', () => {
    mockStoredAgents({ data: { agents: [] }, isLoading: false }, { data: { agents: [] }, isLoading: false });

    const { result } = renderHook(() => useAgentBuilderInternalRedirect());

    expect(result.current).toEqual({ isLoading: false, hasAgents: false });
  });

  it('reports hasAgents=true when only drafts exist', () => {
    mockStoredAgents(
      { data: { agents: [{ id: 'a1' }] }, isLoading: false },
      { data: { agents: [] }, isLoading: false },
    );

    const { result } = renderHook(() => useAgentBuilderInternalRedirect());

    expect(result.current).toEqual({ isLoading: false, hasAgents: true });
  });

  it('reports hasAgents=true when only published agents exist', () => {
    mockStoredAgents(
      { data: { agents: [] }, isLoading: false },
      { data: { agents: [{ id: 'p1' }] }, isLoading: false },
    );

    const { result } = renderHook(() => useAgentBuilderInternalRedirect());

    expect(result.current).toEqual({ isLoading: false, hasAgents: true });
  });

  it('reports hasAgents=true when both lists contain agents', () => {
    mockStoredAgents(
      { data: { agents: [{ id: 'a1' }] }, isLoading: false },
      { data: { agents: [{ id: 'p1' }, { id: 'p2' }] }, isLoading: false },
    );

    const { result } = renderHook(() => useAgentBuilderInternalRedirect());

    expect(result.current).toEqual({ isLoading: false, hasAgents: true });
  });

  it('treats missing data as empty agent lists', () => {
    mockStoredAgents({ data: undefined, isLoading: false }, { data: undefined, isLoading: false });

    const { result } = renderHook(() => useAgentBuilderInternalRedirect());

    expect(result.current).toEqual({ isLoading: false, hasAgents: false });
  });

  it('treats missing agents arrays as empty', () => {
    mockStoredAgents({ data: {}, isLoading: false }, { data: {}, isLoading: false });

    const { result } = renderHook(() => useAgentBuilderInternalRedirect());

    expect(result.current).toEqual({ isLoading: false, hasAgents: false });
  });
});
