import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '@/test/msw-server';
import { makeWrapper, renderHookWithProviders, TEST_BASE_URL } from '@/test/render';
import {
  useBuilderModelPolicy,
  useBuilderPickerVisibility,
  useBuilderSettings,
  useIsBuilderEnabled,
} from '../use-builder-settings';
import { builderSettingsWithPolicy, disabledBuilderSettings } from './fixtures/editor-builder-settings';

describe('when Studio resolves Agent Builder settings', () => {
  it('uses server-resolved feature gates, model policy, picker allowlists, and warnings', async () => {
    server.use(
      http.get(`${TEST_BASE_URL}/api/editor/builder/settings`, () => HttpResponse.json(builderSettingsWithPolicy)),
    );

    const { wrapper } = makeWrapper();
    const settings = renderHook(() => useBuilderSettings(), { wrapper });
    const enabled = renderHook(() => useIsBuilderEnabled(), { wrapper });
    const policy = renderHook(() => useBuilderModelPolicy(), { wrapper });
    const picker = renderHook(() => useBuilderPickerVisibility(), { wrapper });

    await waitFor(() => expect(settings.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(enabled.result.current.isLoading).toBe(false));

    expect(enabled.result.current.isEnabled).toBe(true);
    expect(settings.result.current.data?.features?.agent?.favorites).toBe(true);
    expect(settings.result.current.data?.features?.agent?.browser).toBe(true);
    expect(settings.result.current.data?.modelPolicyWarnings).toEqual(['Unknown picker id: missingWorkflow']);
    expect(policy.result.current).toEqual({ active: false });
    expect(picker.result.current.visibleTools).toEqual(new Set(['weatherTool']));
    expect(picker.result.current.visibleAgents).toBeNull();
    expect(picker.result.current.visibleWorkflows).toEqual(new Set());
  });

  it('returns disabled builder state and gates the request when disabled by options', async () => {
    const onSettings = vi.fn();
    server.use(
      http.get(`${TEST_BASE_URL}/api/editor/builder/settings`, () => {
        onSettings();
        return HttpResponse.json(disabledBuilderSettings);
      }),
    );

    const { wrapper } = makeWrapper();
    const enabled = renderHook(() => useIsBuilderEnabled(), { wrapper });

    await waitFor(() => expect(enabled.result.current.isLoading).toBe(false));
    expect(enabled.result.current.isEnabled).toBe(false);
    expect(onSettings).toHaveBeenCalledTimes(1);

    const gated = renderHookWithProviders(() => useBuilderSettings({ enabled: false }));
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(gated.result.current.fetchStatus).toBe('idle');
    expect(onSettings).toHaveBeenCalledTimes(1);
  });
});
