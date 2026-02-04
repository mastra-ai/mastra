'use client';

import type { DatasetItem } from '@mastra/client-js';
import { TextAndIcon } from '@/ds/components/Text';
import { KeyValueList } from '@/ds/components/KeyValueList';
import { HashIcon, FileInputIcon } from 'lucide-react';
import { format } from 'date-fns/format';
import type { useLinkComponent } from '@/lib/framework';

/**
 * Header component for dataset item details
 */
export interface DatasetItemHeaderProps {
  item: DatasetItem;
  Link: ReturnType<typeof useLinkComponent>['Link'];
}

export function DatasetItemHeader({ item, Link }: DatasetItemHeaderProps) {
  return (
    <div className="mb-4">
      <h3 className="text-lg font-medium flex items-center gap-2">
        <FileInputIcon className="w-5 h-5" /> Dataset Item
      </h3>
      <TextAndIcon>
        <HashIcon className="w-4 h-4" /> {item.id}
      </TextAndIcon>

      <KeyValueList
        data={[
          {
            label: 'Created',
            value: format(new Date(item.createdAt), 'MMM d, yyyy h:mm aaa'),
            key: 'createdAt',
          },
          ...(item.version
            ? [
                {
                  label: 'Version',
                  value: format(new Date(item.version), 'MMM d, yyyy h:mm aaa'),
                  key: 'version',
                },
              ]
            : []),
        ]}
        LinkComponent={Link}
      />
    </div>
  );
}
