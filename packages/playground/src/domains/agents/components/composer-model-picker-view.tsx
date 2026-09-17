import { ModelPickerDivider, ModelPickerLocked } from '@mastra/playground-ui/components/ModelPicker';
import type { ReactNode } from 'react';

interface ComposerModelPickerViewProps {
  provider: ReactNode;
  model: ReactNode;
  loading?: boolean;
  lockedLabel?: string;
}

export function ComposerModelPickerView({ provider, model, loading, lockedLabel }: ComposerModelPickerViewProps) {
  if (loading) return null;
  if (lockedLabel) return <ModelPickerLocked label={lockedLabel} />;
  return (
    <div className="inline-flex max-w-full items-stretch">
      {provider}
      <ModelPickerDivider />
      {model}
    </div>
  );
}
