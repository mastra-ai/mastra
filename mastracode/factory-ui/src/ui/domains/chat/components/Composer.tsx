import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import {
  Composer as ComposerRoot,
  ComposerActions,
  ComposerBox,
  ComposerHeader,
  ComposerInput,
  ComposerRing,
  ComposerSuggestions,
  useComposerCommands,
} from '@mastra/playground-ui/components/Composer';
import type { ComposerInputProps } from '@mastra/playground-ui/components/Composer';
import { useOptionalMessageScroller } from '@mastra/playground-ui/components/MessageScroller';
import { useQueryClient } from '@tanstack/react-query';
import { ImagePlus } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { useMatch, useNavigate, useParams } from 'react-router';

import { INITIAL_THREAD_MESSAGE_LIMIT, queryKeys } from '../../../../api/keys';
import {
  useAbortAgentControllerMutation,
  useSendAgentControllerMessageMutation,
} from '../../../../hooks/useAgentControllerRunMutations';
import { useCreateAgentControllerThreadMutation } from '../../../../hooks/useAgentControllerThreadMutations';
import { useChatCommands } from '../context/ChatCommandsProvider';
import type { PendingImage } from '../context/ComposerImagesContext';
import { useChatConnection } from '../context/useChatConnection';
import { useChatModels } from '../context/useChatModels';
import { useChatSessionContext } from '../context/useChatSessionContext';
import { useChatTranscript } from '../context/useChatTranscript';
import { useComposerConnectionNotice } from '../hooks/useComposerConnectionNotice';
import { useCreateUserSessionFromDraft } from '../hooks/useCreateUserSessionFromDraft';
import { clearPendingHandoff } from '../hooks/useHandoffPrompt';
import { usePendingPlanFeedback } from '../hooks/usePendingPlanFeedback';
import { usePreparingThreadId } from '../hooks/usePreparingThreadId';
import { commandRequiresReadySession } from '../services/commands';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { ComposerConnectionNotice } from './ComposerConnectionNotice';
import { ComposerImageAttachments } from './ComposerImageAttachments';
import { ComposerPrimaryAction } from './ComposerPrimaryAction';
import { StatusLine } from './StatusLine';
import { useComposerImages } from './useComposerImages';
import { useInitializingPlaceholder } from './useInitializingPlaceholder';

type ComposerProps = Pick<ComposerInputProps, 'variant'>;

export function Composer({ variant = 'inline' }: ComposerProps) {
  const { sessionId, sessionEnabled, baseUrl, factorySessionState } = useChatSessionContext();
  const { factoryId } = useParams<{ factoryId: string }>();
  const onDraftComposer = useMatch('/factories/:factoryId/new') !== null;
  const onUserDraft = useMatch('/factories/:factoryId/user/new/:draftSessionId') !== null;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { status } = useChatConnection();
  const connectionNotice = useComposerConnectionNotice(status);
  const connectionLost = connectionNotice.open && connectionNotice.notice !== 'reconnected';
  const { busy, phase, localUser, failLocalUser, reset, clearPending, pushNotice } = useChatTranscript();
  const chatPreparing = phase === 'initializing';
  const scroller = useOptionalMessageScroller();
  const { activeModelId, isLoading: modelLoading, error: modelError } = useChatModels();
  const {
    commands,
    composerDraft: draft,
    composerInputRef: inputRef,
    setComposerDraft,
    runComposerCommand,
  } = useChatCommands();

  const hookArgs = {
    agentControllerId: AGENT_CONTROLLER_ID,
    sessionId,
    baseUrl,
    enabled: sessionEnabled,
  };
  const createThreadMutation = useCreateAgentControllerThreadMutation(hookArgs);
  const sendMutation = useSendAgentControllerMessageMutation(hookArgs);
  const abortMutation = useAbortAgentControllerMutation(hookArgs);
  const planFeedback = usePendingPlanFeedback();

  const preparingThreadId = usePreparingThreadId();
  const liveRun = phase === 'working' && !preparingThreadId;
  const createDraftSessionMutation = useCreateUserSessionFromDraft();
  const blocked = onUserDraft ? !factorySessionState : status !== 'ready' && !preparingThreadId;
  const draftConfigNotReady = onUserDraft && (modelLoading || modelError !== undefined);
  const attachDisabled = blocked || chatPreparing || planFeedback.pending;
  const { images, setImages, fileInputRef, removeImage, onPaste, onDrop, onFileInputChange } = useComposerImages({
    disabled: chatPreparing || planFeedback.pending,
  });
  const composerDisabled = createDraftSessionMutation.isPending || blocked || planFeedback.isSubmitting;
  const sendDisabled = composerDisabled || draftConfigNotReady || chatPreparing || planFeedback.loading;
  const draftImagesCanBeSent = !planFeedback.pending && !liveRun;
  const hasSubmittableDraft = draft.trim().length > 0 || (images.length > 0 && draftImagesCanBeSent);
  const textareaDisabled = composerDisabled && !chatPreparing;
  const initializingPlaceholder = useInitializingPlaceholder(chatPreparing, draft.length === 0);
  const normalPlaceholder = planFeedback.pending
    ? 'Give feedback on this plan…'
    : liveRun
      ? 'Steer the agent…'
      : 'Ask Mastra Code…';
  const placeholder = initializingPlaceholder ?? normalPlaceholder;
  const sendTitle = chatPreparing ? 'Initializing session…' : undefined;

  const updateDraft = setComposerDraft;

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
      queryKeys.agentControllerThreadMessages(AGENT_CONTROLLER_ID, sessionId, threadId, INITIAL_THREAD_MESSAGE_LIMIT),
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
      clearPendingHandoff(sessionId);
      seedThreadMessageCache(threadId, text, files);
      void navigate(`/factories/${factoryId}/threads/${threadId}`, { replace: true });
      return;
    }
    localUser(text, false, outgoing);
    await sendMutation.mutateAsync({ text, files: outgoing });
    clearPendingHandoff(sessionId);
  };

  // Images leave the composer while in flight and come back if the send fails.
  const withPendingImages = async (run: (files: PendingImage[]) => Promise<unknown>) => {
    const files = images;
    setImages([]);
    try {
      await run(files);
    } catch (error) {
      setImages(current => [...files, ...current]);
      throw error;
    }
  };

  const steer = async (text: string) => {
    if (!text.trim()) return;
    const localId = localUser(text, true);
    scroller?.scrollToEnd({ behavior: 'smooth' });
    try {
      await sendMutation.mutateAsync({ text });
      clearPendingHandoff(sessionId);
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
    if (sendDisabled || !hasSubmittableDraft) return;
    submitInput(draft.trim());
  };

  const commandMenu = useComposerCommands({
    commands,
    value: draft,
    onValueChange: updateDraft,
    inputRef,
    enabled: !planFeedback.pending,
    onSubmit: text => {
      if (!sendDisabled) submitInput(text);
    },
  });

  const onComposerKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.defaultPrevented) return;
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
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
        await withPendingImages(files => createDraftSessionMutation.mutateAsync({ prompt: text, files }));
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
    if (liveRun) {
      await steer(text);
      return;
    }
    await withPendingImages(files => send(text, files));
  }

  return (
    <ComposerRoot onSubmit={onSubmit} onDrop={onDrop} onDragOver={e => e.preventDefault()}>
      <ComposerHeader open={connectionNotice.open}>
        <ComposerConnectionNotice notice={connectionNotice.notice} />
      </ComposerHeader>
      <ComposerRing busy={(busy || chatPreparing) && !connectionLost}>
        <ComposerBox>
          <ComposerSuggestions {...commandMenu.suggestionsProps} />
          <ComposerImageAttachments images={images} onRemove={removeImage} />
          <ComposerInput
            {...commandMenu.inputProps}
            ref={inputRef}
            onKeyDown={onComposerKeyDown}
            onPaste={onPaste}
            placeholder={placeholder}
            disabled={textareaDisabled}
            variant={variant}
            aria-label="Message"
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
          <ComposerActions>
            <StatusLine />
            <ButtonsGroup size="sm" className="ml-auto" aria-label="Composer actions">
              <Button
                type="button"
                size="icon-sm"
                disabled={attachDisabled}
                onClick={() => fileInputRef.current?.click()}
                aria-label="Attach image"
                tooltip="Images only"
              >
                <ImagePlus size={14} />
              </Button>
              <ComposerPrimaryAction
                showAbort={liveRun && !hasSubmittableDraft}
                sendDisabled={sendDisabled || !hasSubmittableDraft}
                sendTitle={sendTitle}
                onAbort={() => void abortMutation.mutateAsync()}
              />
            </ButtonsGroup>
          </ComposerActions>
        </ComposerBox>
      </ComposerRing>
    </ComposerRoot>
  );
}
