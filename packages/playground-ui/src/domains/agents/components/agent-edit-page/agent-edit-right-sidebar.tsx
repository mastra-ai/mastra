'use client';

import { useEffect, useRef } from 'react';
import { Controller, UseFormReturn } from 'react-hook-form';

import { ScrollArea } from '@/ds/components/ScrollArea';

import type { AgentFormValues } from '../agent-edit/form-validation';
import { PartialsEditor } from './partials-editor';
import { extractPartialNames } from './template-utils';
import { VariablesDisplay } from './variables-display';

interface AgentEditRightSidebarProps {
  form: UseFormReturn<AgentFormValues>;
}

export function AgentEditRightSidebar({ form }: AgentEditRightSidebarProps) {
  const { control, watch, setValue, getValues } = form;

  // Watch instructions for partial detection
  const instructions = watch('instructions');
  const partials = watch('partials') || {};

  // Track previous keys to avoid unnecessary updates
  const prevKeysRef = useRef<string>('');

  // Auto-sync partials when instructions change
  useEffect(() => {
    const detectedNames = extractPartialNames(instructions || '');

    // If parsing failed (null), preserve existing partials
    if (detectedNames === null) return;

    const currentPartials = getValues('partials') || {};

    // Build new partials object
    const newPartials: Record<string, string> = {};
    for (const name of detectedNames) {
      // Preserve existing content, or empty string for new partials
      newPartials[name] = currentPartials[name] ?? '';
    }

    // Only update if keys changed (avoid infinite loops)
    const newKeys = Object.keys(newPartials).sort().join(',');
    if (prevKeysRef.current !== newKeys) {
      prevKeysRef.current = newKeys;
      setValue('partials', newPartials);
    }
  }, [instructions, setValue, getValues]);

  // Get detected partial names for display (use current partials keys if parsing fails)
  const detectedPartialNames = extractPartialNames(instructions || '') ?? Object.keys(partials);

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-6 pt-4">
        {/* Partials Editor */}
        <Controller
          name="partials"
          control={control}
          render={({ field }) => (
            <PartialsEditor value={field.value || {}} onChange={field.onChange} detectedNames={detectedPartialNames} />
          )}
        />

        {/* Variables Display (read-only) */}
        <VariablesDisplay instructions={instructions || ''} />
      </div>
    </ScrollArea>
  );
}
