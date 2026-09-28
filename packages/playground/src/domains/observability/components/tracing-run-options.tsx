import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import { Field, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { useTracingSettings } from '@mastra/playground-ui/domains/observability/context/tracing-settings-context';
import { WorkflowRunOptions } from '@mastra/playground-ui/domains/workflows/workflow/workflow-run-options';
import { cn } from '@mastra/playground-ui/utils/cn';

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
        <Txt as="h3" variant="body" tone="muted">
          Tracing Options
        </Txt>
      )}

      <Field className="block">
        {showEditorHeader && (
          <div className="flex items-center justify-between pb-2">
            <FieldLabel size="bigger">Tracing Options (JSON)</FieldLabel>
            <Txt as="span" variant="meta" tone="muted">
              Auto-applied on valid JSON
            </Txt>
          </div>
        )}

        <CodeEditor
          value={strValue}
          onChange={handleChange}
          language="json"
          showCopyButton={false}
          className={editorClassName}
        />
      </Field>

      {entityType === 'workflow' && <WorkflowRunOptions />}
    </div>
  );
};
