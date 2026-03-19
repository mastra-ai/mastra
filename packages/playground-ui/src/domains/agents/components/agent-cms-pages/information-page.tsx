import { Controller } from 'react-hook-form';

import { ScrollArea } from '@/ds/components/ScrollArea';
import { Input } from '@/ds/components/Input';
import { Textarea } from '@/ds/components/Textarea';
import { Label } from '@/ds/components/Label';
import { SectionHeader } from '@/domains/cms';
import { LLMProviders, LLMModels } from '@/domains/llm';

import { useAgentEditFormContext } from '../../context/agent-edit-form-context';
import { SectionRoot, SubSectionRoot } from '@/ds/components/Section/section-root';
import { SubSectionHeader } from '@/domains/cms/components/section/section-header';

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

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="agent-name" className="text-xs text-neutral5">
            Name <span className="text-accent2">*</span>
          </Label>
          <Input
            id="agent-name"
            placeholder="My Agent"
            className="bg-surface2"
            {...register('name')}
            error={!!errors.name}
            disabled={readOnly}
          />
          {errors.name && <span className="text-xs text-accent2">{errors.name.message}</span>}
        </div>

        <div className="flex flex-col gap-1.5 pb-8">
          <Label htmlFor="agent-description" className="text-xs text-neutral5">
            Description
          </Label>
          <Textarea
            id="agent-description"
            placeholder="Describe what this agent does"
            className="bg-surface2"
            {...register('description')}
            error={!!errors.description}
            disabled={readOnly}
          />
          {errors.description && <span className="text-xs text-accent2">{errors.description.message}</span>}
        </div>

        <div className="border-t border-border1 pt-8">
          <SubSectionRoot>
            <SubSectionHeader title="Model Configuration" />
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-neutral5">
                  Provider <span className="text-accent2">*</span>
                </Label>
                <Controller
                  name="model.provider"
                  control={control}
                  render={({ field }) => (
                    <div className={readOnly ? 'pointer-events-none opacity-60' : ''}>
                      <LLMProviders value={field.value} onValueChange={field.onChange} />
                    </div>
                  )}
                />
                {errors.model?.provider && (
                  <span className="text-xs text-accent2">{errors.model.provider.message}</span>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-neutral5">
                  Model <span className="text-accent2">*</span>
                </Label>
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
                {errors.model?.name && <span className="text-xs text-accent2">{errors.model.name.message}</span>}
              </div>
            </div>
          </SubSectionRoot>
        </div>
      </SectionRoot>
    </ScrollArea>
  );
}
