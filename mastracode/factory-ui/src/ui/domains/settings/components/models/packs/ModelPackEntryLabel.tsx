import type { ModelPackModel } from '@mastra/factory/model-packs';
import { ThinkingLevelIcon } from '@mastra/playground-ui/components/ThinkingLevel';
import { IconBox } from '@mastra/playground-ui/icons/central/IconBox';
import { formatModelName } from '@mastra/playground-ui/utils/model';
import type { ReactNode } from 'react';

import { ALL_THINKING_LEVEL_OPTIONS } from '../../../../chat/services/thinkingLevels';
import { ProviderBrandIcon } from '../../../../workspaces/components/ProviderBrandIcon';

export const renderPackProviderIcon = (provider: string) => (
  <ProviderBrandIcon provider={provider} fallback={<IconBox className="size-icon-md" />} />
);

interface ModelPackEntryLabelProps {
  entry: ModelPackModel;
  renderProviderIcon?: (provider: string) => ReactNode;
}

export function ModelPackEntryLabel({ entry, renderProviderIcon = renderPackProviderIcon }: ModelPackEntryLabelProps) {
  return (
    <>
      <span className="flex shrink-0">{renderProviderIcon(entry.modelId.split('/')[0])}</span>
      <span className="min-w-0 flex-1 truncate text-start">{formatModelName(entry.modelId)}</span>
      <span className="flex shrink-0">
        <ThinkingLevelIcon options={ALL_THINKING_LEVEL_OPTIONS} value={entry.thinkingLevel} />
      </span>
    </>
  );
}
