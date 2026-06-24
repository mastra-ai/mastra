import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { useCallback, useMemo, useRef, useState } from 'react';
import { FormProvider, useForm, useFormContext, useWatch } from 'react-hook-form';
import { Navigate, useParams } from 'react-router';
import { AutosaveIndicator } from '@/domains/agent-builder/components/agent-edit/autosave-indicator';
import { DeleteSkillPanelButton } from '@/domains/agent-builder/components/skill-edit/delete-skill-action';
import { SkillBuilderMobileMenu } from '@/domains/agent-builder/components/skill-edit/skill-builder-mobile-menu';
import { VisibilitySelect } from '@/domains/agent-builder/components/skill-edit/visibility-select';
import { AgentColorProvider } from '@/domains/agent-builder/contexts/agent-color-context';
import { useAutosaveSkill } from '@/domains/agent-builder/hooks/use-autosave-skill';
import type { SkillEditFormValues } from '@/domains/agent-builder/hooks/use-autosave-skill';
import { useStarterUserMessage } from '@/domains/agent-builder/hooks/use-starter-user-message';
import { useStoredSkill } from '@/domains/agent-builder/hooks/use-stored-skill';
import { SkillWorkspaceLayout } from '@/domains/agent-builder/layouts/skill-workspace-layout';
import { SkillChatComposer } from '@/domains/agents/components/agent-cms-pages/skill-chat-composer';
import { SkillSimpleForm } from '@/domains/agents/components/agent-cms-pages/skill-simple-form';
import { useAuthCapabilities } from '@/domains/auth/hooks/use-auth-capabilities';
import { useCurrentUser } from '@/domains/auth/hooks/use-current-user';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';

export default function AgentBuilderSkillsEdit() {
  const { id } = useParams<{ id: string }>();
  const { hasPermission, rbacEnabled } = usePermissions();
  const canWrite = !rbacEnabled || hasPermission('stored-skills:write');
  const { data: storedSkill, isLoading: isStoredSkillLoading } = useStoredSkill(id);
  const { data: currentUser, isLoading: isCurrentUserLoading } = useCurrentUser();
  const initialUserMessage = useStarterUserMessage();

  const isOwner = !storedSkill?.authorId || currentUser?.id === storedSkill.authorId;
  const isOwnershipLoading = Boolean(storedSkill?.authorId) && isCurrentUserLoading;
  const isReady = Boolean(id) && !isStoredSkillLoading && !isOwnershipLoading;

  if (!isReady) {
    return <AgentBuilderSkillEditSkeleton />;
  }

  if (!storedSkill) {
    return <Navigate to="/agent-builder/skills" replace />;
  }

  if (!canWrite || !isOwner) {
    return <Navigate to={`/agent-builder/skills/${id}/view`} replace />;
  }

  return <AgentBuilderSkillEditPage id={id!} storedSkill={storedSkill} initialUserMessage={initialUserMessage} />;
}

const AgentBuilderSkillEditSkeleton = () => (
  <div className="h-screen w-screen flex items-center justify-center">
    <Spinner />
  </div>
);

interface PageProps {
  id: string;
  storedSkill: NonNullable<ReturnType<typeof useStoredSkill>['data']>;
  initialUserMessage: string | undefined;
}

const AgentBuilderSkillEditPage = ({ id, storedSkill, initialUserMessage }: PageProps) => {
  const formMethods = useForm<SkillEditFormValues>({
    defaultValues: {
      name: storedSkill.name ?? '',
      description: storedSkill.description ?? '',
      instructions: storedSkill.instructions ?? '',
      visibility: storedSkill.visibility ?? 'private',
      workspaceId: undefined,
    },
  });

  return (
    <FormProvider {...formMethods}>
      <AgentColorProvider agentId={id}>
        <AgentBuilderSkillEditReady id={id} initialUserMessage={initialUserMessage} />
      </AgentColorProvider>
    </FormProvider>
  );
};

interface ReadyProps {
  id: string;
  initialUserMessage: string | undefined;
}

const AgentBuilderSkillEditReady = ({ id, initialUserMessage }: ReadyProps) => {
  const formMethods = useFormContext<SkillEditFormValues>();
  const autosave = useAutosaveSkill({ skillId: id });

  const name = useWatch({ control: formMethods.control, name: 'name' }) ?? '';
  const description = useWatch({ control: formMethods.control, name: 'description' }) ?? '';
  const instructions = useWatch({ control: formMethods.control, name: 'instructions' }) ?? '';

  const setName = useCallback(
    (next: string) => formMethods.setValue('name', next, { shouldDirty: true }),
    [formMethods],
  );
  const setDescription = useCallback(
    (next: string) => formMethods.setValue('description', next, { shouldDirty: true }),
    [formMethods],
  );
  const setInstructions = useCallback(
    (next: string) => formMethods.setValue('instructions', next, { shouldDirty: true }),
    [formMethods],
  );

  const formState = useMemo(() => ({ name, description, instructions }), [name, description, instructions]);

  // The composer takes an initialUserMessage by sending it on mount. We use a
  // simple key strategy: the skill id is stable per route so chat resets only on navigation.
  const sessionKey = id;
  const hasTitle = name.trim().length > 0;

  // Track whether the builder agent has completed at least one turn. When the
  // edit page is opened with a starter prompt, the agent will stream and patch
  // the title mid-run; the right-side form must stay hidden until that run
  // finishes (avoiding flicker of an empty/partial form). For routes opened
  // without a starter prompt (e.g. revisiting an existing skill), we treat the
  // first turn as already complete since no auto-run will happen.
  const hadStarterPromptRef = useRef(initialUserMessage !== undefined);
  const [hasCompletedFirstTurn, setHasCompletedFirstTurn] = useState(!hadStarterPromptRef.current);
  const wasRunningRef = useRef(false);
  const onComposerRunningChange = useCallback((isRunning: boolean) => {
    if (isRunning) {
      wasRunningRef.current = true;
      return;
    }
    if (wasRunningRef.current) {
      setHasCompletedFirstTurn(true);
    }
  }, []);

  const showForm = hasTitle && hasCompletedFirstTurn;

  return (
    <SkillWorkspaceLayout
      title={name || 'Untitled skill'}
      rightAside={
        <AutosaveIndicator status={autosave.status} lastError={autosave.lastError} onRetry={autosave.retry} />
      }
      primaryAction={
        <div className="hidden lg:flex items-center gap-2">
          <VisibilitySelectConnected skillId={id} />
        </div>
      }
      mobileExtra={
        <SkillBuilderMobileMenu skillId={id} skillName={name || 'Untitled skill'} showSetVisibility showDelete />
      }
      showForm={showForm}
      deleteAction={<DeleteSkillPanelButton skillId={id} skillName={name || 'Untitled skill'} />}
      chat={
        <SkillChatComposer
          sessionKey={sessionKey}
          hasFields={!!(name.trim() || description.trim() || instructions.trim())}
          formState={formState}
          initialUserMessage={initialUserMessage}
          onRunningChange={onComposerRunningChange}
          onNameChange={setName}
          onDescriptionChange={setDescription}
          onInstructionsChange={setInstructions}
        />
      }
      form={
        <div className="h-full min-h-0 overflow-y-auto p-4 md:p-6">
          <SkillSimpleForm
            name={name}
            onNameChange={setName}
            description={description}
            onDescriptionChange={setDescription}
            instructions={instructions}
            onInstructionsChange={setInstructions}
          />
        </div>
      }
    />
  );
};

const VisibilitySelectConnected = ({ skillId }: { skillId: string }) => {
  const { data: capabilities } = useAuthCapabilities();
  if (!capabilities?.enabled) return null;
  return <VisibilitySelect skillId={skillId} />;
};
