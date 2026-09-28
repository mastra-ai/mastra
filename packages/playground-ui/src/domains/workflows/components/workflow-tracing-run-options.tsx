import { jsonLanguage } from '@codemirror/lang-json';
import CodeMirror from '@uiw/react-codemirror';
import { Check, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTracingSettings } from '@/domains/observability/context/tracing-settings-context';
import { RequestContextLabel } from '@/domains/request-context/components/request-context-label';
import { Button } from '@/ds/components/Button';
import { useCodemirrorTheme } from '@/ds/components/CodeEditor';
import { cn } from '@/utils/cn';
import { toast } from '@/utils/toast';

type TracingOptions = NonNullable<ReturnType<typeof useTracingSettings>['settings']>['tracingOptions'];

const stringifyTracingOptions = (tracingOptions: TracingOptions) => {
  try {
    return JSON.stringify(tracingOptions ?? {}, null, 2);
  } catch {
    return '{}';
  }
};

export interface WorkflowTracingRunOptionsProps {
  editorClassName?: string;
  onSaved?: () => void;
}

/**
 * Workflow-specific tracing run options editor.
 *
 * Unlike the shared inline `TracingRunOptions`, this is rendered inside a dialog and
 * persists only on an explicit "Save" click (mirroring the Request Context dialog). The
 * editor owns its raw text locally, so typing/backspacing never writes to tracing settings
 * mid-edit — which previously caused per-keystroke re-renders that remounted and closed the
 * dialog.
 */
export const WorkflowTracingRunOptions = ({
  editorClassName = 'h-[260px]',
  onSaved,
}: WorkflowTracingRunOptionsProps) => {
  const theme = useCodemirrorTheme();
  const { settings, setSettings } = useTracingSettings();

  const tracingOptions = settings?.tracingOptions;
  const serializedTracingOptions = useMemo(() => stringifyTracingOptions(tracingOptions), [tracingOptions]);
  const [text, setText] = useState(() => serializedTracingOptions);
  const userEditedRef = useRef(false);

  // Seed the editor from externally-loaded settings (the provider hydrates from localStorage
  // asynchronously) until the user starts editing. Once edited, local text owns the value.
  useEffect(() => {
    if (!userEditedRef.current) {
      setText(serializedTracingOptions);
    }
  }, [serializedTracingOptions]);

  const handleChange = (value: string) => {
    userEditedRef.current = true;
    setText(value);
  };

  const isDirty = text !== serializedTracingOptions;

  const handleRevert = () => {
    userEditedRef.current = false;
    setText(serializedTracingOptions);
  };

  const handleSave = () => {
    if (!text) {
      setSettings({ ...settings, tracingOptions: undefined });
      onSaved?.();
      return;
    }

    try {
      const parsed = JSON.parse(text);
      if (typeof parsed === 'object' && parsed !== null) {
        setSettings({ ...settings, tracingOptions: parsed });
      }
    } catch {
      // Invalid JSON is not persisted; the editor keeps the raw text so the user can fix it.
      toast.error('Invalid tracing options JSON');
      return;
    }

    onSaved?.();
  };

  return (
    <div>
      <div className="pb-2">
        <RequestContextLabel as="label">Tracing Options (JSON)</RequestContextLabel>
      </div>

      <CodeMirror
        value={text}
        onChange={handleChange}
        theme={theme}
        extensions={[jsonLanguage]}
        className={cn(
          editorClassName,
          'overflow-hidden overflow-y-scroll rounded-lg border border-border bg-background p-3',
          '[&_.cm-editor]:!bg-background [&_.cm-gutters]:!bg-background',
        )}
      />

      <div className="flex justify-end gap-2 pt-2">
        {isDirty && (
          <Button
            variant="default"
            size="icon-md"
            type="button"
            tooltip="Revert tracing options changes"
            onClick={handleRevert}
          >
            <X />
          </Button>
        )}
        <Button icon={<Check />} type="button" onClick={handleSave}>
          Save
        </Button>
      </div>
    </div>
  );
};
