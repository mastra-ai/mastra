'use client';

import type { DatasetItem } from '@mastra/client-js';
import { TextAndIcon } from '@/ds/components/Text';
import { KeyValueList } from '@/ds/components/KeyValueList';
import { Sections } from '@/ds/components/Sections';
import { SideDialog } from '@/ds/components/SideDialog';
import { useLinkComponent } from '@/lib/framework';
import { HashIcon, FileInputIcon, FileOutputIcon, TagIcon } from 'lucide-react';
import { format } from 'date-fns/format';

export interface DatasetItemPageProps {
  item: DatasetItem;
}

/**
 * Page component for displaying a single dataset item's details.
 * Read-only view showing input, ground truth, and metadata.
 */
export function DatasetItemPage({ item }: DatasetItemPageProps) {
  const { Link } = useLinkComponent();

  return (
    <div className="h-full overflow-y-auto p-6">
      <DatasetItemContent item={item} Link={Link} />
    </div>
  );
}

/**
 * Read-only view of the dataset item details
 */
function DatasetItemContent({ item, Link }: { item: DatasetItem; Link: ReturnType<typeof useLinkComponent>['Link'] }) {
  const metadataDisplay = item.metadata ? JSON.stringify(item.metadata, null, 2) : null;

  return (
    <>
      <div className="mb-4">
        <h3 className="text-lg font-medium flex items-center gap-2">
          <FileInputIcon className="w-5 h-5" /> Dataset Item
        </h3>
        <TextAndIcon>
          <HashIcon className="w-4 h-4" /> {item.id}
        </TextAndIcon>
      </div>

      <Sections>
        <KeyValueList
          data={[
            {
              label: 'Created',
              value: format(new Date(item.createdAt), 'MMM d, yyyy h:mm aaa'),
              key: 'createdAt',
            },
            ...(item.datasetVersion != null
              ? [
                  {
                    label: 'Version',
                    value: `v${item.datasetVersion}`,
                    key: 'version',
                  },
                ]
              : []),
          ]}
          LinkComponent={Link}
        />

        <SideDialog.CodeSection title="Input" icon={<FileInputIcon />} codeStr={JSON.stringify(item.input, null, 2)} />

        {item.groundTruth !== null && item.groundTruth !== undefined && (
          <SideDialog.CodeSection
            title="Ground Truth"
            icon={<FileOutputIcon />}
            codeStr={JSON.stringify(item.groundTruth, null, 2)}
          />
        )}

        {metadataDisplay && <SideDialog.CodeSection title="Metadata" icon={<TagIcon />} codeStr={metadataDisplay} />}
      </Sections>
    </>
  );
}

export default DatasetItemPage;
