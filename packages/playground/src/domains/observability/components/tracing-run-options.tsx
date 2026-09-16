import { jsonLanguage } from '@codemirror/lang-json';
import { useCodemirrorTheme } from '@mastra/playground-ui/components/CodeEditor';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useRunOptionsDraft } from '@mastra/playground-ui/domains/run-options';
import { cn } from '@mastra/playground-ui/utils/cn';
import { toast } from '@mastra/playground-ui/utils/toast';
import CodeMirror from '@uiw/react-codemirror';
import { useState } from 'react';
import { useTracingSettings } from '@/domains/observability/context/tracing-settings-context';

type TracingOptions = NonNullable<ReturnType<typeof useTracingSettings>['settings']>['tracingOptions'];

const stringifyTracingOptions = (tracingOptions: TracingOptions) => {
  try {
    return JSON.stringify(tracingOptions ?? {}, null, 2);
  } catch {
    return '{}';
  }
};

interface TracingRunOptionsProps {
  className?: string;
  editorClassName?: string;
  hideTitle?: boolean;
  showEditorHeader?: boolean;
}

/**
 * Tracing options JSON editor, persisted by the run options "Save" button.
 *
 * The editor owns its draft text locally so typing never writes to tracing settings
 * mid-edit (per-keystroke settings writes re-render the owner and used to close popovers).
 * Until the user edits, the draft mirrors the persisted settings (which the provider hydrates
 * from localStorage asynchronously). Must be rendered inside `RunOptionsContent`.
 */
export const TracingRunOptions = ({
  className,
  editorClassName = 'h-[400px]',
  hideTitle = false,
  showEditorHeader = false,
}: TracingRunOptionsProps = {}) => {
  const theme = useCodemirrorTheme();
  const { settings, setSettings } = useTracingSettings();
  const [draft, setDraft] = useState<string>();

  const persistedText = stringifyTracingOptions(settings?.tracingOptions);
  const text = draft ?? persistedText;
  const isDirty = draft !== undefined && draft !== persistedText;

  useRunOptionsDraft({
    isDirty,
    save: () => {
      if (!text.trim()) {
        setSettings({ ...settings, tracingOptions: undefined });
        setDraft(undefined);
        return true;
      }

      try {
        const parsed = JSON.parse(text);
        if (typeof parsed !== 'object' || parsed === null) throw new Error('not an object');
        setSettings({ ...settings, tracingOptions: parsed });
      } catch {
        // Invalid JSON is not persisted; the editor keeps the raw text so the user can fix it.
        toast.error('Invalid tracing options JSON');
        return false;
      }

      setDraft(undefined);
      return true;
    },
  });

  return (
    <div className={cn('px-5 py-2', !hideTitle && 'space-y-2', className)}>
      {!hideTitle && (
        <Txt as="h3" variant="ui-md" className="text-neutral3">
          Tracing Options
        </Txt>
      )}

      {showEditorHeader && (
        <div className="flex items-center justify-between pb-2">
          <Txt as="label" variant="ui-md" className="text-neutral3">
            Tracing Options (JSON)
          </Txt>
        </div>
      )}

      <CodeMirror
        value={text}
        onChange={setDraft}
        theme={theme}
        extensions={[jsonLanguage]}
        className={cn(
          editorClassName,
          'overflow-y-scroll rounded-lg border border-border1 bg-surface2 overflow-hidden p-3',
          '[&_.cm-editor]:!bg-surface2 [&_.cm-gutters]:!bg-surface2',
        )}
      />
    </div>
  );
};
