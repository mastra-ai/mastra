import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { Button } from '@mastra/playground-ui/components/Button';
import { ButtonsGroup } from '@mastra/playground-ui/components/ButtonsGroup';
import {
  Composer as ComposerRoot,
  ComposerActions,
  ComposerAttachments,
  ComposerBox,
  ComposerInput,
} from '@mastra/playground-ui/components/Composer';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowUp, ImagePlus, Square, X } from 'lucide-react';
import { useRef, useState } from 'react';
import type { ChangeEvent, ClipboardEvent, DragEvent, KeyboardEvent } from 'react';
import { useMatch, useNavigate, useParams } from 'react-router';

import { INITIAL_THREAD_MESSAGE_LIMIT, queryKeys } from '../../../../../shared/api/keys';
import { useChatCommands } from '../context/ChatCommandsProvider';
import type { PendingComposerImage } from '../context/ChatCommandsProvider';
import { useChatConnection } from '../context/useChatConnection';
import { useChatModes } from '../context/useChatModes';
import { useChatSessionContext } from '../context/useChatSessionContext';
import { useChatTranscript } from '../context/useChatTranscript';
import {
  useAbortAgentControllerMutation,
  useSendAgentControllerMessageMutation,
  useSteerAgentControllerMutation,
} from '../../../../../shared/hooks/useAgentControllerRunMutations';
import { useCreateAgentControllerThreadMutation } from '../../../../../shared/hooks/useAgentControllerThreadMutations';
import { matchCommands } from '../services/commands';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { getModeColorClass } from './mode-colors';
import { StatusLine } from './StatusLine';
import { useComposerSpotlight } from './useComposerSpotlight';

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

let pendingImageSeq = 0;

/** Per-image cap; base64 adds ~33% and attachments travel in a JSON POST body. */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
/** Aggregate cap across all pending images on a single message. */
const MAX_TOTAL_IMAGE_BYTES = 20 * 1024 * 1024;

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export function Composer({ variant = 'inline' }: ComposerProps) {
  const { kind, resourceId, sessionEnabled, baseUrl } = useChatSessionContext();
  const { factoryId } = useParams<{ factoryId: string }>();
  const onDraftComposer = useMatch('/factories/:factoryId/new') !== null;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { status } = useChatConnection();
  const { busy, localUser, reset } = useChatTranscript();
  const { modes, activeModeId, setMode } = useChatModes();
  const {
    composerDraft: draft,
    composerInputRef: inputRef,
    pendingImages: images,
    setComposerDraft,
    setPendingImages: setImages,
    runComposerCommand,
  } = useChatCommands();
  const modeColorClass = getModeColorClass(activeModeId ?? modes[0]?.id);

  const hookArgs = {
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    baseUrl,
    enabled: sessionEnabled,
  };
  const createThreadMutation = useCreateAgentControllerThreadMutation(hookArgs);
  const sendMutation = useSendAgentControllerMessageMutation(hookArgs);
  const steerMutation = useSteerAgentControllerMutation(hookArgs);
  const abortMutation = useAbortAgentControllerMutation(hookArgs);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const spotlightRef = useComposerSpotlight();
  const modeSwitchPendingRef = useRef(false);
  const suggestions = matchCommands(draft);
  const showSuggestions = suggestions.length > 0;
  const [activeSuggestion, setActiveSuggestion] = useState(0);

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

  const seedThreadMessageCache = (threadId: string, text: string, files: PendingComposerImage[]) => {
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

  const addImageFiles = async (fileList: Iterable<File>) => {
    const imageFiles = Array.from(fileList).filter(
      file => file.type.startsWith('image/') && file.size <= MAX_IMAGE_BYTES,
    );
    if (imageFiles.length === 0) return;
    // Enforce the aggregate cap across already-pending images plus new selections.
    let budget = MAX_TOTAL_IMAGE_BYTES - images.reduce((sum, img) => sum + Math.floor(img.data.length * 0.75), 0);
    const accepted = imageFiles.filter(file => {
      if (file.size > budget) return false;
      budget -= file.size;
      return true;
    });
    if (accepted.length === 0) return;
    const additions = await Promise.all(
      accepted.map(async (file): Promise<PendingComposerImage> => ({
        id: `pending-image-${pendingImageSeq++}`,
        data: await readFileAsBase64(file),
        mediaType: file.type,
        filename: file.name || undefined,
      })),
    );
    setImages(prev => [...prev, ...additions]);
  };

  const removeImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
  };

  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.clipboardData?.files ?? []).filter(file => file.type.startsWith('image/'));
    if (files.length === 0) return;
    e.preventDefault();
    void addImageFiles(files);
  };

  const onDrop = (e: DragEvent<HTMLFormElement>) => {
    // Always cancel the default action so dropped files never navigate the page away.
    e.preventDefault();
    const files = Array.from(e.dataTransfer?.files ?? []).filter(file => file.type.startsWith('image/'));
    if (files.length === 0) return;
    void addImageFiles(files);
  };

  const onFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    void addImageFiles(e.target.files ?? []);
    e.target.value = '';
  };

  const send = async (text: string, files: PendingComposerImage[]) => {
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
    const text = draft.trim();
    if (!text && images.length === 0) return;
    updateDraft('');
    void handleInput(text);
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
    if (await runComposerCommand(text)) return;
    // Steering is text-only; attached images stay pending until the next send.
    if (busy) {
      await steer(text);
      return;
    }
    const files = images;
    setImages([]);
    try {
      await send(text, files);
    } catch (error) {
      // Requeue the attachments so a failed send can be retried without re-selecting them.
      setImages(current => [...files, ...current]);
      throw error;
    }
  }

  const disabled = status !== 'ready';

  return (
    <ComposerRoot onSubmit={onSubmit} onDrop={onDrop} onDragOver={e => e.preventDefault()}>
      <ComposerBox ref={spotlightRef} className={cn('composer-spotlight', modeColorClass)}>
        <div aria-hidden="true" className="composer-spotlight-surface" />
        {images.length > 0 && (
          <ComposerAttachments className="mx-3 mt-3 flex max-w-none justify-start gap-2 pb-0">
            {images.map(img => (
              <div key={img.id} className="relative">
                <img
                  src={`data:${img.mediaType};base64,${img.data}`}
                  alt={img.filename ?? 'Attached image'}
                  className="h-14 w-14 rounded-md border border-border1 object-cover"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon-xs"
                  className="absolute -right-1 -top-1 rounded-full bg-surface3"
                  onClick={() => removeImage(img.id)}
                  aria-label="Remove image"
                >
                  <X size={10} />
                </Button>
              </div>
            ))}
          </ComposerAttachments>
        )}
        <ComposerInput
          ref={inputRef}
          value={draft}
          onChange={e => updateDraft(e.target.value)}
          onKeyDown={onComposerKeyDown}
          onPaste={onPaste}
          placeholder={busy ? 'Steer the agent…' : 'Ask Mastra Code…'}
          disabled={disabled}
          maxHeight={composerVariantMaxHeight[variant]}
          className={cn(composerVariantClass[variant], 'text-[15px] text-neutral3')}
          aria-label="Message"
          aria-keyshortcuts="Shift+Tab"
        />
        {showSuggestions && (
          <div className="absolute bottom-full mb-2 w-full rounded-md border border-border1 bg-surface3 p-1 shadow-lg">
            {suggestions.map((cmd, index) => (
              <button
                key={cmd.name}
                type="button"
                className={cn(
                  'flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-ui-sm',
                  index === activeSuggestion ? 'bg-surface4 text-icon6' : 'text-icon3',
                )}
                onMouseDown={e => {
                  e.preventDefault();
                  applyCommand(cmd.name);
                }}
              >
                <span>/{cmd.name}</span>
                <span>{cmd.description}</span>
              </button>
            ))}
          </div>
        )}
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
              disabled={disabled}
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach image"
            >
              <ImagePlus size={14} />
            </Button>
            {busy && (
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
              disabled={disabled || (!draft.trim() && images.length === 0)}
              aria-label="Send message"
            >
              <ArrowUp size={16} />
            </Button>
          </ButtonsGroup>
        </ComposerActions>
      </ComposerBox>
    </ComposerRoot>
  );
}
