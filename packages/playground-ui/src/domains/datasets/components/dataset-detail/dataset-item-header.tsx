'use client';

import type { DatasetItem } from '@mastra/client-js';
import { TextAndIcon } from '@/ds/components/Text';
import { MainHeader } from '@/ds/components/MainHeader';
import { Calendar1Icon, HistoryIcon, FileCodeIcon } from 'lucide-react';
import { format } from 'date-fns/format';
import { CopyButton } from '@/ds/components/CopyButton';

/**
 * Header component for dataset item details
 */
export interface DatasetItemHeaderProps {
  item: DatasetItem;
}

export function DatasetItemHeader({ item }: DatasetItemHeaderProps) {
  return (
    <MainHeader withMargins={false}>
      <MainHeader.Column>
        <MainHeader.Title size="smaller">
          <FileCodeIcon />
          <span className="truncate">{item.id}</span>
          <CopyButton content={item.id} tooltip={`Copy item ID: ${item.id}`} />
        </MainHeader.Title>
        <MainHeader.Description>
          <TextAndIcon>
            <Calendar1Icon /> Created {format(new Date(item.createdAt), 'MMM d, yyyy h:mm aaa')}
          </TextAndIcon>
          {item.datasetVersion != null && (
            <TextAndIcon>
              <HistoryIcon /> Version v{item.datasetVersion}
            </TextAndIcon>
          )}
        </MainHeader.Description>
      </MainHeader.Column>
    </MainHeader>
  );
}
