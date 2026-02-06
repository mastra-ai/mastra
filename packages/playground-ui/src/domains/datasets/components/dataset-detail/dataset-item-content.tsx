'use client';

import type { DatasetItem } from '@mastra/client-js';
import { Sections } from '@/ds/components/Sections';
import { SideDialog } from '@/ds/components/SideDialog';
import { FileInputIcon, FileOutputIcon, TagIcon } from 'lucide-react';
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
  const expectedOutputDisplay = item?.expectedOutput ? JSON.stringify(item.expectedOutput, null, 2) : 'null';
  const metadataDisplay = item?.context ? JSON.stringify(item.context, null, 2) : 'null';

  return (
    <Sections>
      <SideDialog.CodeSection title="Input" icon={<FileInputIcon />} codeStr={inputDisplay} />
      <SideDialog.CodeSection title="Expected Output" icon={<FileOutputIcon />} codeStr={expectedOutputDisplay} />
      <SideDialog.CodeSection title="Metadata" icon={<TagIcon />} codeStr={metadataDisplay} />
    </Sections>
  );
}
