// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useSearchParams } from 'react-router';
import { describe, expect, it } from 'vitest';

import { useTargetFilterParams, type TargetFilterParamsOptions } from '../use-target-filter-params';

const renderParams = (initialEntry: string, options?: TargetFilterParamsOptions) => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>
  );
  return renderHook(() => ({ params: useTargetFilterParams(options), search: useSearchParams()[0].toString() }), {
    wrapper,
  });
};

describe('useTargetFilterParams', () => {
  it('reads targetType and targetId from the URL', () => {
    const { result } = renderParams('/?targetType=agent&targetId=agent-1');
    expect(result.current.params.targetType).toBe('agent');
    expect(result.current.params.targetId).toBe('agent-1');
  });

  it('ignores an unknown targetType (and its id)', () => {
    const { result } = renderParams('/?targetType=bogus&targetId=x');
    expect(result.current.params.targetType).toBe('');
    expect(result.current.params.targetId).toBe('');
  });

  it('drops targetId when the type changes and keeps unrelated params', () => {
    const { result } = renderParams('/?dataset=ds-1&targetType=agent&targetId=agent-1');
    act(() => result.current.params.setTargetType('workflow'));
    expect(result.current.search).toBe('dataset=ds-1&targetType=workflow');
  });

  it('removes both params on clear', () => {
    const { result } = renderParams('/?dataset=ds-1&targetType=agent&targetId=agent-1');
    act(() => result.current.params.clear());
    expect(result.current.search).toBe('dataset=ds-1');
  });

  it('drops the configured reset params when the target changes', () => {
    const { result } = renderParams('/?targetType=agent&targetId=agent-1&experiment=exp-1&review=res-1', {
      resetParams: ['experiment', 'review'],
    });
    act(() => result.current.params.setTargetId('agent-2'));
    expect(result.current.search).toBe('targetType=agent&targetId=agent-2');

    act(() => result.current.params.setTargetType('scorer'));
    expect(result.current.search).toBe('targetType=scorer');
  });
});
