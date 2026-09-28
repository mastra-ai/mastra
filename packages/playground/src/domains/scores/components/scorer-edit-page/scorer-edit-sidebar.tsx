import { Button } from '@mastra/playground-ui/components/Button';
import {
  Field,
  FieldError,
  FieldItem,
  FieldLabel,
  Fieldset,
  FieldsetLegend,
} from '@mastra/playground-ui/components/Field';
import { Input } from '@mastra/playground-ui/components/Input';
import { RadioGroup, RadioGroupItem } from '@mastra/playground-ui/components/RadioGroup';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Textarea } from '@mastra/playground-ui/components/Textarea';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { Check, Save } from 'lucide-react';
import type { RefObject } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import type { UseFormReturn } from 'react-hook-form';

import type { ScorerFormValues } from './utils/form-validation';
import { SectionHeader } from '@/domains/cms';
import { LLMProviders, LLMModels } from '@/domains/llm';

interface ScorerEditSidebarProps {
  form: UseFormReturn<ScorerFormValues>;
  onPublish: () => void;
  onSaveDraft?: () => void;
  isSubmitting?: boolean;
  isSavingDraft?: boolean;
  formRef?: RefObject<HTMLFormElement | null>;
  mode?: 'create' | 'edit';
}

export function ScorerEditSidebar({
  form,
  onPublish,
  onSaveDraft,
  isSubmitting = false,
  isSavingDraft = false,
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
    <div className="flex h-full flex-col">
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-4 p-4">
          <SectionHeader title="Configuration" subtitle="Define your scorer's name, type, and settings." />

          <Field invalid={Boolean(errors.name)}>
            <FieldLabel required>Name</FieldLabel>
            <Input placeholder="My Scorer" {...register('name')} />
            <FieldError>{errors.name?.message}</FieldError>
          </Field>

          <Field invalid={Boolean(errors.description)}>
            <FieldLabel required>Description</FieldLabel>
            <Textarea placeholder="Describe what this scorer does" {...register('description')} />
            <FieldError>{errors.description?.message}</FieldError>
          </Field>

          <Field invalid={Boolean(errors.model?.provider)}>
            <FieldLabel required>Provider</FieldLabel>
            <Controller
              name="model.provider"
              control={control}
              render={({ field }) => (
                <LLMProviders value={field.value} onValueChange={field.onChange} container={formRef} />
              )}
            />
            <FieldError>{errors.model?.provider?.message}</FieldError>
          </Field>

          <Field invalid={Boolean(errors.model?.name)}>
            <FieldLabel required>Model</FieldLabel>
            <Controller
              name="model.name"
              control={control}
              render={({ field }) => (
                <LLMModels
                  value={field.value}
                  onValueChange={field.onChange}
                  llmId={watchedProvider || ''}
                  container={formRef}
                />
              )}
            />
            <FieldError>{errors.model?.name?.message}</FieldError>
          </Field>

          {/* Score Range */}
          <Fieldset className="flex flex-col gap-1.5">
            <FieldsetLegend className="text-foreground">Score Range</FieldsetLegend>
            <div className="flex items-center gap-2">
              <Controller
                name="scoreRange.min"
                control={control}
                render={({ field }) => (
                  <Input
                    type="number"
                    placeholder="Min"
                    value={field.value}
                    onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                  />
                )}
              />
              <span className="text-caption text-muted-foreground">to</span>
              <Controller
                name="scoreRange.max"
                control={control}
                render={({ field }) => (
                  <Input
                    type="number"
                    placeholder="Max"
                    value={field.value}
                    onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                  />
                )}
              />
            </div>
          </Fieldset>

          {/* Default Sampling */}
          <div className="flex flex-col gap-1.5">
            <Controller
              name="defaultSampling.type"
              control={control}
              render={({ field }) => (
                <Field>
                  <Fieldset
                    className="flex flex-col gap-1.5"
                    render={<RadioGroup value={field.value ?? 'none'} onValueChange={field.onChange} />}
                  >
                    <FieldsetLegend className="text-foreground">Default Sampling</FieldsetLegend>
                    <FieldItem>
                      <RadioGroupItem value="none" />
                      <FieldLabel className="text-foreground">None</FieldLabel>
                    </FieldItem>
                    <FieldItem>
                      <RadioGroupItem value="ratio" />
                      <FieldLabel className="text-foreground">Ratio</FieldLabel>
                    </FieldItem>
                  </Fieldset>
                </Field>
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
      <div className="shrink-0 p-4">
        {mode === 'edit' && onSaveDraft ? (
          <div className="flex gap-2">
            <Button onClick={onSaveDraft} disabled={isSavingDraft || isSubmitting} className="flex-1">
              {isSavingDraft ? (
                <>
                  <Spinner className="h-4 w-4" />
                  Saving...
                </>
              ) : (
                <>
                  <Icon>
                    <Save />
                  </Icon>
                  Save
                </>
              )}
            </Button>
            <Button variant="primary" onClick={onPublish} disabled={isSubmitting || isSavingDraft} className="flex-1">
              {isSubmitting ? (
                <>
                  <Spinner className="h-4 w-4" />
                  Publishing...
                </>
              ) : (
                <>
                  <Icon>
                    <Check />
                  </Icon>
                  Publish
                </>
              )}
            </Button>
          </div>
        ) : (
          <Button variant="primary" onClick={onPublish} disabled={isSubmitting} className="w-full">
            {isSubmitting ? (
              <>
                <Spinner className="h-4 w-4" />
                Creating...
              </>
            ) : (
              <>
                <Icon>
                  <Check />
                </Icon>
                Create scorer
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
