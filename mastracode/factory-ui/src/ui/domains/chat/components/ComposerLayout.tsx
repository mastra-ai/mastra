import {
  ComposerActions,
  ComposerActionsEnd,
  ComposerActionsStart,
  ComposerAttachMenu,
  ComposerBox,
  ComposerInput,
} from '@mastra/playground-ui/components/Composer';
import type { ComposerInputProps } from '@mastra/playground-ui/components/Composer';
import type { ReactNode } from 'react';

export function ComposerLayout({
  top,
  input,
  attach,
  actions,
}: {
  top?: ReactNode;
  input: ReactNode;
  attach: ReactNode;
  actions: ReactNode;
}) {
  return (
    <ComposerBox>
      {top}
      {input}
      <ComposerActions>
        <ComposerActionsStart>{attach}</ComposerActionsStart>
        <ComposerActionsEnd role="group" aria-label="Composer actions">
          {actions}
        </ComposerActionsEnd>
      </ComposerActions>
    </ComposerBox>
  );
}

export function MessageInput({ placeholder = 'Ask Mastra Code', ...props }: ComposerInputProps) {
  return <ComposerInput {...props} placeholder={placeholder} aria-label="Message" />;
}

export function AttachImagesMenu({ onFiles, disabled }: { onFiles?: (files: File[]) => void; disabled?: boolean }) {
  return (
    <ComposerAttachMenu
      onFiles={files => onFiles?.(files)}
      accept="image/*"
      disabled={disabled}
      label="Attach images"
    />
  );
}
