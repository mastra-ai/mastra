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
import { useChatMessagesInitializing } from '../context/ChatSessionProvider';
import { useChatConnection } from '../context/useChatConnection';
import { useChatModels } from '../context/useChatModels';
import { useChatModes } from '../context/useChatModes';
import { useChatSessionContext } from '../context/useChatSessionContext';
import { useChatTranscript } from '../context/useChatTranscript';
import {
  useAbortAgentControllerMutation,
  useSendAgentControllerMessageMutation,
  useSteerAgentControllerMutation,
} from '../../../../hooks/useAgentControllerRunMutations';
import { useCreateAgentControllerThreadMutation } from '../../../../hooks/useAgentControllerThreadMutations';
import { usePreparingThreadId } from '../hooks/usePreparingThreadId';
import { useCreateUserSessionFromDraft } from '../hooks/useCreateUserSessionFromDraft';
import { commandRequiresReadySession, matchCommands } from '../services/commands';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { getModeColorClass } from './mode-colors';
import { StatusLine } from './StatusLine';
import { ComposerImageAttachments, ComposerSuggestions } from './ComposerParts';
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

export function Composer({ variant = 'inline' }: ComposerProps) {
  const { kind, resourceId, sessionEnabled, sandboxPreparing, projectPath, baseUrl, factorySessionState } =
    useChatSessionContext();
  const messagesInitializing = useChatMessagesInitializing();
  // A single "preparing" concept from the composer's point of view: the ring
  // must keep spinning, the placeholder must keep saying "Initializing…",
  // and Send must stay disabled through both the sandbox provisioning phase
  // and the post-ensure messages-fetch phase — otherwise the ring stops
  // spinning mid-open and the user thinks the app is stuck.
  const chatPreparing = sandboxPreparing || messagesInitializing;
  const { factoryId } = useParams<{ factoryId: string }>();
  const onDraftComposer = useMatch('/factories/:factoryId/new') !== null;
  const onUserDraft = useMatch('/factories/:factoryId/user/new/:draftSessionId') !== null;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { status } = useChatConnection();
  const { busy, localUser, reset, clearPending, pushNotice } = useChatTranscript();
  const { modes, activeModeId, isLoading: modesLoading, error: modesError, setMode } = useChatModes();
  const { activeModelId, isLoading: modelLoading, error: modelError } = useChatModels();
  const { composerDraft: draft, composerInputRef: inputRef, setComposerDraft, runComposerCommand } = useChatCommands();
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
  const steerMutation = useSteerAgentControllerMutation(hookArgs);
  const abortMutation = useAbortAgentControllerMutation(hookArgs);

  const preparingThreadId = usePreparingThreadId();
  const createDraftSessionMutation = useCreateUserSessionFromDraft();

  const { images, setImages, fileInputRef, removeImage, onPaste, onDrop, onFileInputChange } =
    useComposerImages(onUserDraft);
  const spotlightRef = useComposerSpotlight();
  const modeSwitchPendingRef = useRef(false);
  const suggestions = matchCommands(draft);
  const showSuggestions = suggestions.length > 0;
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const blocked = onUserDraft ? !factorySessionState : status !== 'ready' && !preparingThreadId;
  // typing stays free while the mode/model catalogs load; only creating the session commits to them
  const draftConfigNotReady =
    onUserDraft && (modesLoading || modesError !== undefined || modelLoading || modelError !== undefined);
  const attachDisabled = onUserDraft || blocked || chatPreparing;
  const disabled = createDraftSessionMutation.isPending || blocked;
  const sendDisabled = disabled || draftConfigNotReady || chatPreparing;
  // Keep the textarea fully typable while the session is preparing — the
  // user must be able to draft a message immediately. Only Send/attach gate
  // on chatPreparing above.
  const textareaDisabled = chatPreparing ? false : disabled;
  const initializingPlaceholder = useInitializingPlaceholder(chatPreparing, draft.length === 0);
  const sendTitle = chatPreparing ? 'Initializing session…' : undefined;

  const updateDraft = (next: string) => {
    setComposerDraft(next);
    setActiveSuggestion(0);
  };

  const applyCommand = (name: string) => {
    updateDraft(`/${name} `);
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
    localUser(text, true);
    await steerMutation.mutateAsync(text);
  };

  const onSubmit = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (sendDisabled) return;
    const text = draft.trim();
    if (!text && images.length === 0) return;
    updateDraft('');
    void handleInput(text).catch(error => {
      clearPending();
      pushNotice(error instanceof Error ? error.message : 'The message could not be sent.', 'error');
    });
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
        if (current) applyCommand(current.name);
        return;
      } else if (e.key === 'Enter' && !e.shiftKey) {
        const exact = !!current && draft.slice(1) === current.name && suggestions.length === 1;
        if (exact) {
          e.preventDefault();
          onSubmit(e);
          return;
        }
        e.preventDefault();
        if (current) applyCommand(current.name);
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
    if (onUserDraft && text.startsWith('/')) {
      if (commandRequiresReadySession(text)) {
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
    if (preparingThreadId && text.startsWith('/') && commandRequiresReadySession(text)) {
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
    <ComposerRoot onSubmit={onSubmit} onDrop={onDrop} onDragOver={e => e.preventDefault()} className="relative">
      <ComposerSuggestions suggestions={suggestions} activeIndex={activeSuggestion} onSelect={applyCommand} />
      <ComposerRing busy={busy || chatPreparing} className={modeColorClass}>
        <ComposerBox ref={spotlightRef} className={cn('composer-spotlight', modeColorClass)}>
          <div aria-hidden="true" className="composer-spotlight-surface" />
          <ComposerImageAttachments images={images} onRemove={removeImage} />
          <ComposerInput
            ref={inputRef}
            value={draft}
            onChange={e => updateDraft(e.target.value)}
            onKeyDown={onComposerKeyDown}
            onPaste={onPaste}
            placeholder={
              initializingPlaceholder ?? (busy && !preparingThreadId ? 'Steer the agent…' : 'Ask Mastra Code…')
            }
            disabled={textareaDisabled}
            maxHeight={composerVariantMaxHeight[variant]}
            className={cn(composerVariantClass[variant], 'text-[15px]')}
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
                disabled={sendDisabled || (!draft.trim() && images.length === 0)}
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
