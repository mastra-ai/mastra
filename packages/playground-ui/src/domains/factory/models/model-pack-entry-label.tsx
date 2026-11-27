import type { ReactNode } from 'react';
import type { ModelPackModel } from './model-packs';
import { renderPackProviderIcon } from './render-pack-provider-icon';
import { ALL_THINKING_LEVEL_OPTIONS } from './thinking-levels';
import { ThinkingLevelIcon } from '@/ds/components/ThinkingLevel';

import { formatModelName } from '@/utils/model';

interface ModelPackEntryLabelProps {
  entry: ModelPackModel;
  renderProviderIcon?: (provider: string) => ReactNode;
}

export function ModelPackEntryLabel({ entry, renderProviderIcon = renderPackProviderIcon }: ModelPackEntryLabelProps) {
  return (
    <>
      <span className="flex shrink-0">{renderProviderIcon(entry.modelId.split('/')[0] ?? '')}</span>
      <span className="min-w-0 flex-1 truncate text-start">{formatModelName(entry.modelId)}</span>
      <span className="flex shrink-0">
        <ThinkingLevelIcon options={ALL_THINKING_LEVEL_OPTIONS} value={entry.thinkingLevel} />
      </span>
    </>
  );
}
