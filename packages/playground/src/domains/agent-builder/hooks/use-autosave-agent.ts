import type { StoredAgentResponse, StoredSkillResponse } from '@mastra/client-js';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { useDebouncedCallback } from 'use-debounce';
import type { AgentBuilderEditFormValues } from '../schemas';
import type { AgentTool } from '../types/agent-tool';
import { useSaveAgent } from './use-save-agent';

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseAutosaveAgentArgs {
  storedAgent: StoredAgentResponse;
  availableAgentTools?: AgentTool[];
  availableSkills?: StoredSkillResponse[];
  debounceMs?: number;
  savedDisplayMs?: number;
}

const DEFAULT_DEBOUNCE_MS = 600;
const DEFAULT_SAVED_DISPLAY_MS = 2000;

export function useAutosaveAgent({
  storedAgent,
  availableAgentTools = [],
  availableSkills = [],
  debounceMs = DEFAULT_DEBOUNCE_MS,
  savedDisplayMs = DEFAULT_SAVED_DISPLAY_MS,
}: UseAutosaveAgentArgs) {
  const formMethods = useFormContext<AgentBuilderEditFormValues>();
  const { save } = useSaveAgent({ storedAgent, availableAgentTools, availableSkills, silent: true });

  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const [lastError, setLastError] = useState<Error | null>(null);

  const latestValuesRef = useRef<AgentBuilderEditFormValues>(formMethods.getValues());
  const requestSeqRef = useRef(0);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSavedTimer = useCallback(() => {
    if (savedTimerRef.current) {
      clearTimeout(savedTimerRef.current);
      savedTimerRef.current = null;
    }
  }, []);

  const performSave = useCallback(async () => {
    const seq = ++requestSeqRef.current;
    const values = latestValuesRef.current;
    clearSavedTimer();
    setStatus('saving');
    setLastError(null);
    try {
      await save(values);
      /* v8 ignore if */
      if (seq !== requestSeqRef.current) return;
      setStatus('saved');
      savedTimerRef.current = setTimeout(() => {
        savedTimerRef.current = null;
        setStatus('idle');
      }, savedDisplayMs);
    } catch (err) {
      /* v8 ignore if */
      if (seq !== requestSeqRef.current) return;
      setStatus('error');
      setLastError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [clearSavedTimer, save, savedDisplayMs]);

  const debouncedSave = useDebouncedCallback(() => {
    void performSave();
  }, debounceMs);

  useEffect(() => {
    const subscription = formMethods.watch(() => {
      latestValuesRef.current = formMethods.getValues();
      debouncedSave();
    });
    return () => {
      subscription.unsubscribe();
    };
  }, [formMethods, debouncedSave]);

  useEffect(() => {
    return () => {
      debouncedSave.flush();
      clearSavedTimer();
    };
  }, [clearSavedTimer, debouncedSave]);

  const retry = useCallback(() => {
    void performSave();
  }, [performSave]);

  const flushNow = useCallback(() => {
    debouncedSave.flush();
  }, [debouncedSave]);

  return { status, lastError, retry, flushNow };
}
