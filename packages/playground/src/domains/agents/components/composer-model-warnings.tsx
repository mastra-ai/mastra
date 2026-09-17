import { ModelPickerWarning, ModelPickerWarnings } from '@mastra/playground-ui/components/ModelPicker';

export function ComposerModelWarnings({
  warning,
  staleModel,
  environmentVariable,
}: {
  warning?: string | string[];
  staleModel?: string;
  environmentVariable?: string;
}) {
  const warningText = Array.isArray(warning) ? warning.filter(Boolean).join(' ') : warning;
  if (!warningText && !staleModel && !environmentVariable) return null;
  return (
    <ModelPickerWarnings>
      {(warningText || staleModel) && (
        <ModelPickerWarning role="alert" data-testid="composer-model-stale-warning">
          {warningText || (
            <>
              <code className="bg-accent6Dark text-accent6 rounded px-1 py-0.5 break-all">{staleModel}</code> is no
              longer allowed by admin policy. Pick a different model.
            </>
          )}
        </ModelPickerWarning>
      )}
      {environmentVariable && (
        <ModelPickerWarning>
          Set <code className="bg-accent6Dark text-accent6 rounded px-1 py-0.5 break-all">{environmentVariable}</code>{' '}
          to use this provider
        </ModelPickerWarning>
      )}
    </ModelPickerWarnings>
  );
}
