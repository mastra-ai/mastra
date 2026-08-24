import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { defaultSettings, useAgentSettingsState } from '../use-agent-settings-state';
import type { AgentSettingsType as AgentSettings } from '@/types';

const storageKey = (agentId: string) => `mastra-agent-store-${agentId}`;

/**
 * The hook re-reads storage whenever `defaultSettings` changes identity, so both
 * real callers memoize it (see `agent-playground-test-chat` and `agent/session`).
 * These fixtures are hoisted for the same reason — a fresh object per render
 * would re-run the effect forever.
 */
const agentDefaults: AgentSettings = { modelSettings: { maxSteps: 42 } };

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

describe('useAgentSettingsState', () => {
  describe('when nothing has been stored yet', () => {
    it('falls back to the shipped defaults', () => {
      const { result } = renderHook(() => useAgentSettingsState({ agentId: 'agent-1' }));

      expect(result.current.settings?.modelSettings).toEqual(defaultSettings.modelSettings);
    });
  });

  describe('when the agent ships its own defaults', () => {
    it('lets the agent defaults win over the shipped ones', () => {
      const { result } = renderHook(() =>
        useAgentSettingsState({ agentId: 'agent-1', defaultSettings: agentDefaults }),
      );

      expect(result.current.settings?.modelSettings?.maxSteps).toBe(42);
      expect(result.current.settings?.modelSettings?.maxRetries).toBe(defaultSettings.modelSettings?.maxRetries);
    });

    it('lets the agent defaults win over what the user stored', () => {
      localStorage.setItem(storageKey('agent-1'), JSON.stringify({ modelSettings: { maxSteps: 7, maxRetries: 9 } }));

      const { result } = renderHook(() =>
        useAgentSettingsState({ agentId: 'agent-1', defaultSettings: agentDefaults }),
      );

      expect(result.current.settings?.modelSettings?.maxSteps).toBe(42);
      // Untouched by the agent defaults, so the stored value survives.
      expect(result.current.settings?.modelSettings?.maxRetries).toBe(9);
    });
  });

  describe('when the user has stored settings', () => {
    it('restores them over the shipped defaults', () => {
      localStorage.setItem(storageKey('agent-1'), JSON.stringify({ modelSettings: { maxSteps: 7 } }));

      const { result } = renderHook(() => useAgentSettingsState({ agentId: 'agent-1' }));

      expect(result.current.settings?.modelSettings?.maxSteps).toBe(7);
      expect(result.current.settings?.modelSettings?.maxRetries).toBe(defaultSettings.modelSettings?.maxRetries);
    });

    it('keeps stored keys that live outside modelSettings', () => {
      localStorage.setItem(storageKey('agent-1'), JSON.stringify({ agentId: 'agent-1', someFlag: true }));

      const { result } = renderHook(() => useAgentSettingsState({ agentId: 'agent-1' }));

      expect(result.current.settings).toMatchObject({ agentId: 'agent-1', someFlag: true });
    });

    it('reads the entry for its own agent only', () => {
      localStorage.setItem(storageKey('agent-2'), JSON.stringify({ modelSettings: { maxSteps: 99 } }));

      const { result } = renderHook(() => useAgentSettingsState({ agentId: 'agent-1' }));

      expect(result.current.settings?.modelSettings?.maxSteps).toBe(defaultSettings.modelSettings?.maxSteps);
    });
  });

  describe('when the stored entry is corrupt', () => {
    it('leaves the caller with the props it was given rather than crashing', () => {
      localStorage.setItem(storageKey('agent-1'), 'not json');

      const { result } = renderHook(() =>
        useAgentSettingsState({ agentId: 'agent-1', defaultSettings: agentDefaults }),
      );

      expect(result.current.settings?.modelSettings?.maxSteps).toBe(42);
    });
  });

  describe('when the user changes a setting', () => {
    it('merges it into the current settings', () => {
      const { result } = renderHook(() => useAgentSettingsState({ agentId: 'agent-1' }));

      act(() => result.current.setSettings({ modelSettings: { maxSteps: 3 } }));

      expect(result.current.settings?.modelSettings?.maxSteps).toBe(3);
    });

    it('persists it under this agent, tagged with the agent id', () => {
      const { result } = renderHook(() => useAgentSettingsState({ agentId: 'agent-1' }));

      act(() => result.current.setSettings({ modelSettings: { maxSteps: 3 } }));

      expect(JSON.parse(localStorage.getItem(storageKey('agent-1'))!)).toEqual({
        modelSettings: { maxSteps: 3 },
        agentId: 'agent-1',
      });
    });
  });

  describe('when the user resets', () => {
    it('restores the shipped defaults', () => {
      const { result } = renderHook(() => useAgentSettingsState({ agentId: 'agent-1' }));
      act(() => result.current.setSettings({ modelSettings: { maxSteps: 3 } }));

      act(() => result.current.resetAll());

      expect(result.current.settings?.modelSettings).toEqual(defaultSettings.modelSettings);
    });

    it('restores the agent defaults on top of the shipped ones', () => {
      const { result } = renderHook(() =>
        useAgentSettingsState({ agentId: 'agent-1', defaultSettings: agentDefaults }),
      );
      act(() => result.current.setSettings({ modelSettings: { maxSteps: 3 } }));

      act(() => result.current.resetAll());

      expect(result.current.settings?.modelSettings?.maxSteps).toBe(42);
      expect(result.current.settings?.modelSettings?.maxRetries).toBe(defaultSettings.modelSettings?.maxRetries);
    });

    it('clears the stored entry so code defaults win on the next load', () => {
      const { result } = renderHook(() => useAgentSettingsState({ agentId: 'agent-1' }));
      act(() => result.current.setSettings({ modelSettings: { maxSteps: 3 } }));

      act(() => result.current.resetAll());

      expect(localStorage.getItem(storageKey('agent-1'))).toBeNull();
    });

    it('leaves another agent stored settings alone', () => {
      localStorage.setItem(storageKey('agent-2'), JSON.stringify({ modelSettings: { maxSteps: 99 } }));
      const { result } = renderHook(() => useAgentSettingsState({ agentId: 'agent-1' }));

      act(() => result.current.resetAll());

      expect(localStorage.getItem(storageKey('agent-2'))).not.toBeNull();
    });
  });

  describe('the shipped defaults themselves', () => {
    it('leaves every chat-transport flag off, so nothing opts in by accident', () => {
      const { result } = renderHook(() => useAgentSettingsState({ agentId: 'agent-1' }));

      expect(result.current.settings?.modelSettings).toMatchObject({
        maxRetries: 2,
        maxSteps: 15,
        chatWithGenerateLegacy: false,
        chatWithGenerate: false,
        chatWithLegacyStream: false,
      });
    });
  });

  describe('when the stored entry is the literal null', () => {
    it('falls back to the shipped defaults rather than crashing', () => {
      // `JSON.parse('null')` is null, not an object — the read has to survive it.
      localStorage.setItem(storageKey('agent-1'), 'null');

      const { result } = renderHook(() => useAgentSettingsState({ agentId: 'agent-1' }));

      expect(result.current.settings?.modelSettings).toEqual(defaultSettings.modelSettings);
    });
  });

  describe('when the caller switches to another agent', () => {
    it('re-reads storage under the new agent key', () => {
      localStorage.setItem(storageKey('agent-1'), JSON.stringify({ modelSettings: { maxSteps: 7 } }));
      localStorage.setItem(storageKey('agent-2'), JSON.stringify({ modelSettings: { maxSteps: 99 } }));

      const { result, rerender } = renderHook(
        ({ agentId }: { agentId: string }) => useAgentSettingsState({ agentId }),
        {
          initialProps: { agentId: 'agent-1' },
        },
      );
      expect(result.current.settings?.modelSettings?.maxSteps).toBe(7);

      rerender({ agentId: 'agent-2' });

      expect(result.current.settings?.modelSettings?.maxSteps).toBe(99);
    });
  });
});
