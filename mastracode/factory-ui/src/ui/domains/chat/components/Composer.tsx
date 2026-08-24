import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import {
  Composer as ComposerRoot,
  ComposerActions,
  ComposerBox,
  ComposerInput,
  ComposerRing,
} from '@mastra/playground-ui/components/Composer';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowUp, ImagePlus, Square } from 'lucide-react';
import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useMatch, useNavigate, useParams } from 'react-router';

import { INITIAL_THREAD_MESSAGE_LIMIT, queryKeys } from '../../../../api/keys';
import { useChatCommands } from '../context/ChatCommandsProvider';
import { useChatMessagesInitializing } from '../context/useChatMessagesInitializing';
import { useChatConnection } from '../context/useChatConnection';
import { useChatModels } from '../context/useChatModels';
import { useChatModes } from '../context/useChatModes';
import { useChatSessionContext } from '../context/useChatSessionContext';
import { useChatTranscript } from '../context/useChatTranscript';
import {
  useAbortAgentControllerMutation,
  useSendAgentControllerMessageMutation,
} from '../../../../hooks/useAgentControllerRunMutations';
import { useCreateAgentControllerThreadMutation } from '../../../../hooks/useAgentControllerThreadMutations';
import { usePreparingThreadId } from '../hooks/usePreparingThreadId';
import { useCreateUserSessionFromDraft } from '../hooks/useCreateUserSessionFromDraft';
import { usePendingPlanFeedback } from '../hooks/usePendingPlanFeedback';
import type { SlashCommand, SlashCommandOption } from '../services/commands';
import { commandRequiresReadySession, matchCommandOptions, matchCommands } from '../services/commands';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { getModeColorClass } from './mode-colors';
import { StatusLine } from './StatusLine';
import { ComposerImageAttachments, ComposerSuggestions } from './ComposerParts';
import type { ComposerSuggestionItem } from './ComposerParts';
import { useComposerSpotlight } from './useComposerSpotlight';
import { useComposerImages } from './useComposerImages';
import type { PendingImage } from './useComposerImages';
import { useInitializingPlaceholder } from './useInitializingPlaceholder';

type ComposerVariant = 'inline' | 'textarea';

const composerVariantClass: Record<ComposerVariant, string> = {
  inline: 'min-h-10',
  textarea: 'min-h-28',
};

const composerVariantMaxHeight: Record<ComposerVariant, string> = {
  inline: '13rem',
  textarea: '16rem',
};

type ComposerProps = {
  variant?: ComposerVariant;
};

type ComposerSuggestion =
  | { kind: 'command'; command: SlashCommand }
  | { kind: 'option'; command: SlashCommand; option: SlashCommandOption };

function toComposerSuggestionItem(suggestion: ComposerSuggestion): ComposerSuggestionItem {
  if (suggestion.kind === 'command') {
    return {
      id: `command:${suggestion.command.name}`,
      label: `/${suggestion.command.name}`,
      description: suggestion.command.description,
    };
  }
  return {
    id: `option:${suggestion.command.name}:${suggestion.option.value}`,
    label: suggestion.option.label,
    description: suggestion.option.description,
    active: suggestion.option.active,
  };
}

export function Composer({ variant = 'inline' }: ComposerProps) {
  const { kind, resourceId, sessionEnabled, sandboxPreparing, projectPath, baseUrl, factorySessionState } =
    useChatSessionContext();
  const messagesInitializing = useChatMessagesInitializing();
  const chatPreparing = sandboxPreparing || messagesInitializing;
  const { factoryId } = useParams<{ factoryId: string }>();
  const onDraftComposer = useMatch('/factories/:factoryId/new') !== null;
  const onUserDraft = useMatch('/factories/:factoryId/user/new/:draftSessionId') !== null;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { status } = useChatConnection();
  const { busy, localUser, failLocalUser, reset, clearPending, pushNotice } = useChatTranscript();
  const { modes, activeModeId, isLoading: modesLoading, error: modesError, setMode } = useChatModes();
  const { activeModelId, isLoading: modelLoading, error: modelError } = useChatModels();
  const {
    commands,
    composerDraft: draft,
    composerInputRef: inputRef,
    setComposerDraft,
    runComposerCommand,
  } = useChatCommands();
  const modeColorClass = getModeColorClass(activeModeId ?? modes[0]?.id);

  const hookArgs = {
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    scope: projectPath,
    baseUrl,
    enabled: sessionEnabled,
  };
  const createThreadMutation = useCreateAgentControllerThreadMutation(hookArgs);
  const sendMutation = useSendAgentControllerMessageMutation(hookArgs);
  const abortMutation = useAbortAgentControllerMutation(hookArgs);
  const planFeedback = usePendingPlanFeedback();

  const preparingThreadId = usePreparingThreadId();
  const createDraftSessionMutation = useCreateUserSessionFromDraft();
  const blocked = onUserDraft ? !factorySessionState : status !== 'ready' && !preparingThreadId;
  const draftConfigNotReady =
    onUserDraft && (modesLoading || modesError !== undefined || modelLoading || modelError !== undefined);
  const attachDisabled = onUserDraft || blocked || chatPreparing || planFeedback.pending;
  const { images, setImages, fileInputRef, removeImage, onPaste, onDrop, onFileInputChange } = useComposerImages({
    onUserDraft,
    disabled: chatPreparing || planFeedback.pending,
  });
  const spotlightRef = useComposerSpotlight();
  const modeSwitchPendingRef = useRef(false);
  const optionMatch = planFeedback.pending ? undefined : matchCommandOptions(commands, draft);
  const matchingCommands = planFeedback.pending || optionMatch ? [] : matchCommands(commands, draft);
  const suggestions: ComposerSuggestion[] = optionMatch
    ? optionMatch.options.map(option => ({ kind: 'option', command: optionMatch.command, option }))
    : matchingCommands.map(command => ({ kind: 'command', command }));
  const suggestionItems = suggestions.map(toComposerSuggestionItem);
  const showSuggestions = suggestions.length > 0;
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const composerDisabled = createDraftSessionMutation.isPending || blocked || planFeedback.isSubmitting;
  const sendDisabled = composerDisabled || draftConfigNotReady || chatPreparing || planFeedback.loading;
  const textareaDisabled = composerDisabled && !chatPreparing;
  const initializingPlaceholder = useInitializingPlaceholder(chatPreparing, draft.length === 0);
  const normalPlaceholder = planFeedback.pending
    ? 'Give feedback on this plan…'
    : busy && !preparingThreadId
      ? 'Steer the agent…'
      : 'Ask Mastra Code…';
  const placeholder = initializingPlaceholder ?? normalPlaceholder;
  const sendTitle = chatPreparing ? 'Initializing session…' : undefined;

  const updateDraft = (next: string) => {
    setComposerDraft(next);
    setActiveSuggestion(0);
  };

  const applyCommand = (command: SlashCommand) => {
    updateDraft(`/${command.name} `);
    inputRef.current?.focus();
  };

  const createThread = async () => {
    const thread = await createThreadMutation.mutateAsync(undefined);
    reset(thread.id);
    return thread.id;
  };

  const seedThreadMessageCache = (threadId: string, text: string, files: PendingImage[]) => {
    const message: MastraDBMessage = {
      id: `local-${Date.now()}`,
      role: 'user',
      createdAt: new Date(),
      content: {
        format: 2,
        parts: [
          { type: 'text', text },
          ...files.map(f => ({ type: 'file' as const, data: f.data, mimeType: f.mediaType })),
        ],
      },
    };
    queryClient.setQueryData(
      queryKeys.agentControllerThreadMessages(AGENT_CONTROLLER_ID, resourceId, threadId, INITIAL_THREAD_MESSAGE_LIMIT),
      [message],
    );
  };

  const send = async (text: string, files: PendingImage[]) => {
    if (!text.trim() && files.length === 0) return;
    const outgoing = files.map(f => ({ data: f.data, mediaType: f.mediaType, filename: f.filename }));
    if (onDraftComposer) {
      const threadId = await createThread();
      localUser(text, false, outgoing);
      await sendMutation.mutateAsync({ text, files: outgoing });
      seedThreadMessageCache(threadId, text, files);
      void navigate(`/factories/${factoryId}/threads/${threadId}`, { replace: true });
      return;
    }
    localUser(text, false, outgoing);
    await sendMutation.mutateAsync({ text, files: outgoing });
  };

  const steer = async (text: string) => {
    if (!text.trim()) return;
    const localId = localUser(text, true);
    try {
      await sendMutation.mutateAsync({ text });
    } catch (error) {
      failLocalUser(localId);
      throw error;
    }
  };

  const submitInput = (text: string) => {
    updateDraft('');
    void handleInput(text).catch(error => {
      if (planFeedback.pending) updateDraft(text);
      clearPending();
      pushNotice(error instanceof Error ? error.message : 'The message could not be sent.', 'error');
    });
  };

  const onSubmit = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (sendDisabled) return;
    const text = draft.trim();
    if ((!text && images.length === 0) || (planFeedback.pending && !text)) return;
    submitInput(text);
  };

  const selectSuggestion = (suggestion: ComposerSuggestion) => {
    if (suggestion.kind === 'command') {
      applyCommand(suggestion.command);
      return;
    }
    if (sendDisabled) return;
    submitInput(`/${suggestion.command.name} ${suggestion.option.value}`);
  };

  const onComposerKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab' && e.shiftKey && kind !== 'factory' && modes.length > 1) {
      e.preventDefault();
      if (modeSwitchPendingRef.current) return;

      const selectedModeId = activeModeId ?? modes[0]?.id;
      const currentModeIndex = modes.findIndex(mode => mode.id === selectedModeId);
      const nextMode = modes[(currentModeIndex + 1) % modes.length];
      if (!nextMode) return;

      modeSwitchPendingRef.current = true;
      void setMode(nextMode.id).then(
        () => {
          modeSwitchPendingRef.current = false;
        },
        () => {
          modeSwitchPendingRef.current = false;
        },
      );
      return;
    }
    if (e.key === 'Escape' && optionMatch) {
      e.preventDefault();
      updateDraft(`/${optionMatch.command.name}`);
      return;
    }
    if (showSuggestions) {
      const safeIndex = Math.min(activeSuggestion, suggestions.length - 1);
      const current = suggestions[safeIndex];
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveSuggestion(i => (i + 1) % suggestions.length);
        return;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveSuggestion(i => (i - 1 + suggestions.length) % suggestions.length);
        return;
      } else if (e.key === 'Tab') {
        e.preventDefault();
        if (current) selectSuggestion(current);
        return;
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!current) return;
        if (current.kind === 'option') {
          selectSuggestion(current);
          return;
        }
        const exact = draft.toLowerCase() === `/${current.command.name}` && suggestions.length === 1;
        if (exact && !current.command.options?.length) {
          onSubmit(e);
          return;
        }
        applyCommand(current.command);
        return;
      } else if (e.key === 'Escape') {
        e.preventDefault();
        updateDraft('');
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSubmit(e);
    }
  };

  async function handleInput(text: string) {
    if (planFeedback.pending) {
      await planFeedback.submitFeedback(text);
      setImages([]);
      return;
    }
    if (onUserDraft && text.startsWith('/')) {
      if (commandRequiresReadySession(commands, text)) {
        updateDraft(text);
        pushNotice('This command needs a session. Send a prompt to create one first.');
      } else {
        await runComposerCommand(text);
      }
      return;
    }
    if (onUserDraft) {
      try {
        await createDraftSessionMutation.mutateAsync(text);
      } catch (error) {
        updateDraft(text);
        throw error;
      }
      return;
    }
    if (preparingThreadId && text.startsWith('/') && commandRequiresReadySession(commands, text)) {
      updateDraft(text);
      pushNotice('Commands run once the session is ready.');
      return;
    }
    if (await runComposerCommand(text)) return;
    if (busy && !preparingThreadId) {
      await steer(text);
      return;
    }
    const files = images;
    setImages([]);
    try {
      await send(text, files);
    } catch (error) {
      setImages(current => [...files, ...current]);
      throw error;
    }
  }

  return (
    <ComposerRoot onSubmit={onSubmit} onDrop={onDrop} onDragOver={e => e.preventDefault()}>
      <ComposerRing busy={busy || chatPreparing} className={modeColorClass}>
        <ComposerBox ref={spotlightRef} className={cn('composer-spotlight', modeColorClass)}>
          <div aria-hidden="true" className="composer-spotlight-surface" />
          <ComposerSuggestions
            items={suggestionItems}
            activeIndex={activeSuggestion}
            contextLabel={optionMatch ? `/${optionMatch.command.name}` : undefined}
            onBack={optionMatch ? () => updateDraft(`/${optionMatch.command.name}`) : undefined}
            onSelect={index => {
              const suggestion = suggestions[index];
              if (suggestion) selectSuggestion(suggestion);
            }}
          />
          <ComposerImageAttachments images={images} onRemove={removeImage} />
          <ComposerInput
            ref={inputRef}
            value={draft}
            onChange={e => updateDraft(e.target.value)}
            onKeyDown={onComposerKeyDown}
            onPaste={onPaste}
            placeholder={placeholder}
            disabled={textareaDisabled}
            maxHeight={composerVariantMaxHeight[variant]}
            className={composerVariantClass[variant]}
            aria-label="Message"
            aria-keyshortcuts="Shift+Tab"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={onFileInputChange}
            className="hidden"
            aria-label="Attach images"
          />
          <ComposerActions className="static w-full flex-wrap items-end justify-between px-3 pb-3">
            <StatusLine />
            <ButtonsGroup className="ml-auto" spacing="close" aria-label="Composer actions">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                disabled={attachDisabled}
                onClick={() => fileInputRef.current?.click()}
                aria-label="Attach image"
              >
                <ImagePlus size={14} />
              </Button>
              {busy && !preparingThreadId && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  onClick={() => void abortMutation.mutateAsync()}
                  aria-label="Abort"
                >
                  <Square size={14} />
                </Button>
              )}
              <Button
                type="submit"
                variant="outline"
                size="icon-sm"
                disabled={
                  sendDisabled || (!draft.trim() && images.length === 0) || (planFeedback.pending && !draft.trim())
                }
                aria-label="Send message"
                title={sendTitle}
              >
                <ArrowUp size={16} />
              </Button>
            </ButtonsGroup>
          </ComposerActions>
        </ComposerBox>
      </ComposerRing>
    </ComposerRoot>
  );
}
