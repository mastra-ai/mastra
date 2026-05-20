import { useCallback, useEffect, useRef, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { useDebouncedCallback } from 'use-debounce';

import {
  createInitialStructure,
  updateNodeContent,
  updateRootFolderName,
} from '@/domains/agents/components/agent-cms-pages/skill-file-tree';
import { useUpdateSkill } from '@/domains/agents/hooks/use-update-skill';

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface SkillEditFormValues {
  name: string;
  description: string;
  instructions: string;
  visibility: 'private' | 'public';
  workspaceId?: string;
}

interface UseAutosaveSkillArgs {
  skillId: string;
  debounceMs?: number;
  savedDisplayMs?: number;
}

const DEFAULT_DEBOUNCE_MS = 600;
const DEFAULT_SAVED_DISPLAY_MS = 2000;

export function useAutosaveSkill({
  skillId,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  savedDisplayMs = DEFAULT_SAVED_DISPLAY_MS,
}: UseAutosaveSkillArgs) {
  const formMethods = useFormContext<SkillEditFormValues>();
  const updateSkill = useUpdateSkill({ silent: true });

  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const [lastError, setLastError] = useState<Error | null>(null);

  const latestValuesRef = useRef<SkillEditFormValues>(formMethods.getValues());
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
      // Regenerate SKILL.md file tree from name + instructions so the stored
      // record stays internally consistent. Mirrors how skill-edit-dialog does it.
      const baseStructure = createInitialStructure(values.name || 'untitled');
      const namedStructure = values.name ? updateRootFolderName(baseStructure, values.name) : baseStructure;
      const files = updateNodeContent(namedStructure, 'skill-md', values.instructions ?? '');

      await updateSkill.mutateAsync({
        id: skillId,
        name: values.name,
        description: values.description,
        instructions: values.instructions,
        visibility: values.visibility,
        workspaceId: values.workspaceId,
        files,
      });
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
  }, [skillId, updateSkill, savedDisplayMs]);

  const debouncedSave = useDebouncedCallback(() => {
    void performSave();
  }, debounceMs);

  useEffect(() => {
    const subscription = formMethods.watch(values => {
      latestValuesRef.current = values as SkillEditFormValues;
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
  }, [debouncedSave]);

  const retry = useCallback(() => {
    void performSave();
  }, [performSave]);

  const flushNow = useCallback(() => {
    debouncedSave.flush();
  }, [debouncedSave]);

  return { status, lastError, retry, flushNow };
}
