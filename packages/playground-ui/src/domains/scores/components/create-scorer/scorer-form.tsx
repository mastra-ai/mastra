'use client';

import * as React from 'react';
import { useForm, Controller, Resolver } from 'react-hook-form';
import { Trash2 } from 'lucide-react';

import { Button } from '@/ds/components/Button';
import { Badge } from '@/ds/components/Badge';
import { Input } from '@/ds/components/Input';
import { Label } from '@/ds/components/Label';
import { Spinner } from '@/ds/components/Spinner';
import { cn } from '@/lib/utils';

import { ModelPicker } from '@/domains/agents/components/create-agent/model-picker';
import { InstructionsEnhancer } from '@/domains/agents/components/create-agent/instructions-enhancer';
import type { ScorerFormValues } from './scorer-form-validation';
import { DEFAULT_PROMPT_TEMPLATE } from './scorer-form-validation';

/** Template variables available in scorer prompts */
const SCORER_VARIABLES = [
  { name: 'minScore', description: 'Minimum score value' },
  { name: 'maxScore', description: 'Maximum score value' },
  { name: 'input', description: 'Input to the evaluated agent/tool' },
  { name: 'output', description: 'Output from the evaluated agent/tool' },
];

// Simple validation resolver without zod to avoid version conflicts
const scorerFormResolver: Resolver<ScorerFormValues> = async values => {
  const errors: Record<string, { type: string; message: string }> = {};

  if (!values.name || values.name.trim() === '') {
    errors.name = { type: 'required', message: 'Name is required' };
  } else if (values.name.length > 100) {
    errors.name = { type: 'maxLength', message: 'Name must be 100 characters or less' };
  }

  if (values.description && values.description.length > 500) {
    errors.description = { type: 'maxLength', message: 'Description must be 500 characters or less' };
  }

  if (!values.model?.provider || values.model.provider.trim() === '') {
    errors['model.provider'] = { type: 'required', message: 'Provider is required' };
  }

  if (!values.model?.name || values.model.name.trim() === '') {
    errors['model.name'] = { type: 'required', message: 'Model is required' };
  }

  if (!values.prompt || values.prompt.trim() === '') {
    errors.prompt = { type: 'required', message: 'Prompt is required' };
  }

  if (values.scoreRange.min >= values.scoreRange.max) {
    errors['scoreRange.min'] = {
      type: 'validate',
      message: 'Minimum score must be less than maximum score',
    };
  }

  return {
    values: Object.keys(errors).length === 0 ? values : {},
    errors: Object.keys(errors).length > 0 ? errors : {},
  };
};

export interface ScorerFormProps {
  mode: 'create' | 'edit';
  scorerId?: string;
  initialValues?: Partial<ScorerFormValues>;
  onSubmit: (values: ScorerFormValues) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
  isSubmitting?: boolean;
  isDeleting?: boolean;
  versionInfo?: {
    versionNumber?: number;
    updatedAt?: Date;
  };
}

export function ScorerForm({
  mode,
  scorerId,
  initialValues,
  onSubmit,
  onCancel,
  onDelete,
  isSubmitting = false,
  isDeleting = false,
  versionInfo,
}: ScorerFormProps) {
  // Form setup
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    watch,
  } = useForm<ScorerFormValues>({
    resolver: scorerFormResolver,
    defaultValues: {
      name: initialValues?.name ?? '',
      description: initialValues?.description ?? '',
      model: initialValues?.model ?? { provider: '', name: '' },
      prompt: initialValues?.prompt ?? DEFAULT_PROMPT_TEMPLATE,
      scoreRange: initialValues?.scoreRange ?? { min: 0, max: 1 },
      metadata: initialValues?.metadata,
      ownerId: initialValues?.ownerId,
    },
  });

  // Watch the model field to pass to the enhancer
  const currentModel = watch('model');

  const handleFormSubmit = async (values: ScorerFormValues) => {
    await onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col gap-4">
      {/* Scorer ID badge and version info in edit mode */}
      {mode === 'edit' && scorerId && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-icon3">ID:</span>
            <Badge>{scorerId}</Badge>
          </div>
          {versionInfo && versionInfo.versionNumber && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-icon3">Version:</span>
              <Badge>v{versionInfo.versionNumber}</Badge>
            </div>
          )}
        </div>
      )}

      {/* Basic Fields */}
      <div className="flex flex-col gap-3">
        {/* Name and Description - Two Column Layout */}
        <div className="@container">
          <div className="flex flex-col @xs:flex-row gap-2">
            {/* Name */}
            <div className="flex flex-col gap-1.5 w-full @xs:w-2/5">
              <Label htmlFor="name" className="text-xs text-icon5">
                Name <span className="text-accent2">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Enter scorer name"
                {...register('name')}
                className={cn(errors.name && 'border-accent2')}
              />
              {errors.name && <span className="text-xs text-accent2">{errors.name.message}</span>}
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5 w-full @xs:w-3/5">
              <Label htmlFor="description" className="text-xs text-icon5">
                Description
              </Label>
              <Input
                id="description"
                placeholder="Description (optional)"
                {...register('description')}
                className={cn(errors.description && 'border-accent2')}
              />
              {errors.description && <span className="text-xs text-accent2">{errors.description.message}</span>}
            </div>
          </div>
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
              />
            )}
          />
        </div>

        {/* Score Range */}
        <div className="@container">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-icon5">Score Range</Label>
            <div className="flex flex-col @xs:flex-row gap-2">
              <div className="flex flex-col gap-1.5 w-full @xs:w-1/2">
                <Label htmlFor="scoreRange.min" className="text-xs text-icon4">
                  Minimum
                </Label>
                <Input
                  id="scoreRange.min"
                  type="number"
                  step="0.01"
                  placeholder="0"
                  {...register('scoreRange.min', { valueAsNumber: true })}
                  className={cn(errors.scoreRange?.min && 'border-accent2')}
                />
                {errors.scoreRange?.min && (
                  <span className="text-xs text-accent2">{errors.scoreRange.min.message}</span>
                )}
              </div>
              <div className="flex flex-col gap-1.5 w-full @xs:w-1/2">
                <Label htmlFor="scoreRange.max" className="text-xs text-icon4">
                  Maximum
                </Label>
                <Input
                  id="scoreRange.max"
                  type="number"
                  step="0.01"
                  placeholder="1"
                  {...register('scoreRange.max', { valueAsNumber: true })}
                  className={cn(errors.scoreRange?.max && 'border-accent2')}
                />
                {errors.scoreRange?.max && (
                  <span className="text-xs text-accent2">{errors.scoreRange.max.message}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Prompt */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prompt" className="text-xs text-icon5">
            Prompt <span className="text-accent2">*</span>
          </Label>
          <Controller
            name="prompt"
            control={control}
            render={({ field }) => (
              <InstructionsEnhancer
                value={field.value}
                onChange={field.onChange}
                placeholder="Enter evaluation prompt with template variables: {{minScore}}, {{maxScore}}, {{input}}, {{output}}"
                error={errors.prompt?.message}
                context="scorer"
                variables={SCORER_VARIABLES}
                rows={12}
                textareaClassName="font-mono text-xs"
                enhanceCommentPlaceholder="Describe how to improve the evaluation criteria..."
                defaultModel={currentModel}
              />
            )}
          />
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-border1">
        <div>
          {mode === 'edit' && onDelete && (
            <Button
              type="button"
              variant="ghost"
              onClick={onDelete}
              disabled={isDeleting || isSubmitting}
              className="text-accent2 hover:text-accent2 hover:bg-accent2/10"
            >
              {isDeleting ? (
                <>
                  <Spinner className="h-3 w-3 mr-2" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-3 w-3 mr-2" />
                  Delete
                </>
              )}
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting || isDeleting}>
            Cancel
          </Button>
          <Button type="submit" variant="light" disabled={isSubmitting || isDeleting}>
            {isSubmitting ? (
              <>
                <Spinner className="h-3 w-3 mr-2" />
                {mode === 'create' ? 'Creating...' : 'Updating...'}
              </>
            ) : mode === 'create' ? (
              'Create Scorer'
            ) : (
              'Update Scorer'
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
