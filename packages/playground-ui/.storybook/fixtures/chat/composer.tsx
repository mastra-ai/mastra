import { ArrowUp, ImagePlus, Paperclip, Square } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { reviewCommands } from './commands';
import type { ChatFile, ChatPresentation, Phase } from './data';
import { ComposerAttachment } from '@/domains/chat/attachments/composer-attachment';
import { ComposerAttachmentList } from '@/domains/chat/attachments/composer-attachment-list';
import { UserFilePartRenderer } from '@/domains/chat/messages/renderers/user-file-part-renderer';
import { Button } from '@/ds/components/Button';
import type { ComposerTone } from '@/ds/components/Composer';
import {
  Composer,
  ComposerActions,
  ComposerBox,
  ComposerInput,
  ComposerRing,
  ComposerSuggestions,
  useComposerCommands,
} from '@/ds/components/Composer';
import { Notice } from '@/ds/components/Notice';
import { Txt } from '@/ds/components/Txt';

const composerStatus: Record<Phase, string> = {
  complete: 'Ready',
  streaming: 'Responding…',
  stopped: 'Response stopped',
  question: 'Waiting for your answer',
  approval: 'Waiting for approval',
  declined: 'Ready',
  error: 'Reply failed',
  'tool-error': 'Tool failed',
};

interface DraftFile {
  id: string;
  filename: string;
  part?: ChatFile;
  error?: string;
}

interface ConversationComposerProps {
  phase?: Phase;
  presentation: ChatPresentation;
  tone: ComposerTone;
  busy: boolean;
  onSend: (text: string, files: ChatFile[]) => void;
  onStop: () => void;
}

export function ConversationComposer({ phase, presentation, tone, busy, onSend, onStop }: ConversationComposerProps) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState<DraftFile[]>([]);
  const [sentCount, setSentCount] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const messageInput = useRef<HTMLTextAreaElement>(null);
  const readers = useRef(new Map<string, FileReader>());
  const reading = files.some(file => !file.part && !file.error);
  const readyFiles = files.flatMap(file => (file.part ? [file.part] : []));
  const canSend = !busy && files.every(file => file.part) && (text.trim().length > 0 || readyFiles.length > 0);
  const commands = useComposerCommands({
    commands: reviewCommands,
    value: text,
    onValueChange: setText,
    onSubmit: submitMessage,
    inputRef: messageInput,
    enabled: !busy,
  });

  useEffect(() => {
    const pending = readers.current;
    return () => {
      pending.forEach(reader => reader.abort());
      pending.clear();
    };
  }, []);

  function addFiles(selected: FileList | null) {
    for (const file of Array.from(selected ?? [])) {
      const id = crypto.randomUUID();
      const reader = new FileReader();
      readers.current.set(id, reader);
      setFiles(current => [...current, { id, filename: file.name }]);
      reader.onload = () => {
        readers.current.delete(id);
        const data = reader.result;
        if (typeof data !== 'string') return;
        const part: ChatFile = {
          type: 'file',
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          data,
        };
        setFiles(current => current.map(item => (item.id === id ? { ...item, part } : item)));
      };
      reader.onerror = () => {
        readers.current.delete(id);
        setFiles(current =>
          current.map(item =>
            item.id === id ? { ...item, error: 'Could not read this file. Remove it and try again.' } : item,
          ),
        );
      };
      reader.readAsDataURL(file);
    }
  }

  function removeFile(id: string) {
    readers.current.get(id)?.abort();
    readers.current.delete(id);
    setFiles(current => current.filter(file => file.id !== id));
  }

  function submitMessage(message = text) {
    if (!canSend) return;
    onSend(message, readyFiles);
    setText('');
    setFiles([]);
    setSentCount(current => current + 1);
    messageInput.current?.focus();
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.defaultPrevented) return;
    const composing = event.nativeEvent.isComposing || event.keyCode === 229;
    const shouldSend = event.key === 'Enter' && !event.shiftKey && !composing;
    if (shouldSend) {
      event.preventDefault();
      submitMessage();
    }
  }

  return (
    <Composer
      aria-label="Chat composer"
      onSubmit={event => {
        event.preventDefault();
        submitMessage();
      }}
    >
      <input
        ref={fileInput}
        type="file"
        multiple
        accept={presentation === 'factory' ? 'image/*' : undefined}
        hidden
        aria-label="Attach files"
        onChange={event => {
          addFiles(event.target.files);
          event.target.value = '';
        }}
      />
      <ComposerRing busy={phase === 'streaming'} tone={tone}>
        <ComposerBox sendingPulseKey={sentCount}>
          <ComposerSuggestions {...commands.suggestionsProps} />
          {files.length > 0 && (
            <ComposerAttachmentList>
              {files.map(file => (
                <ComposerAttachment
                  key={file.id}
                  name={file.filename}
                  variant={file.part?.mimeType.startsWith('image/') ? 'thumbnail' : 'inline'}
                  onRemove={() => removeFile(file.id)}
                >
                  {file.part ? (
                    <UserFilePartRenderer part={file.part} />
                  ) : (
                    <Txt variant="ui-sm">
                      {file.filename}
                      {file.error ? '' : ' — Reading…'}
                    </Txt>
                  )}
                  {file.error && (
                    <Notice variant="destructive" title={file.filename}>
                      <Notice.Message>{file.error}</Notice.Message>
                    </Notice>
                  )}
                </ComposerAttachment>
              ))}
            </ComposerAttachmentList>
          )}
          <ComposerInput
            {...commands.inputProps}
            ref={messageInput}
            aria-label="Message"
            placeholder="Ask a follow-up, or / for commands…"
            onKeyDown={handleComposerKeyDown}
          />
          <ComposerActions>
            <Button
              type="button"
              size="icon-sm"
              variant={presentation === 'factory' ? 'outline' : 'ghost'}
              aria-label="Add attachments"
              tooltip="Add attachments"
              onClick={() => fileInput.current?.click()}
            >
              {presentation === 'factory' ? <ImagePlus /> : <Paperclip />}
            </Button>
            <Txt variant="ui-xs" role="status" aria-live="polite">
              {reading ? 'Reading attachments…' : composerStatus[phase ?? 'complete']}
            </Txt>
            <div className="ml-auto">
              {phase === 'streaming' ? (
                <Button
                  type="button"
                  size="icon-sm"
                  aria-label="Stop response"
                  onClick={() => {
                    onStop();
                    messageInput.current?.focus();
                  }}
                >
                  <Square />
                </Button>
              ) : (
                <Button type="submit" size="icon-sm" variant="primary" aria-label="Send message" disabled={!canSend}>
                  <ArrowUp />
                </Button>
              )}
            </div>
          </ComposerActions>
        </ComposerBox>
      </ComposerRing>
    </Composer>
  );
}
