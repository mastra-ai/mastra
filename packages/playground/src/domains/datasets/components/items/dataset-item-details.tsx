'use client';

import type { DatasetItem } from '@mastra/client-js';
import { DataKeysAndValues } from '@mastra/playground-ui/components/DataKeysAndValues';
import { DataPanel } from '@mastra/playground-ui/components/DataPanel';
import { format } from 'date-fns/format';

import { datasetItemSections } from './dataset-item-sections';

export interface DatasetItemDetailsProps {
  item: DatasetItem;
  /** When set, each code section highlights the lines that differ from the same field on `against`. */
  diff?: { against: DatasetItem; side: 'a' | 'b' };
}

/**
 * Read-only details of a dataset item: metadata key/values plus code sections.
 * Shared by the item side panel and the version/item compare views.
 */
export function DatasetItemDetails({ item, diff }: DatasetItemDetailsProps) {
  return (
    <>
      <DataKeysAndValues>
        <DataKeysAndValues.Key>Dataset Id</DataKeysAndValues.Key>
        <DataKeysAndValues.ValueWithCopyBtn copyTooltip="Copy Dataset Id to clipboard" copyValue={item.datasetId}>
          {item.datasetId}
        </DataKeysAndValues.ValueWithCopyBtn>
        <DataKeysAndValues.Key>Version</DataKeysAndValues.Key>
        <DataKeysAndValues.Value>v{item.datasetVersion}</DataKeysAndValues.Value>
        <DataKeysAndValues.Key>Created</DataKeysAndValues.Key>
        <DataKeysAndValues.Value>{format(new Date(item.createdAt), 'MMM d, yyyy h:mm aaa')}</DataKeysAndValues.Value>
        <DataKeysAndValues.Key>Updated</DataKeysAndValues.Key>
        <DataKeysAndValues.Value>
          {item.updatedAt && new Date(item.updatedAt).getTime() !== new Date(item.createdAt).getTime()
            ? format(new Date(item.updatedAt), 'MMM d, yyyy h:mm aaa')
            : 'n/a'}
        </DataKeysAndValues.Value>
      </DataKeysAndValues>

      <div className="mt-3 grid gap-3">
        {datasetItemSections.map(section => {
          const codeStr = section.value(item);
          const againstStr = diff ? section.value(diff.against) : undefined;
          // In diff mode keep a section that only exists on the other side so the addition/removal stays visible.
          if (codeStr === undefined && againstStr === undefined) return null;
          return (
            <DataPanel.CodeSection
              key={section.key}
              title={section.title}
              icon={section.icon}
              codeStr={codeStr ?? ''}
              diff={diff ? { against: againstStr ?? '', side: diff.side } : undefined}
            />
          );
        })}
      </div>
    </>
  );
}
