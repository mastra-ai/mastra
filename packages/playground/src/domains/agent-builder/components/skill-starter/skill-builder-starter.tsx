import { Button } from '@mastra/playground-ui/components/Button';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Textarea } from '@mastra/playground-ui/components/Textarea';
import { toast } from '@mastra/playground-ui/utils/toast';
import { ArrowUpIcon, BookOpen, FileText, GraduationCap, Wrench } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useBuilderSettings } from '@/domains/agent-builder/hooks/use-builder-settings';
import { useCreateSkill } from '@/domains/agents/hooks/use-create-skill';
import { useDefaultVisibility } from '@/domains/auth/hooks/use-default-visibility';
import { useStoredWorkspaces } from '@/domains/workspace/hooks/use-stored-workspaces';

const EXAMPLES = [
  {
    title: 'Code reviewer',
    icon: Wrench,
    prompt:
      'Build a skill that reviews TypeScript code for type-safety issues, missing tests, and inconsistent patterns. Leave concrete suggestions with examples.',
  },
  {
    title: 'Doc summarizer',
    icon: FileText,
    prompt:
      'Build a skill that summarizes long technical documents into a one-page brief with the key points, action items, and open questions.',
  },
  {
    title: 'Onboarding tutor',
    icon: GraduationCap,
    prompt:
      'Build a skill that onboards new engineers to a codebase. Explain the architecture, point to the right docs, and answer questions in plain English with code examples.',
  },
  {
    title: 'Research notes',
    icon: BookOpen,
    prompt:
      'Build a skill that turns messy research notes into structured findings with sources, methodology, and a tl;dr at the top.',
  },
];

const truncateName = (prompt: string): string => (prompt.length <= 20 ? prompt : prompt.slice(0, 20) + '…');

export const SkillBuilderStarter = () => {
  const [message, setMessage] = useState('');
  const navigate = useNavigate();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const createSkill = useCreateSkill();
  const defaultVisibility = useDefaultVisibility();
  const { data: workspacesData } = useStoredWorkspaces();
  const { data: builderSettings } = useBuilderSettings();

  const workspaceOptions = useMemo(
    () =>
      (workspacesData?.workspaces ?? [])
        .filter(ws => ws.status !== 'archived')
        .sort((a, b) => (b.runtimeRegistered ? 1 : 0) - (a.runtimeRegistered ? 1 : 0))
        .map(ws => ({ value: ws.id, label: ws.name })),
    [workspacesData],
  );

  const builderDefaultWorkspaceId = useMemo(() => {
    const ws = (builderSettings?.configuration?.agent as Record<string, unknown> | undefined)?.workspace as
      { type: string; workspaceId?: string } | undefined;
    return ws?.type === 'id' ? ws.workspaceId : undefined;
  }, [builderSettings]);

  const trimmed = message.trim();
  const isCreating = createSkill.isPending;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (trimmed.length === 0 || isCreating) return;
    const id = nanoid();
    const workspaceId =
      builderDefaultWorkspaceId ?? (workspaceOptions.length === 1 ? workspaceOptions[0].value : undefined);
    try {
      await createSkill.mutateAsync({
        id,
        name: truncateName(trimmed),
        description: '',
        instructions: '',
        visibility: defaultVisibility,
        workspaceId,
        files: [],
      });
    } catch {
      toast.error('Failed to start a new skill');
      return;
    }
    void navigate(`/agent-builder/skills/${id}/edit`, {
      state: { userMessage: trimmed },
      viewTransition: true,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isCreating) return;
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      e.currentTarget.form?.requestSubmit();
    }
  };

  const handleExampleClick = (prompt: string) => {
    setMessage(prompt);
    textareaRef.current?.focus();
  };

  return (
    <div className="starter-aurora flex min-h-full flex-col items-center justify-center bg-surface1 px-6 py-24">
      <div className="relative z-10 flex w-full max-w-3xl flex-col gap-12">
        <h1
          className="starter-heading text-center font-serif text-neutral6"
          style={{ fontSize: 'clamp(1.875rem, 3.5vw, 2.5rem)', lineHeight: 1.1, letterSpacing: '-0.015em' }}
        >
          What skill do you want to build?
        </h1>

        <form onSubmit={handleSubmit}>
          <div
            className="starter-prompt rounded-2xl border border-border1 bg-surface2 transition-colors duration-normal ease-out-custom focus-within:border-neutral3"
            style={{ viewTransitionName: 'skill-chat-composer' }}
          >
            <Textarea
              ref={textareaRef}
              testId="skill-builder-starter-input"
              size="default"
              variant="unstyled"
              placeholder="Describe the skill you want to build…"
              value={message}
              onChange={e => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isCreating}
              className="min-h-[112px] resize-none px-5 py-4 text-ui-md outline-none placeholder:text-neutral3 focus:outline-none focus-visible:outline-none"
              rows={3}
            />
            <div className="flex items-center justify-end px-3 pb-2.5">
              <Button
                type="submit"
                variant="default"
                size="icon-md"
                tooltip="Start building"
                disabled={trimmed.length === 0 || isCreating}
                data-testid="skill-builder-starter-submit"
                className="rounded-full"
              >
                {isCreating ? (
                  <span data-testid="skill-builder-starter-submit-spinner">
                    <Spinner />
                  </span>
                ) : (
                  <ArrowUpIcon />
                )}
              </Button>
            </div>
          </div>
        </form>

        <div className="flex flex-wrap justify-center gap-2">
          {EXAMPLES.map((example, i) => {
            const Icon = example.icon;
            return (
              <button
                key={example.title}
                type="button"
                onClick={() => handleExampleClick(example.prompt)}
                data-testid={`skill-builder-starter-example-${example.title.toLowerCase().replace(/\s+/g, '-')}`}
                style={{ animationDelay: `${280 + i * 40}ms` }}
                className="starter-chip group inline-flex items-center gap-2 rounded-full border border-border1 bg-transparent px-4 py-2 text-ui-sm text-neutral4 transition-colors duration-normal ease-out-custom hover:border-border2 hover:bg-surface2 hover:text-neutral6"
              >
                <Icon className="h-3.5 w-3.5 text-neutral3 transition-colors group-hover:text-neutral5" />
                {example.title}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
