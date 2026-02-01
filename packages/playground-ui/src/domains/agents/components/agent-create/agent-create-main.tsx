'use client';

import { type RefObject, useEffect, useRef, useState } from 'react';
import { Controller, UseFormReturn } from 'react-hook-form';
import { Play } from 'lucide-react';

import { Label } from '@/ds/components/Label';
import { CodeEditor } from '@/ds/components/CodeEditor';
import { IconButton } from '@/ds/components/IconButton';
import { Button } from '@/ds/components/Button';
import { Spinner } from '@/ds/components/Spinner';
import { cn } from '@/lib/utils';

import { CmsInput } from '@/domains/cms/components/cms-input';
import { ModelPicker } from '../create-agent/model-picker';
import type { AgentFormValues } from '../create-agent/form-validation';
import { PartialsEditor, extractPartialNames } from './partials-editor';
import { TestInstructionDialog } from './test-instruction-dialog';

interface AgentCreateMainProps {
  form: UseFormReturn<AgentFormValues>;
  formRef?: RefObject<HTMLFormElement | null>;
  onPublish: () => void;
  isSubmitting?: boolean;
}

export function AgentCreateMain({ form, formRef, onPublish, isSubmitting = false }: AgentCreateMainProps) {
  const {
    register,
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
    <div className="flex flex-col gap-4 h-full px-4 pb-4">
      {/* Header with Title */}
      <div className="flex flex-col gap-2 pt-4">
        {/* Agent Name - XL size */}
        <CmsInput
          label="Agent name"
          size="xl"
          placeholder="Untitled Agent"
          {...register('name')}
          error={!!errors.name}
        />
        {errors.name && <span className="text-xs text-accent2">{errors.name.message}</span>}

        {/* Description - LG size */}
        <CmsInput
          label="Agent description"
          size="lg"
          placeholder="Add a description..."
          {...register('description')}
          error={!!errors.description}
        />
        {errors.description && <span className="text-xs text-accent2">{errors.description.message}</span>}
      </div>

      {/* Model */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-icon5">
          Model <span className="text-accent2">*</span>
        </Label>
        <Controller
          name="model"
          control={control}
          render={({ field }) => (
            <ModelPicker
              value={field.value}
              onChange={field.onChange}
              error={errors.model?.provider?.message || errors.model?.name?.message}
              container={formRef}
            />
          )}
        />
      </div>

      {/* Instructions - CodeEditor taking remaining height only when no partials */}
      <div className={cn('flex flex-col gap-1.5', detectedPartialNames.length === 0 && 'flex-1 min-h-0')}>
        <div className="flex items-center justify-between">
          <Label htmlFor="instructions" className="text-xs text-icon5">
            Instructions <span className="text-accent2">*</span>
          </Label>
          <IconButton
            type="button"
            variant="ghost"
            size="sm"
            tooltip="Test instructions"
            onClick={() => setTestDialogOpen(true)}
          >
            <Play className="h-4 w-4" />
          </IconButton>
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

      {/* Partials - only show if there are detected partials */}
      {detectedPartialNames.length > 0 && (
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
      )}

      {/* Create Agent Button - at the bottom */}
      <div className="flex justify-end">
        <Button variant="primary" onClick={onPublish} disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Spinner className="h-4 w-4" />
              Creating...
            </>
          ) : (
            'Create agent'
          )}
        </Button>
      </div>

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
