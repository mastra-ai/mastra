import CodeMirror from '@uiw/react-codemirror';
import { jsonLanguage } from '@codemirror/lang-json';
import { useCodemirrorTheme } from '@/ds/components/CodeEditor';
import { useTracingSettings } from '@/domains/observability/context/tracing-settings-context';
import { Txt } from '@/ds/components/Txt';
import { WorkflowRunOptions } from '@/domains/workflows/workflow/workflow-run-options';

export const TracingRunOptions = () => {
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
    <div className="space-y-2 px-5 py-2">
      <Txt as="h3" variant="ui-md" className="text-icon3">
        Tracing Options
      </Txt>

      <CodeMirror
        value={strValue}
        onChange={handleChange}
        theme={theme}
        extensions={[jsonLanguage]}
        className="h-[400px] overflow-y-scroll bg-surface3 rounded-lg overflow-hidden p-3"
      />

      {entityType === 'workflow' && <WorkflowRunOptions />}
    </div>
  );
};
