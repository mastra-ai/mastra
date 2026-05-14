import type { StoredSkillResponse } from '@mastra/client-js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { useDebouncedCallback } from 'use-debounce';
import type { AgentBuilderEditFormValues } from '../schemas';
import type { AgentTool } from '../types/agent-tool';
import { useSaveAgent } from './use-save-agent';

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseAutosaveAgentArgs {
  agentId: string;
  availableAgentTools?: AgentTool[];
  availableSkills?: StoredSkillResponse[];
  debounceMs?: number;
  savedDisplayMs?: number;
}

const DEFAULT_DEBOUNCE_MS = 600;
const DEFAULT_SAVED_DISPLAY_MS = 2000;

export function useAutosaveAgent({
  agentId,
  availableAgentTools = [],
  availableSkills = [],
  debounceMs = DEFAULT_DEBOUNCE_MS,
  savedDisplayMs = DEFAULT_SAVED_DISPLAY_MS,
}: UseAutosaveAgentArgs) {
  const formMethods = useFormContext<AgentBuilderEditFormValues>();
  const { save } = useSaveAgent({ agentId, availableAgentTools, availableSkills, silent: true });

  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const [lastError, setLastError] = useState<Error | null>(null);

  const latestValuesRef = useRef<AgentBuilderEditFormValues>(formMethods.getValues());
  const requestSeqRef = useRef(0);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSavedTimer = () => {
    if (savedTimerRef.current) {
      clearTimeout(savedTimerRef.current);
      savedTimerRef.current = null;
    }
  };

  const performSave = useCallback(async () => {
    const seq = ++requestSeqRef.current;
    const values = latestValuesRef.current;
    clearSavedTimer();
    setStatus('saving');
    setLastError(null);
    try {
      await save(values);
      // Ignore stale completions when a newer save was started.
      if (seq !== requestSeqRef.current) return;
      setStatus('saved');
      savedTimerRef.current = setTimeout(() => {
        savedTimerRef.current = null;
        setStatus(prev => (prev === 'saved' ? 'idle' : prev));
      }, savedDisplayMs);
    } catch (err) {
      if (seq !== requestSeqRef.current) return;
      setStatus('error');
      setLastError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [save, savedDisplayMs]);

  const debouncedSave = useDebouncedCallback(() => {
    void performSave();
  }, debounceMs);

  // Subscribe to form changes. RHF's watch callback fires only on change, not on subscribe.
  useEffect(() => {
    const subscription = formMethods.watch(values => {
      latestValuesRef.current = values as AgentBuilderEditFormValues;
      debouncedSave();
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [formMethods, debouncedSave]);

  // Flush any pending save on unmount so a fast navigation doesn't lose edits.
  useEffect(() => {
    return () => {
      debouncedSave.flush();
      clearSavedTimer();
    };
  }, [debouncedSave]);

  const retry = useCallback(() => {
    void performSave();
  }, [performSave]);

  const flushNow = useCallback(() => {
    debouncedSave.flush();
  }, [debouncedSave]);

  return { status, lastError, retry, flushNow };
}
