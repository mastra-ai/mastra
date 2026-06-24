import { jsonLanguage } from '@codemirror/lang-json';
import { Txt, cn } from '@mastra/playground-ui';
import { useCodemirrorTheme } from '@mastra/playground-ui/components/CodeEditor';
import CodeMirror from '@uiw/react-codemirror';
import { useTracingSettings } from '@/domains/observability/context/tracing-settings-context';
import { WorkflowRunOptions } from '@/domains/workflows/workflow/workflow-run-options';

interface TracingRunOptionsProps {
  className?: string;
  editorClassName?: string;
  hideTitle?: boolean;
  showEditorHeader?: boolean;
}

export const TracingRunOptions = ({
  className,
  editorClassName = 'h-[400px]',
  hideTitle = false,
  showEditorHeader = false,
}: TracingRunOptionsProps = {}) => {
  const theme = useCodemirrorTheme();
  const { settings, setSettings, entityType } = useTracingSettings();

  const handleChange = (value: string) => {
    if (!value) {
      return setSettings({ ...settings, tracingOptions: undefined });
    }

    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === 'object' && parsed !== null) {
        setSettings({ ...settings, tracingOptions: parsed });
      }
    } catch {
      // silent fail on invalid JSON parsing. We don't want to store invalid JSON in the settings.
    }
  };

  let strValue = '{}';
  try {
    strValue = JSON.stringify(settings?.tracingOptions, null, 2);
  } catch {}

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
          <Txt as="span" variant="ui-xs" className="text-neutral3">
            Auto-applied on valid JSON
          </Txt>
        </div>
      )}

      <CodeMirror
        value={strValue}
        onChange={handleChange}
        theme={theme}
        extensions={[jsonLanguage]}
        className={cn(
          editorClassName,
          'overflow-y-scroll rounded-lg border border-border1 bg-surface2 overflow-hidden p-3',
          '[&_.cm-editor]:!bg-surface2 [&_.cm-gutters]:!bg-surface2',
        )}
      />

      {entityType === 'workflow' && <WorkflowRunOptions />}
    </div>
  );
};
