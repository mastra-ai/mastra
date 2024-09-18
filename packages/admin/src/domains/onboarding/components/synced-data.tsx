'use client';

import React from 'react';

import { SyncedDataItem } from '../types';

import { EntitySynced } from './entity-synced';

interface SyncedDataProps {
  referenceId: string | undefined;
  integrationName: string;
  syncedData: SyncedDataItem[];
}

export const SyncedData = ({ referenceId, integrationName, syncedData }: SyncedDataProps) => {
  return (
    <div>
      <h4 className="uppercase text-kpl-el-2 text-xs">You&rsquo;ve just synced</h4>
      <div className="space-y-2 mt-3">
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
