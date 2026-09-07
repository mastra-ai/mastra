'use client';

import type { DatasetItem } from '@mastra/client-js';
import { DataKeysAndValues } from '@mastra/playground-ui/components/DataKeysAndValues';
import { DataPanel } from '@mastra/playground-ui/components/DataPanel';
import { format } from 'date-fns/format';
import {
  BracesIcon,
  FileInputIcon,
  FileOutputIcon,
  ListChecksIcon,
  RouteIcon,
  TagIcon,
  WrenchIcon,
} from 'lucide-react';

export interface DatasetItemDetailsProps {
  item: DatasetItem;
}

/**
 * Read-only details of a dataset item: metadata key/values plus code sections.
 * Shared by the item side panel and the version/item compare views.
 */
export function DatasetItemDetails({ item }: DatasetItemDetailsProps) {
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
        <DataPanel.CodeSection
          title="Input"
          icon={<FileInputIcon />}
          codeStr={JSON.stringify(item.input ?? null, null, 2)}
        />
        <DataPanel.CodeSection
          title="Ground Truth"
          icon={<FileOutputIcon />}
          codeStr={JSON.stringify(item.groundTruth ?? null, null, 2)}
        />
        {item.expectedTrajectory != null && (
          <DataPanel.CodeSection
            title="Expected Trajectory"
            icon={<RouteIcon />}
            codeStr={JSON.stringify(item.expectedTrajectory, null, 2)}
          />
        )}
        <DataPanel.CodeSection
          title="Tool Mocks"
          icon={<WrenchIcon />}
          codeStr={JSON.stringify(item.toolMocks ?? [], null, 2)}
        />
        <DataPanel.CodeSection
          title="Scorers"
          icon={<ListChecksIcon />}
          codeStr={item.scorerIds === undefined ? 'Inherited from dataset' : JSON.stringify(item.scorerIds, null, 2)}
        />
        {item.requestContext != null && (
          <DataPanel.CodeSection
            title="Request Context"
            icon={<BracesIcon />}
            codeStr={JSON.stringify(item.requestContext, null, 2)}
          />
        )}
        <DataPanel.CodeSection
          title="Metadata"
          icon={<TagIcon />}
          codeStr={JSON.stringify(item.metadata ?? null, null, 2)}
        />
      </div>
    </>
  );
}
