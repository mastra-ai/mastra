import { Controller } from 'react-hook-form';

import { ScrollArea } from '@/ds/components/ScrollArea';
import { Input } from '@/ds/components/Input';
import { Textarea } from '@/ds/components/Textarea';
import { Label } from '@/ds/components/Label';
import { SectionHeader } from '@/domains/cms';
import { AgentIcon } from '@/ds/icons';
import { LLMProviders, LLMModels } from '@/domains/llm';

import { useAgentEditFormContext } from '../../context/agent-edit-form-context';

export function InformationPage() {
  const { form, readOnly } = useAgentEditFormContext();
  const {
    register,
    control,
    formState: { errors },
  } = form;

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-8 p-4">
        {/* Identity Section */}
        <section className="flex flex-col gap-6">
          <SectionHeader
            title="Identity"
            subtitle="Define your agent's name, description, and model."
            icon={<AgentIcon />}
          />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="agent-name" className="text-xs text-icon5">
              Name <span className="text-accent2">*</span>
            </Label>
            <Input
              id="agent-name"
              placeholder="My Agent"
              className="bg-surface3"
              {...register('name')}
              error={!!errors.name}
              disabled={readOnly}
            />
            {errors.name && <span className="text-xs text-accent2">{errors.name.message}</span>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="agent-description" className="text-xs text-icon5">
              Description
            </Label>
            <Textarea
              id="agent-description"
              placeholder="Describe what this agent does"
              className="bg-surface3"
              {...register('description')}
              error={!!errors.description}
              disabled={readOnly}
            />
            {errors.description && <span className="text-xs text-accent2">{errors.description.message}</span>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-icon5">
              Provider <span className="text-accent2">*</span>
            </Label>
            <Controller
              name="model.provider"
              control={control}
              render={({ field }) => (
                <div className={readOnly ? 'pointer-events-none opacity-60' : ''}>
                  <LLMProviders value={field.value} onValueChange={field.onChange} variant="light" />
                </div>
              )}
            />
            {errors.model?.provider && <span className="text-xs text-accent2">{errors.model.provider.message}</span>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-icon5">
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
                    variant="light"
                  />
                </div>
              )}
            />
            {errors.model?.name && <span className="text-xs text-accent2">{errors.model.name.message}</span>}
          </div>
        </section>
      </div>
    </ScrollArea>
  );
}
