import { FieldBlock, TextareaFieldBlock, TextFieldBlock } from '@mastra/playground-ui/components/FormFieldBlocks';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { SectionRoot, SubSectionRoot } from '@mastra/playground-ui/components/Section';
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

        <TextFieldBlock
          label="Name"
          required
          placeholder="My Agent"
          {...register('name')}
          errorMsg={errors.name?.message}
          disabled={readOnly}
        />

        <TextareaFieldBlock
          label="Description"
          className="pb-8"
          placeholder="Describe what this agent does"
          {...register('description')}
          errorMsg={errors.description?.message}
          disabled={readOnly}
        />

        <div className="border-t border-border pt-8">
          <SubSectionRoot>
            <SubSectionHeader title="Model Configuration" />
            <div className="grid grid-cols-2 gap-4">
              <FieldBlock name="model-provider" label="Provider" required>
                {fieldControl => (
                  <Controller
                    name="model.provider"
                    control={control}
                    render={({ field }) => (
                      <div className={readOnly ? 'pointer-events-none opacity-60' : ''}>
                        <LLMProviders
                          id={fieldControl.id}
                          name="model-provider"
                          value={field.value}
                          onValueChange={field.onChange}
                          error={errors.model?.provider?.message}
                        />
                      </div>
                    )}
                  />
                )}
              </FieldBlock>

              <FieldBlock name="model-name" label="Model" required>
                {fieldControl => (
                  <Controller
                    name="model.name"
                    control={control}
                    render={({ field }) => (
                      <div className={readOnly ? 'pointer-events-none opacity-60' : ''}>
                        <LLMModels
                          id={fieldControl.id}
                          name="model-name"
                          value={field.value}
                          onValueChange={field.onChange}
                          llmId={form.watch('model.provider') || ''}
                          error={errors.model?.name?.message}
                        />
                      </div>
                    )}
                  />
                )}
              </FieldBlock>
            </div>
          </SubSectionRoot>
        </div>
      </SectionRoot>
    </ScrollArea>
  );
}
