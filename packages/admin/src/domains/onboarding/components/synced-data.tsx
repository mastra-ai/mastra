'use client';

import React from 'react';

import { cn } from '@/lib/utils';

import { SyncedDataItem } from '../types';

import { EntitySynced } from './entity-synced';

interface SyncedDataProps {
  referenceId?: string;
  integrationName: string;
  syncedData: SyncedDataItem[];
  title?: string;
  className?: HTMLDivElement['className'];
}

export const SyncedData = ({
  referenceId,
  integrationName,
  syncedData,
  title = "You've just synced",
  className,
}: SyncedDataProps) => {
  return (
    <div className={cn('space-y-3', className)}>
      <h4 className="uppercase text-kpl-el-2 text-xs">{title}</h4>
      <div className="space-y-2">
        {syncedData.map((item, index) => {
          const canAddLetterS = item.count > 1 && item.label[item.label.length - 1].toLowerCase() !== 's';
          return (
            <EntitySynced
              key={index}
              integrationName={integrationName}
              referenceId={referenceId}
              iconName={item.icon}
              defaultCount={item.count}
              label={item.label}
              entityType={item.type}
              canAddLetterS={canAddLetterS}
            />
          );
        })}
      </div>
    </div>
  );
};
