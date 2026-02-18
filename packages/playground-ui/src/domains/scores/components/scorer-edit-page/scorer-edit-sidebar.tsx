import type { RefObject } from 'react';
import { Controller, type UseFormReturn, useWatch } from 'react-hook-form';
import { Check } from 'lucide-react';

import { ScrollArea } from '@/ds/components/ScrollArea';
import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons';
import { Spinner } from '@/ds/components/Spinner';
import { Input } from '@/ds/components/Input';
import { Textarea } from '@/ds/components/Textarea';
import { Label } from '@/ds/components/Label';
import { RadioGroup, RadioGroupItem } from '@/ds/components/RadioGroup';
import { SectionHeader } from '@/domains/cms';
import { LLMProviders, LLMModels } from '@/domains/llm';

import type { ScorerFormValues } from './utils/form-validation';

interface ScorerEditSidebarProps {
  form: UseFormReturn<ScorerFormValues>;
  onPublish: () => void;
  isSubmitting?: boolean;
  formRef?: RefObject<HTMLFormElement | null>;
  mode?: 'create' | 'edit';
}

export function ScorerEditSidebar({
  form,
  onPublish,
  isSubmitting = false,
  formRef,
  mode = 'create',
}: ScorerEditSidebarProps) {
  const {
    register,
    control,
    formState: { errors },
  } = form;

  const watchedSamplingType = useWatch({ control, name: 'defaultSampling.type' });
  const watchedProvider = useWatch({ control, name: 'model.provider' });

  return (
    <div className="h-full flex flex-col">
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-6 p-4">
          <SectionHeader title="Configuration" subtitle="Define your scorer's name, type, and settings." />

          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="scorer-name" className="text-xs text-neutral5">
              Name <span className="text-accent2">*</span>
            </Label>
            <Input
              id="scorer-name"
              placeholder="My Scorer"
              className="bg-surface3"
              {...register('name')}
              error={!!errors.name}
            />
            {errors.name && <span className="text-xs text-accent2">{errors.name.message}</span>}
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="scorer-description" className="text-xs text-neutral5">
              Description <span className="text-accent2">*</span>
            </Label>
            <Textarea
              id="scorer-description"
              placeholder="Describe what this scorer does"
              className="bg-surface3"
              {...register('description')}
              error={!!errors.description}
            />
            {errors.description && <span className="text-xs text-accent2">{errors.description.message}</span>}
          </div>

          {/* Provider */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-neutral5">
              Provider <span className="text-accent2">*</span>
            </Label>
            <Controller
              name="model.provider"
              control={control}
              render={({ field }) => (
                <LLMProviders value={field.value} onValueChange={field.onChange} variant="light" container={formRef} />
              )}
            />
            {errors.model?.provider && <span className="text-xs text-accent2">{errors.model.provider.message}</span>}
          </div>

          {/* Model */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-neutral5">
              Model <span className="text-accent2">*</span>
            </Label>
            <Controller
              name="model.name"
              control={control}
              render={({ field }) => (
                <LLMModels
                  value={field.value}
                  onValueChange={field.onChange}
                  llmId={watchedProvider || ''}
                  variant="light"
                  container={formRef}
                />
              )}
            />
            {errors.model?.name && <span className="text-xs text-accent2">{errors.model.name.message}</span>}
          </div>

          {/* Score Range */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-neutral5">Score Range</Label>
            <div className="flex gap-2 items-center">
              <Controller
                name="scoreRange.min"
                control={control}
                render={({ field }) => (
                  <Input
                    type="number"
                    placeholder="Min"
                    className="bg-surface3"
                    value={field.value}
                    onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                  />
                )}
              />
              <span className="text-xs text-neutral3">to</span>
              <Controller
                name="scoreRange.max"
                control={control}
                render={({ field }) => (
                  <Input
                    type="number"
                    placeholder="Max"
                    className="bg-surface3"
                    value={field.value}
                    onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                  />
                )}
              />
            </div>
          </div>

          {/* Default Sampling */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-neutral5">Default Sampling</Label>
            <Controller
              name="defaultSampling.type"
              control={control}
              render={({ field }) => (
                <RadioGroup value={field.value ?? 'none'} onValueChange={field.onChange}>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="none" id="sampling-none" />
                    <Label htmlFor="sampling-none" className="text-xs text-neutral5">
                      None
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="ratio" id="sampling-ratio" />
                    <Label htmlFor="sampling-ratio" className="text-xs text-neutral5">
                      Ratio
                    </Label>
                  </div>
                </RadioGroup>
              )}
            />
            {watchedSamplingType === 'ratio' && (
              <Controller
                name="defaultSampling.rate"
                control={control}
                render={({ field }) => (
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    placeholder="Rate (0-1)"
                    className="bg-surface3"
                    value={field.value ?? ''}
                    onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                  />
                )}
              />
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Sticky footer */}
      <div className="flex-shrink-0 p-4">
        <Button variant="primary" onClick={onPublish} disabled={isSubmitting} className="w-full">
          {isSubmitting ? (
            <>
              <Spinner className="h-4 w-4" />
              {mode === 'edit' ? 'Updating...' : 'Creating...'}
            </>
          ) : (
            <>
              <Icon>
                <Check />
              </Icon>
              {mode === 'edit' ? 'Update scorer' : 'Create scorer'}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
