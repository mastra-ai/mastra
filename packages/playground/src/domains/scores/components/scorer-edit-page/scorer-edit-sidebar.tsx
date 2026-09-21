import { Button } from '@mastra/playground-ui/components/Button';
import { FieldBlock, TextareaFieldBlock, TextFieldBlock } from '@mastra/playground-ui/components/FormFieldBlocks';
import { Input } from '@mastra/playground-ui/components/Input';
import { Label } from '@mastra/playground-ui/components/Label';
import { RadioGroup, RadioGroupItem } from '@mastra/playground-ui/components/RadioGroup';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
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

          <TextFieldBlock
            label="Name"
            required
            placeholder="My Scorer"
            variant="outline"
            {...register('name')}
            errorMsg={errors.name?.message}
          />

          <TextareaFieldBlock
            label="Description"
            required
            placeholder="Describe what this scorer does"
            variant="outline"
            {...register('description')}
            errorMsg={errors.description?.message}
          />

          <FieldBlock.Layout>
            <FieldBlock.Column>
              <FieldBlock.Label name="model-provider" required>
                Provider
              </FieldBlock.Label>
              <Controller
                name="model.provider"
                control={control}
                render={({ field }) => (
                  <LLMProviders
                    id="input-model-provider"
                    name="model-provider"
                    value={field.value}
                    onValueChange={field.onChange}
                    container={formRef}
                    error={errors.model?.provider?.message}
                  />
                )}
              />
            </FieldBlock.Column>
          </FieldBlock.Layout>

          <FieldBlock.Layout>
            <FieldBlock.Column>
              <FieldBlock.Label name="model-name" required>
                Model
              </FieldBlock.Label>
              <Controller
                name="model.name"
                control={control}
                render={({ field }) => (
                  <LLMModels
                    id="input-model-name"
                    name="model-name"
                    value={field.value}
                    onValueChange={field.onChange}
                    llmId={watchedProvider || ''}
                    container={formRef}
                    error={errors.model?.name?.message}
                  />
                )}
              />
            </FieldBlock.Column>
          </FieldBlock.Layout>

          {/* Score Range */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-foreground">Score Range</Label>
            <div className="flex items-center gap-2">
              <Controller
                name="scoreRange.min"
                control={control}
                render={({ field }) => (
                  <Input
                    type="number"
                    placeholder="Min"
                    variant="outline"
                    value={field.value}
                    onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                  />
                )}
              />
              <span className="text-muted-foreground text-ui-sm">to</span>
              <Controller
                name="scoreRange.max"
                control={control}
                render={({ field }) => (
                  <Input
                    type="number"
                    placeholder="Max"
                    variant="outline"
                    value={field.value}
                    onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                  />
                )}
              />
            </div>
          </div>

          {/* Default Sampling */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-foreground">Default Sampling</Label>
            <Controller
              name="defaultSampling.type"
              control={control}
              render={({ field }) => (
                <RadioGroup value={field.value ?? 'none'} onValueChange={field.onChange}>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="none" id="sampling-none" />
                    <Label htmlFor="sampling-none" className="text-foreground">
                      None
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="ratio" id="sampling-ratio" />
                    <Label htmlFor="sampling-ratio" className="text-foreground">
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
                    variant="outline"
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
            <Button variant="outline" onClick={onSaveDraft} disabled={isSavingDraft || isSubmitting} className="flex-1">
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
