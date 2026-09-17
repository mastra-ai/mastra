import { FileJson, FormInput } from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';

import { RequestContextJsonEditor } from './request-context-json-editor';
import { RequestContextSchemaForm } from './request-context-schema-form';
import { Icon } from '@/ds/icons/Icon';
import { cn } from '@/lib/utils';

type InputMode = 'form' | 'json';

function ModeSwitcher({ mode, onModeChange }: { mode: InputMode; onModeChange: (mode: InputMode) => void }) {
  return (
    <div className="border-border1 flex items-center gap-1 rounded-md border p-0.5">
      <button
        type="button"
        aria-pressed={mode === 'form'}
        onClick={() => onModeChange('form')}
        className={cn(
          'flex items-center gap-1.5 rounded px-2 py-1 text-ui-sm transition-colors',
          mode === 'form' ? 'bg-surface3 text-neutral5' : 'text-neutral3 hover:text-neutral5',
        )}
      >
        <Icon size="sm">
          <FormInput />
        </Icon>
        Form
      </button>
      <button
        type="button"
        aria-pressed={mode === 'json'}
        onClick={() => onModeChange('json')}
        className={cn(
          'flex items-center gap-1.5 rounded px-2 py-1 text-ui-sm transition-colors',
          mode === 'json' ? 'bg-surface3 text-neutral5' : 'text-neutral3 hover:text-neutral5',
        )}
      >
        <Icon size="sm">
          <FileJson />
        </Icon>
        JSON
      </button>
    </div>
  );
}

export interface RequestContextEditorProps {
  /** Serialized JSON schema; when provided, a schema-driven form is rendered in "Form" mode. */
  requestContextSchema?: string;
  /** Custom form rendered in "Form" mode. Takes precedence over `requestContextSchema`. */
  formSlot?: ReactNode;
  labelTooltip?: string;
  jsonEditorClassName?: string;
}

/** Per-entity request context editor: JSON editor, with a form/JSON switch when a schema or form is provided. */
export function RequestContextEditor({
  requestContextSchema,
  formSlot,
  labelTooltip,
  jsonEditorClassName,
}: RequestContextEditorProps) {
  const [mode, setMode] = useState<InputMode>('form');

  const jsonEditor = <RequestContextJsonEditor editorClassName={jsonEditorClassName} labelTooltip={labelTooltip} />;

  const form =
    formSlot ??
    (requestContextSchema ? (
      <RequestContextSchemaForm requestContextSchema={requestContextSchema} labelTooltip={labelTooltip} />
    ) : null);

  if (!form) {
    return jsonEditor;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <ModeSwitcher mode={mode} onModeChange={setMode} />
      </div>

      {mode === 'form' ? form : jsonEditor}
    </div>
  );
}
