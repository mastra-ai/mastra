import type { MastraDBMessage } from '@mastra/core/agent-controller';
import {
  ComposerAnnotations,
  formatAnnotatedMessage,
  useChatAnnotations,
} from '@mastra/playground-ui/components/ai/annotations';
import type { ChatAnnotation } from '@mastra/playground-ui/components/ai/annotations';
import {
  Composer as ComposerRoot,
  ComposerActions,
  ComposerActionsEnd,
  ComposerActionsStart,
  ComposerAttachMenu,
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
import { useEffect, useEffectEvent, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
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
import { commandRequiresReadySession, isSlashCommand } from '../services/commands';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { mergeDictation } from '../services/dictation';
import { ComposerConnectionNotice } from './ComposerConnectionNotice';
import { ComposerImageAttachments } from './ComposerImageAttachments';
import { ComposerPrimaryAction } from './ComposerPrimaryAction';
import { ComposerVoiceButton } from './ComposerVoiceButton';
import { StatusLine } from './StatusLine';
import { ModelPicker } from './StatusLine/ModelPicker';
import { useComposerImages } from './useComposerImages';
import { useInitializingPlaceholder } from './useInitializingPlaceholder';
import { useVoiceDictation } from './useVoiceDictation';

type ComposerProps = Pick<ComposerInputProps, 'variant'> & {
  /** Leads the status row above the composer, e.g. who is steering this session. */
  statusLead?: ReactNode;
};

export function Composer({ variant = 'inline', statusLead }: ComposerProps) {
  const { sessionId, sessionEnabled, baseUrl, factorySessionState } = useChatSessionContext();
  const { factoryId } = useParams<{ factoryId: string }>();
  const onDraftComposer = useMatch('/factories/:factoryId/new') !== null;
  const onUserDraft = useMatch('/factories/:factoryId/user/new/:draftSessionId') !== null;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { status } = useChatConnection();
  const connectionNotice = useComposerConnectionNotice(status);
  const connectionLost = connectionNotice !== undefined;
  const { busy, phase, localUser, failLocalUser, reset, clearPending, pushNotice } = useChatTranscript();
  const chatPreparing = phase === 'initializing';
  const scroller = useOptionalMessageScroller();
  const { isLoading: modelLoading, error: modelError } = useChatModels();
  const {
    commands,
    composerDraft: draft,
    composerPreview: preview,
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
  const { annotations, takeAnnotations, restoreAnnotations } = useChatAnnotations();
  const createThreadMutation = useCreateAgentControllerThreadMutation(hookArgs);
  const sendMutation = useSendAgentControllerMessageMutation(hookArgs);
  const abortMutation = useAbortAgentControllerMutation(hookArgs);
  const planFeedback = usePendingPlanFeedback();

  const preparingThreadId = usePreparingThreadId();
  const liveRun = phase === 'working' && !preparingThreadId && sessionEnabled;
  const createSessionFromDraft = useCreateUserSessionFromDraft();
  const blocked = onUserDraft ? !factorySessionState : status !== 'ready' && !preparingThreadId;
  // A draft send waits for a model still loading, so only a model that failed to load holds it back.
  const draftModelFailed = onUserDraft && modelError !== undefined;
  const [heldDraftText, setHeldDraftText] = useState<string>();
  const startingDraft = heldDraftText !== undefined;
  const attachDisabled = blocked || chatPreparing || planFeedback.pending || startingDraft;
  const { images, setImages, removeImage, onPaste, onDrop, addFiles } = useComposerImages({
    disabled: chatPreparing || planFeedback.pending || startingDraft,
  });
  const composerDisabled = startingDraft || blocked || planFeedback.isSubmitting;
  const updateDraft = setComposerDraft;
  const insertTranscript = (transcript: string, replacing: string) => {
    updateDraft(current => mergeDictation(current, replacing, transcript));
    if (!replacing) inputRef.current?.focus();
  };
  const dictation = useVoiceDictation({
    factoryId,
    onTranscript: insertTranscript,
    onError: message => pushNotice(message, 'error'),
  });
  const dictating = dictation.state !== 'idle';
  const sendDisabled = composerDisabled || draftModelFailed || chatPreparing || planFeedback.loading || dictating;
  const draftImagesCanBeSent = !planFeedback.pending && !liveRun;
  const shownText = preview?.text ?? draft;
  const hasSubmittableDraft =
    shownText.trim().length > 0 || annotations.length > 0 || (images.length > 0 && draftImagesCanBeSent);
  // Typing never waits on the connection: a reconnect only holds back sending.
  const textareaDisabled = (startingDraft || planFeedback.isSubmitting || (onUserDraft && blocked)) && !chatPreparing;
  const initializingPlaceholder = useInitializingPlaceholder(chatPreparing, draft.length === 0);
  const normalPlaceholder = planFeedback.pending
    ? 'Give feedback on this plan'
    : liveRun
      ? 'Steer the agent'
      : 'Ask Mastra Code';
  const placeholder = initializingPlaceholder ?? normalPlaceholder;
  const sendWaitsOnConnection = connectionLost && !onUserDraft && blocked;
  const sendTitle = sendWaitsOnConnection
    ? 'You can send once reconnected'
    : chatPreparing
      ? 'Initializing session…'
      : startingDraft
        ? 'Starting session…'
        : dictating
          ? 'Finish dictation to send'
          : undefined;

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
    if (onUserDraft && modelLoading && !isSlashCommand(text)) {
      setHeldDraftText(text);
      return;
    }
    const runsCommand = !planFeedback.pending && isSlashCommand(text);
    const sentAnnotations = runsCommand ? [] : takeAnnotations();
    updateDraft('');
    void handleInput(text, sentAnnotations).catch(error => {
      restoreAnnotations(sentAnnotations);
      if (planFeedback.pending) updateDraft(text);
      clearPending();
      pushNotice(error instanceof Error ? error.message : 'The message could not be sent.', 'error');
    });
  };

  const sendHeldDraft = useEffectEvent((text: string) => {
    setHeldDraftText(undefined);
    if (modelError) pushNotice(modelError.message, 'error');
    else submitInput(text);
  });
  useEffect(() => {
    if (heldDraftText !== undefined && !modelLoading) sendHeldDraft(heldDraftText);
  }, [heldDraftText, modelLoading]);

  const onSubmit = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (sendDisabled || !hasSubmittableDraft) return;
    submitInput(shownText.trim());
  };

  const commandMenu = useComposerCommands({
    commands,
    value: shownText,
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

  async function handleInput(text: string, sentAnnotations: readonly ChatAnnotation[]) {
    const message = formatAnnotatedMessage(text, sentAnnotations);
    if (planFeedback.pending) {
      await planFeedback.submitFeedback(message);
      setImages([]);
      return;
    }
    if (onUserDraft && isSlashCommand(text)) {
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
        await withPendingImages(async files => createSessionFromDraft({ prompt: message, files }));
      } catch (error) {
        updateDraft(text);
        throw error;
      }
      return;
    }
    if (preparingThreadId && isSlashCommand(text) && commandRequiresReadySession(commands, text)) {
      updateDraft(text);
      pushNotice('Commands run once the session is ready.');
      return;
    }
    if (await runComposerCommand(text)) return;
    if (liveRun) {
      await steer(message);
      return;
    }
    await withPendingImages(files => send(message, files));
  }

  return (
    <>
      <StatusLine>{statusLead}</StatusLine>
      <ComposerRoot onSubmit={onSubmit} onDrop={onDrop} onDragOver={e => e.preventDefault()}>
        <ComposerHeader placement="overlay" open={connectionNotice !== undefined}>
          {connectionNotice && <ComposerConnectionNotice notice={connectionNotice} />}
        </ComposerHeader>
        <ComposerRing busy={(busy || chatPreparing || startingDraft) && !connectionLost}>
          <ComposerBox>
            <ComposerSuggestions {...commandMenu.suggestionsProps} />
            <ComposerAnnotations />
            <ComposerImageAttachments images={images} onRemove={removeImage} />
            <ComposerInput
              {...commandMenu.inputProps}
              ref={inputRef}
              onKeyDown={onComposerKeyDown}
              onPaste={onPaste}
              placeholder={placeholder}
              disabled={textareaDisabled}
              readOnly={preview !== undefined}
              style={preview ? { height: preview.height } : undefined}
              variant={variant}
              aria-label="Message"
            />
            <ComposerActions>
              <ComposerActionsStart>
                <ComposerAttachMenu
                  onFiles={addFiles}
                  accept="image/*"
                  disabled={attachDisabled}
                  label="Attach images"
                />
              </ComposerActionsStart>
              <ComposerActionsEnd role="group" aria-label="Composer actions">
                <ModelPicker />
                {factoryId && (
                  <ComposerVoiceButton
                    factoryId={factoryId}
                    disabled={textareaDisabled || preview !== undefined}
                    dictation={dictation}
                  />
                )}
                <ComposerPrimaryAction
                  showAbort={liveRun && !hasSubmittableDraft}
                  sendDisabled={sendDisabled || !hasSubmittableDraft}
                  sendTitle={sendTitle}
                  onAbort={() => void abortMutation.mutateAsync()}
                />
              </ComposerActionsEnd>
            </ComposerActions>
          </ComposerBox>
        </ComposerRing>
      </ComposerRoot>
    </>
  );
}
