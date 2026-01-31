'use client';

import { type RefObject, useEffect, useState } from 'react';
import { Controller, UseFormReturn } from 'react-hook-form';
import { Play } from 'lucide-react';

import { Input } from '@/ds/components/Input';
import { Label } from '@/ds/components/Label';
import { CodeEditor } from '@/ds/components/CodeEditor';
import { IconButton } from '@/ds/components/IconButton';
import { cn } from '@/lib/utils';

import { ModelPicker } from '../create-agent/model-picker';
import type { AgentFormValues } from '../create-agent/form-validation';
import { PartialsEditor, extractPartialNames } from './partials-editor';
import { TestInstructionDialog } from './test-instruction-dialog';

interface AgentCreateMainProps {
  form: UseFormReturn<AgentFormValues>;
  formRef?: RefObject<HTMLFormElement | null>;
}

export function AgentCreateMain({ form, formRef }: AgentCreateMainProps) {
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

  // Auto-add new partials when detected in instructions (but never remove existing ones)
  useEffect(() => {
    const detectedNames = extractPartialNames(instructions || '');
    const currentPartials = getValues('partials') || {};

    // Add newly detected partials while keeping all existing ones
    let hasNewPartials = false;
    const newPartials = { ...currentPartials };
    for (const name of detectedNames) {
      if (!(name in newPartials)) {
        newPartials[name] = '';
        hasNewPartials = true;
      }
    }

    // Only update if we found new partials
    if (hasNewPartials) {
      setValue('partials', newPartials);
    }
  }, [instructions, setValue, getValues]);

  // Get all partial names (from form state, which persists even when removed from instructions)
  const partialNames = Object.keys(partials);

  return (
    <div className="flex flex-col gap-4 h-full px-4">
      {/* Agent Name */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name" className="text-xs text-icon5">
          Name <span className="text-accent2">*</span>
        </Label>
        <Input
          id="name"
          placeholder="Enter agent name"
          {...register('name')}
          className={cn('bg-surface3', errors.name && 'border-accent2')}
        />
        {errors.name && <span className="text-xs text-accent2">{errors.name.message}</span>}
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description" className="text-xs text-icon5">
          Description
        </Label>
        <Input
          id="description"
          placeholder="Description (optional)"
          {...register('description')}
          className={cn('bg-surface3', errors.description && 'border-accent2')}
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

      {/* Instructions - CodeEditor taking remaining height */}
      <div className="flex flex-col gap-1.5 flex-1 min-h-0">
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
      {partialNames.length > 0 && (
        <Controller
          name="partials"
          control={control}
          render={({ field }) => (
            <PartialsEditor
              value={field.value || {}}
              onChange={field.onChange}
              partialNames={partialNames}
            />
          )}
        />
      )}

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
