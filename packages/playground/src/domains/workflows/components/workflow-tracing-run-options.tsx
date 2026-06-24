import { jsonLanguage } from '@codemirror/lang-json';
import { Button, cn, Txt } from '@mastra/playground-ui';
import { useCodemirrorTheme } from '@mastra/playground-ui/components/CodeEditor';
import CodeMirror from '@uiw/react-codemirror';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTracingSettings } from '@/domains/observability/context/tracing-settings-context';

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
  editorClassName = 'h-[240px] max-h-[40vh]',
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
      return;
    }

    onSaved?.();
  };

  return (
    <div className="space-y-2 px-5 py-2">
      <Txt as="h3" variant="ui-md" className="text-neutral3">
        Tracing Options
      </Txt>

      <CodeMirror
        value={text}
        onChange={handleChange}
        theme={theme}
        extensions={[jsonLanguage]}
        className={cn('overflow-y-scroll bg-surface3 rounded-lg overflow-hidden p-3', editorClassName)}
      />

      <div className="flex items-center justify-end">
        <Button type="button" onClick={handleSave}>
          Save
        </Button>
      </div>
    </div>
  );
};
