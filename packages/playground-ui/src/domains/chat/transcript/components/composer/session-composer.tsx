import type { ComponentProps, DragEvent, FormEvent, ReactNode } from 'react';

import { ComposerConnectionNotice } from './connection-notice';
import { ComposerImageAttachments } from './image-attachments';
import { ComposerPrimaryAction } from './primary-action';

import type { PendingImage } from './types';
import {
  Composer,
  ComposerActions,
  ComposerActionsEnd,
  ComposerActionsStart,
  ComposerAttachMenu,
  ComposerBox,
  ComposerHeader,
  ComposerInput,
  ComposerRing,
  ComposerSuggestions,
} from '@/ds/components/Composer';
import type { ComposerInputProps } from '@/ds/components/Composer';

export interface SessionComposerProps {
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onDrop?: (event: DragEvent<HTMLFormElement>) => void;
  connectionNotice?: 'reconnecting' | 'error';
  busy: boolean;
  /** Spread from `useComposerCommands().suggestionsProps`; omit when the host has no commands. */
  suggestions?: ComponentProps<typeof ComposerSuggestions>;
  annotations?: ReactNode;
  images: PendingImage[];
  onRemoveImage: (id: string) => void;
  onAddFiles?: (files: File[]) => void;
  attachDisabled?: boolean;
  input: ComposerInputProps;
  /** Host controls before the send button, e.g. model picker or voice. */
  actions?: ReactNode;
  showAbort: boolean;
  sendDisabled: boolean;
  sendTitle?: string;
  onAbort: () => void;
  /** Row under the composer. */
  status?: ReactNode;
}

/** The session composer's layout, shared by every host; the host owns sending and the draft. */
export function SessionComposer({
  onSubmit,
  onDrop,
  connectionNotice,
  busy,
  suggestions,
  annotations,
  images,
  onRemoveImage,
  onAddFiles,
  attachDisabled,
  input,
  actions,
  showAbort,
  sendDisabled,
  sendTitle,
  onAbort,
  status,
}: SessionComposerProps) {
  return (
    <>
      <Composer onSubmit={onSubmit} onDrop={onDrop} onDragOver={e => e.preventDefault()}>
        <ComposerHeader placement="overlay" open={connectionNotice !== undefined}>
          {connectionNotice && <ComposerConnectionNotice notice={connectionNotice} />}
        </ComposerHeader>
        <ComposerRing busy={busy && !connectionNotice}>
          <ComposerBox>
            {suggestions && <ComposerSuggestions {...suggestions} />}
            {annotations}
            <ComposerImageAttachments images={images} onRemove={onRemoveImage} />
            <ComposerInput aria-label="Message" {...input} />
            <ComposerActions>
              <ComposerActionsStart>
                {onAddFiles && (
                  <ComposerAttachMenu
                    onFiles={onAddFiles}
                    accept="image/*"
                    disabled={attachDisabled}
                    label="Attach images"
                  />
                )}
              </ComposerActionsStart>
              <ComposerActionsEnd role="group" aria-label="Composer actions">
                {actions}
                <ComposerPrimaryAction
                  showAbort={showAbort}
                  sendDisabled={sendDisabled}
                  sendTitle={sendTitle}
                  onAbort={onAbort}
                />
              </ComposerActionsEnd>
            </ComposerActions>
          </ComposerBox>
        </ComposerRing>
      </Composer>
      {status}
    </>
  );
}
