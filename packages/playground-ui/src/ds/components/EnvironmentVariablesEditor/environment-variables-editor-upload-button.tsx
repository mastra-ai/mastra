import { UploadIcon } from 'lucide-react';

import { Button } from '../Button';
import { useEnvironmentVariablesEditorContext } from './environment-variables-editor-context';
import type { EnvironmentVariablesEditorUploadButtonProps } from './environment-variables-editor.types';

export function EnvironmentVariablesEditorUploadButton({
  children = 'Import .env',
  inputLabel = 'Import .env file',
  disabled,
  onClick,
  type = 'button',
  variant = 'ghost',
  size = 'sm',
  ...props
}: EnvironmentVariablesEditorUploadButtonProps) {
  const {
    editor,
    disabled: contextDisabled,
    readOnly,
  } = useEnvironmentVariablesEditorContext('EnvironmentVariablesEditor.UploadButton');
  const isDisabled = contextDisabled || disabled;

  if (readOnly) return null;

  return (
    <>
      <input
        ref={editor.fileInputRef}
        type="file"
        accept=".env,text/plain"
        aria-label={inputLabel}
        className="hidden"
        disabled={isDisabled}
        onChange={editor.handleFileUpload}
      />
      <Button
        type={type}
        variant={variant}
        size={size}
        disabled={isDisabled}
        onClick={event => {
          onClick?.(event);
          if (!event.defaultPrevented) {
            editor.fileInputRef.current?.click();
          }
        }}
        icon={<UploadIcon />}
        {...props}
      >
        {children}
      </Button>
    </>
  );
}
