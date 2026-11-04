import { Field, FieldError, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Input } from '@mastra/playground-ui/components/Input';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { SectionRoot, SubSectionRoot } from '@mastra/playground-ui/components/Section';
import { Textarea } from '@mastra/playground-ui/components/Textarea';
import { Controller } from 'react-hook-form';

import { useAgentEditFormContext } from '../../context/agent-edit-form-context';
import { SectionHeader } from '@/domains/cms';
import { SubSectionHeader } from '@/domains/cms/components/section/section-header';
import { LLMProviders, LLMModels } from '@/domains/llm';

export function InformationPage() {
  const { form, readOnly } = useAgentEditFormContext();
  const {
    register,
    control,
    formState: { errors },
  } = form;

  return (
    <ScrollArea className="h-full">
      <SectionRoot>
        <SectionHeader title="Identity" subtitle="Define your agent's name, description, and model." />

        <Field invalid={Boolean(errors.name)} disabled={readOnly}>
          <FieldLabel required>Name</FieldLabel>
          <Input placeholder="My Agent" required {...register('name')} />
          <FieldError>{errors.name?.message}</FieldError>
        </Field>

        <Field invalid={Boolean(errors.description)} disabled={readOnly} className="pb-8">
          <FieldLabel>Description</FieldLabel>
          <Textarea placeholder="Describe what this agent does" {...register('description')} />
          <FieldError>{errors.description?.message}</FieldError>
        </Field>

        <div className="border-t border-border pt-8">
          <SubSectionRoot>
            <SubSectionHeader title="Model Configuration" />
            <div className="grid grid-cols-2 gap-4">
              <Field invalid={Boolean(errors.model?.provider?.message)}>
                <FieldLabel required>Provider</FieldLabel>
                <Controller
                  name="model.provider"
                  control={control}
                  render={({ field }) => (
                    <div className={readOnly ? 'pointer-events-none opacity-60' : ''}>
                      <LLMProviders value={field.value} onValueChange={field.onChange} />
                    </div>
                  )}
                />
                <FieldError>{errors.model?.provider?.message}</FieldError>
              </Field>

              <Field invalid={Boolean(errors.model?.name?.message)}>
                <FieldLabel required>Model</FieldLabel>
                <Controller
                  name="model.name"
                  control={control}
                  render={({ field }) => (
                    <div className={readOnly ? 'pointer-events-none opacity-60' : ''}>
                      <LLMModels
                        value={field.value}
                        onValueChange={field.onChange}
                        llmId={form.watch('model.provider') || ''}
                      />
                    </div>
                  )}
                />
                <FieldError>{errors.model?.name?.message}</FieldError>
              </Field>
            </div>
          </SubSectionRoot>
        </div>
      </SectionRoot>
    </ScrollArea>
  );
}
