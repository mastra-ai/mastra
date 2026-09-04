'use client';

import type { DatasetItem } from '@mastra/client-js';
import { Sections } from '@mastra/playground-ui/components/Sections';
import { SideDialog } from '@mastra/playground-ui/components/SideDialog';
import { FileInputIcon, FileOutputIcon, ListChecksIcon, TagIcon, RouteIcon } from 'lucide-react';
import type { useLinkComponent } from '@/lib/framework';

/**
 * Read-only view of the dataset item data
 */
export interface DatasetItemContentProps {
  item: DatasetItem;
  Link: ReturnType<typeof useLinkComponent>['Link'];
}

export function DatasetItemContent({ item }: DatasetItemContentProps) {
  const inputDisplay = item?.input ? JSON.stringify(item.input, null, 2) : 'null';
  const groundTruthDisplay = item?.groundTruth ? JSON.stringify(item.groundTruth, null, 2) : 'null';
  const metadataDisplay = item?.metadata ? JSON.stringify(item.metadata, null, 2) : 'null';
  const trajectoryDisplay = item?.expectedTrajectory ? JSON.stringify(item.expectedTrajectory, null, 2) : null;

  return (
    <Sections>
      <SideDialog.CodeSection title="Input" icon={<FileInputIcon />} codeStr={inputDisplay} />
      <SideDialog.CodeSection title="Ground Truth" icon={<FileOutputIcon />} codeStr={groundTruthDisplay} />
      {trajectoryDisplay && (
        <SideDialog.CodeSection title="Expected Trajectory" icon={<RouteIcon />} codeStr={trajectoryDisplay} />
      )}
      <SideDialog.CodeSection
        title="Scorers"
        icon={<ListChecksIcon />}
        codeStr={item.scorerIds === undefined ? 'Inherited from dataset' : JSON.stringify(item.scorerIds, null, 2)}
      />
      <SideDialog.CodeSection title="Metadata" icon={<TagIcon />} codeStr={metadataDisplay} />
    </Sections>
  );
}
