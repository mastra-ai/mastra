import {
  AgentIcon,
  Button,
  Header,
  HeaderAction,
  HeaderTitle,
  Icon,
  Input,
  Label,
  MainContentLayout,
  Spinner,
  Textarea,
} from '@mastra/playground-ui';
import { Check } from 'lucide-react';
import { Controller, useWatch } from 'react-hook-form';

import type { VisibleSections } from '../hooks/use-agent-builder-form';
import { useAgentBuilderForm } from '../hooks/use-agent-builder-form';
import { LLMModels, LLMProviders } from '@/domains/llm';

interface AgentBuilderFormProps {
  visibleSections: VisibleSections;
}

export function AgentBuilderForm({ visibleSections }: AgentBuilderFormProps) {
  const { form, onSubmit, isSubmitting } = useAgentBuilderForm(visibleSections);
  const { control, formState } = form;
  const { errors } = formState;

  const modelProvider = useWatch({ control, name: 'model.provider' });

  return (
    <MainContentLayout>
      <Header className="bg-surface1">
        <HeaderTitle>
          <Icon>
            <AgentIcon />
          </Icon>
          Create an agent
        </HeaderTitle>

        <HeaderAction>
          <Button variant="primary" onClick={onSubmit} disabled={isSubmitting} className="w-full">
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
                Create agent
              </>
            )}
          </Button>
        </HeaderAction>
      </Header>

      <div className="flex-1 overflow-auto p-6">
        <form onSubmit={onSubmit} className="max-w-2xl space-y-6">
          {/* Base Fields - Always visible */}
          <section className="space-y-4">
            <h2 className="text-lg font-medium text-text1">Identity</h2>

            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Controller
                name="name"
                control={control}
                render={({ field }) => (
                  <Input id="name" placeholder="My Agent" {...field} className={errors.name ? 'border-red-500' : ''} />
                )}
              />
              {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Controller
                name="description"
                control={control}
                render={({ field }) => <Input id="description" placeholder="A helpful agent..." {...field} />}
              />
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-medium text-text1">Instructions</h2>

            <div className="space-y-2">
              <Label htmlFor="instructions">Instructions *</Label>
              <Controller
                name="instructions"
                control={control}
                render={({ field }) => (
                  <Textarea
                    id="instructions"
                    placeholder="You are a helpful assistant..."
                    rows={6}
                    {...field}
                    className={errors.instructions ? 'border-red-500' : ''}
                  />
                )}
              />
              {errors.instructions && <p className="text-sm text-red-500">{errors.instructions.message}</p>}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-medium text-text1">Model</h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Provider *</Label>
                <Controller
                  name="model.provider"
                  control={control}
                  render={({ field }) => <LLMProviders value={field.value} onValueChange={field.onChange} />}
                />
                {errors.model?.provider && <p className="text-sm text-red-500">{errors.model.provider.message}</p>}
              </div>

              <div className="space-y-2">
                <Label>Model *</Label>
                <Controller
                  name="model.name"
                  control={control}
                  render={({ field }) => (
                    <LLMModels value={field.value} onValueChange={field.onChange} llmId={modelProvider} />
                  )}
                />
                {errors.model?.name && <p className="text-sm text-red-500">{errors.model.name.message}</p>}
              </div>
            </div>
          </section>

          {/* Capability Sections - Conditionally visible based on features */}
          {visibleSections.tools && (
            <section className="space-y-4">
              <h2 className="text-lg font-medium text-text1">Tools</h2>
              <p className="text-sm text-text2">Tool selection coming soon...</p>
            </section>
          )}

          {visibleSections.memory && (
            <section className="space-y-4">
              <h2 className="text-lg font-medium text-text1">Memory</h2>
              <p className="text-sm text-text2">Memory configuration coming soon...</p>
            </section>
          )}

          {visibleSections.skills && (
            <section className="space-y-4">
              <h2 className="text-lg font-medium text-text1">Skills</h2>
              <p className="text-sm text-text2">Skills selection coming soon...</p>
            </section>
          )}

          {visibleSections.workflows && (
            <section className="space-y-4">
              <h2 className="text-lg font-medium text-text1">Workflows</h2>
              <p className="text-sm text-text2">Workflow selection coming soon...</p>
            </section>
          )}

          {visibleSections.agents && (
            <section className="space-y-4">
              <h2 className="text-lg font-medium text-text1">Sub-Agents</h2>
              <p className="text-sm text-text2">Agent selection coming soon...</p>
            </section>
          )}
        </form>
      </div>
    </MainContentLayout>
  );
}
