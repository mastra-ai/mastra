'use client';

import { useEffect, useRef, useState } from 'react';
import { Controller, UseFormReturn } from 'react-hook-form';
import { Play, SquareTerminal, FileText } from 'lucide-react';

import { CodeEditor } from '@/ds/components/CodeEditor';
import { Button } from '@/ds/components/Button';
import { PageHeader } from '@/ds/components/PageHeader';
import { Icon } from '@/ds/icons';
import { cn } from '@/lib/utils';
import { SectionHeader } from '@/domains/cms';

import type { AgentFormValues } from '../agent-edit/form-validation';
import { PartialsEditor, extractPartialNames } from './partials-editor';
import { TestInstructionDialog } from './test-instruction-dialog';

interface AgentEditMainProps {
  form: UseFormReturn<AgentFormValues>;
}

export function AgentEditMain({ form }: AgentEditMainProps) {
  const {
    control,
    formState: { errors },
    watch,
    setValue,
    getValues,
  } = form;

  // Watch instructions for partial detection
  const instructions = watch('instructions');
  const partials = watch('partials') || {};

  // State for test dialog
  const [testDialogOpen, setTestDialogOpen] = useState(false);

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
    <div className="flex flex-col gap-6 h-full pb-4">
      <PageHeader title="Prompt Editor" icon={<SquareTerminal />} className="px-4 pt-4 pb-0" />

      {/* Instructions - CodeEditor */}
      <div className="flex flex-col gap-3 flex-1 min-h-0 px-4">
        <div className="flex items-start justify-between">
          <SectionHeader
            title="Instructions"
            subtitle="Write your agent's system prompt using Handlebars syntax for dynamic content."
            icon={
              <Icon>
                <FileText className="text-accent5" />
              </Icon>
            }
          />
          <Button type="button" variant="light" size="sm" onClick={() => setTestDialogOpen(true)}>
            <Icon>
              <Play />
            </Icon>
            Test the prompt
          </Button>
        </div>
        <Controller
          name="instructions"
          control={control}
          render={({ field }) => (
            <CodeEditor
              value={field.value}
              onChange={field.onChange}
              language="markdown"
              showCopyButton={false}
              placeholder="Enter agent instructions..."
              className={cn('flex-1 min-h-[200px]', errors.instructions && 'border border-accent2')}
            />
          )}
        />
        {errors.instructions && <span className="text-xs text-accent2">{errors.instructions.message}</span>}
      </div>

      {/* Partials */}
      <Controller
        name="partials"
        control={control}
        render={({ field }) => (
          <PartialsEditor
            value={field.value || {}}
            onChange={field.onChange}
            detectedNames={detectedPartialNames}
          />
        )}
      />

      {/* Test Instructions Dialog */}
      <TestInstructionDialog
        open={testDialogOpen}
        onOpenChange={setTestDialogOpen}
        instructions={instructions || ''}
        partials={partials}
      />
    </div>
  );
}
