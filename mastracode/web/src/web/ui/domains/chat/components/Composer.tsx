import type { AgentControllerMessage } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { Textarea } from '@mastra/playground-ui/components/Textarea';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowUp, ImagePlus, Square, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, ClipboardEvent, DragEvent, KeyboardEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { queryKeys } from '../../../../../shared/api/keys';
import { useChatCommands } from '../context/ChatCommandsProvider';
import { useChatConnection } from '../context/useChatConnection';
import { useChatSessionContext } from '../context/useChatSessionContext';
import { useChatTranscript } from '../context/useChatTranscript';
import {
  useAbortAgentControllerMutation,
  useSendAgentControllerMessageMutation,
  useSteerAgentControllerMutation,
} from '../hooks/useAgentControllerRunMutations';
import { useCreateAgentControllerThreadMutation } from '../hooks/useAgentControllerThreadMutations';
import { matchCommands } from '../services/commands';
import { AGENT_CONTROLLER_ID } from '../services/constants';

type ComposerVariant = 'inline' | 'textarea';

const composerVariantClass: Record<ComposerVariant, string> = {
  inline: 'field-sizing-content max-h-52 min-h-10 resize-none',
  textarea: 'field-sizing-content max-h-64 min-h-28 resize-none',
};

type ComposerProps = {
  variant?: ComposerVariant;
};

interface PendingImage {
  id: string;
  /** Raw base64 payload (no `data:` prefix). */
  data: string;
  mediaType: string;
  filename?: string;
}

let pendingImageSeq = 0;

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
  const { resourceId, sessionEnabled, projectPath, baseUrl } = useChatSessionContext();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { status } = useChatConnection();
  const { busy, localUser, reset } = useChatTranscript();
  const { composerCommandName, clearComposerCommand, runComposerCommand } = useChatCommands();

  const hookArgs = {
    agentControllerId: AGENT_CONTROLLER_ID,
    resourceId,
    projectPath,
    baseUrl,
    enabled: sessionEnabled,
  };
  const createThreadMutation = useCreateAgentControllerThreadMutation(hookArgs);
  const sendMutation = useSendAgentControllerMessageMutation(hookArgs);
  const steerMutation = useSteerAgentControllerMutation(hookArgs);
  const abortMutation = useAbortAgentControllerMutation(hookArgs);

  const [draft, setDraft] = useState('');
  const [images, setImages] = useState<PendingImage[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const appliedCommandNameRef = useRef<string | null>(null);
  const suggestions = matchCommands(draft);
  const showSuggestions = suggestions.length > 0;
  const [activeSuggestion, setActiveSuggestion] = useState(0);

  const updateDraft = (next: string) => {
    setDraft(next);
    setActiveSuggestion(0);
  };

  const applyCommandDraft = (name: string) => {
    updateDraft(`/${name} `);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const applyCommand = (name: string) => {
    applyCommandDraft(name);
    clearComposerCommand();
  };

  useEffect(() => {
    if (!composerCommandName) {
      appliedCommandNameRef.current = null;
      return;
    }
    if (appliedCommandNameRef.current === composerCommandName) return;
    appliedCommandNameRef.current = composerCommandName;
    applyCommandDraft(composerCommandName);
    clearComposerCommand();
  }, [composerCommandName, clearComposerCommand]);

  const createThread = async () => {
    const thread = await createThreadMutation.mutateAsync(undefined);
    reset(thread.id);
    return thread.id;
  };

  const seedThreadMessageCache = (threadId: string, text: string, files: PendingImage[]) => {
    const message: AgentControllerMessage = {
      id: `local-${Date.now()}`,
      role: 'user',
      content: [
        { type: 'text', text },
        ...files.map(f => ({ type: 'image' as const, data: f.data, mimeType: f.mediaType })),
      ],
    };
    queryClient.setQueryData(queryKeys.agentControllerThreadMessages(AGENT_CONTROLLER_ID, resourceId, threadId), [
      message,
    ]);
  };

  const addImageFiles = async (fileList: Iterable<File>) => {
    const imageFiles = Array.from(fileList).filter(file => file.type.startsWith('image/'));
    if (imageFiles.length === 0) return;
    const additions = await Promise.all(
      imageFiles.map(
        async (file): Promise<PendingImage> => ({
          id: `pending-image-${pendingImageSeq++}`,
          data: await readFileAsBase64(file),
          mediaType: file.type,
          filename: file.name || undefined,
        }),
      ),
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
    const files = Array.from(e.dataTransfer?.files ?? []).filter(file => file.type.startsWith('image/'));
    if (files.length === 0) return;
    e.preventDefault();
    void addImageFiles(files);
  };

  const onFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    void addImageFiles(e.target.files ?? []);
    e.target.value = '';
  };

  const send = async (text: string, files: PendingImage[]) => {
    if (!text.trim() && files.length === 0) return;
    const outgoing = files.map(f => ({ data: f.data, mediaType: f.mediaType, filename: f.filename }));
    if (location.pathname === '/new') {
      const threadId = await createThread();
      localUser(text, false, outgoing);
      await sendMutation.mutateAsync({ text, files: outgoing });
      seedThreadMessageCache(threadId, text, files);
      void navigate(`/threads/${threadId}`, { replace: true });
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
    await send(text, files);
  }

  const disabled = status !== 'ready';

  return (
    <form
      onSubmit={onSubmit}
      onDrop={onDrop}
      onDragOver={e => e.preventDefault()}
      className="relative flex w-full flex-col gap-2"
    >
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map(img => (
            <div key={img.id} className="group relative">
              <img
                src={`data:${img.mediaType};base64,${img.data}`}
                alt={img.filename ?? 'Attached image'}
                className="h-14 w-14 rounded-md border border-border1 object-cover"
              />
              <button
                type="button"
                onClick={() => removeImage(img.id)}
                aria-label="Remove image"
                className="absolute -right-1.5 -top-1.5 rounded-full border border-border1 bg-surface4 p-0.5 text-icon3 hover:text-icon6"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}
      <Textarea
        ref={inputRef}
        value={draft}
        onChange={e => updateDraft(e.target.value)}
        onKeyDown={onComposerKeyDown}
        onPaste={onPaste}
        placeholder={busy ? 'Steer the agent…' : 'Ask Mastra Code…'}
        disabled={disabled}
        className={composerVariantClass[variant]}
        aria-label="Message"
      />
      {showSuggestions && (
        <div className="absolute bottom-full mb-2 w-full rounded-md border border-border1 bg-surface3 p-1 shadow-lg">
          {suggestions.map((cmd, index) => (
            <button
              key={cmd.name}
              type="button"
              className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-ui-sm ${index === activeSuggestion ? 'bg-surface4 text-icon6' : 'text-icon3'}`}
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
      <div className="absolute bottom-2 right-2 flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
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
          size="icon-sm"
          disabled={disabled || (!draft.trim() && images.length === 0)}
          aria-label="Send message"
        >
          <ArrowUp size={16} />
        </Button>
      </div>
    </form>
  );
}
