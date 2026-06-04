// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it } from 'vitest';

import { PortalContainerProvider, usePortalContainer } from './portal-container';

/**
 * These guard the contract that prevented the model-picker regression:
 * `usePortalContainer` must resolve "no container" to `undefined`, never `null`.
 *
 * Base UI's `FloatingPortal` reads `container={undefined}` as "portal to
 * document.body" but `container={null}` as "not ready — render nothing". If the
 * resolver ever returns `null` again, dropdowns/combobox popups open in state but
 * mount to no DOM node, and these tests fail.
 */
describe('usePortalContainer', () => {
  it('returns undefined (NOT null) when there is no provider', () => {
    const { result } = renderHook(() => usePortalContainer());
    expect(result.current).toBeUndefined();
    expect(result.current).not.toBeNull();
  });

  it('normalizes a null provider value to undefined', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PortalContainerProvider container={null}>{children}</PortalContainerProvider>
    );
    const { result } = renderHook(() => usePortalContainer(), { wrapper });
    expect(result.current).toBeUndefined();
  });

  it('returns the provider container when one is set', () => {
    const node = document.createElement('div');
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PortalContainerProvider container={node}>{children}</PortalContainerProvider>
    );
    const { result } = renderHook(() => usePortalContainer(), { wrapper });
    expect(result.current).toBe(node);
  });

  it('lets an explicit container win over the provider', () => {
    const provided = document.createElement('div');
    const explicit = document.createElement('section');
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PortalContainerProvider container={provided}>{children}</PortalContainerProvider>
    );
    const { result } = renderHook(() => usePortalContainer(explicit), { wrapper });
    expect(result.current).toBe(explicit);
  });

  it('coerces an explicit null container to undefined (falls back to provider)', () => {
    const provided = document.createElement('div');
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PortalContainerProvider container={provided}>{children}</PortalContainerProvider>
    );
    const { result } = renderHook(() => usePortalContainer(null), { wrapper });
    expect(result.current).toBe(provided);
  });
});
