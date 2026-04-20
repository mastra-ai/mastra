import { Input, Label, ScrollArea, SectionRoot, SubSectionRoot, Textarea } from '@mastra/playground-ui';
import { Controller } from 'react-hook-form';

import { useAgentEditFormContext } from '../../context/agent-edit-form-context';
import { AgentSharingPanel } from '@/domains/agent-studio/components/agent-sharing-panel';
import { CreateAgentAvatarPicker } from '@/domains/agent-studio/components/create-agent-avatar-picker';
import { useOptionalPendingAvatar } from '@/domains/agent-studio/components/pending-avatar-context';
import { SectionHeader } from '@/domains/cms';
import { SubSectionHeader } from '@/domains/cms/components/section/section-header';
import { LLMProviders, LLMModels } from '@/domains/llm';

export function InformationPage() {
  const { form, readOnly, mode, agentId } = useAgentEditFormContext();
  const pendingAvatarCtx = useOptionalPendingAvatar();
  const {
    register,
    control,
    formState: { errors },
    watch,
  } = form;
  const nameValue = watch('name') ?? '';

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

        {mode === 'edit' && agentId && !readOnly && (
          <div className="border-t border-border1 pt-8">
            <AgentSharingPanel agentId={agentId} />
          </div>
        )}

        {mode === 'create' && !readOnly && pendingAvatarCtx && (
          <div className="border-t border-border1 pt-8">
            <CreateAgentAvatarPicker
              name={nameValue}
              value={pendingAvatarCtx.pendingAvatar}
              onChange={pendingAvatarCtx.setPendingAvatar}
            />
          </div>
        )}
      </SectionRoot>
    </ScrollArea>
  );
}
