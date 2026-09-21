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
          variant="outline"
          {...register('name')}
          errorMsg={errors.name?.message}
          disabled={readOnly}
        />

        <TextareaFieldBlock
          label="Description"
          className="pb-8"
          placeholder="Describe what this agent does"
          variant="outline"
          {...register('description')}
          errorMsg={errors.description?.message}
          disabled={readOnly}
        />

        <div className="border-border border-t pt-8">
          <SubSectionRoot>
            <SubSectionHeader title="Model Configuration" />
            <div className="grid grid-cols-2 gap-4">
              <FieldBlock.Layout>
                <FieldBlock.Column>
                  <FieldBlock.Label name="model-provider" required>
                    Provider
                  </FieldBlock.Label>
                  <Controller
                    name="model.provider"
                    control={control}
                    render={({ field }) => (
                      <div className={readOnly ? 'pointer-events-none opacity-60' : ''}>
                        <LLMProviders
                          id="input-model-provider"
                          name="model-provider"
                          value={field.value}
                          onValueChange={field.onChange}
                          error={errors.model?.provider?.message}
                        />
                      </div>
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
                      <div className={readOnly ? 'pointer-events-none opacity-60' : ''}>
                        <LLMModels
                          id="input-model-name"
                          name="model-name"
                          value={field.value}
                          onValueChange={field.onChange}
                          llmId={form.watch('model.provider') || ''}
                          error={errors.model?.name?.message}
                        />
                      </div>
                    )}
                  />
                </FieldBlock.Column>
              </FieldBlock.Layout>
            </div>
          </SubSectionRoot>
        </div>
      </SectionRoot>
    </ScrollArea>
  );
}
