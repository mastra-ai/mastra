'use client';

import { throttle } from 'lodash';
import React from 'react';

import { Icon } from '@/app/components/icon';
import NumberAnimator from '@/app/components/number-animator';

import { getSyncedData } from '../actions';
import { SyncedDataItem } from '../types';

interface SyncedDataProps {
  referenceId: string | undefined;
  integrationName: string;
  syncedData: SyncedDataItem[];
}

export const SyncedData = ({ referenceId, integrationName, syncedData }: SyncedDataProps) => {
  const [data, setData] = React.useState<SyncedDataItem[]>(syncedData);

  React.useEffect(() => {
    // TODO: watch to check if syncing is complete
    const pollForUpdates = async () => {
      if (!referenceId) return;

      const { entityToRecordCountMap } = await getSyncedData({
        referenceId,
        integrationName,
      });

      setData(prevData =>
        prevData.map(item => {
          const count = entityToRecordCountMap[item.type];
          if (count) {
            return {
              ...item,
              count,
            };
          }
          return item;
        }),
      );
    };

    // Throttle the polling function to ensure it doesn't run more frequently than every 5 seconds
    const throttledPollForUpdates = throttle(pollForUpdates, 5000);

    const intervalId = setInterval(throttledPollForUpdates, 3000);

    return () => {
      clearInterval(intervalId);
      throttledPollForUpdates.cancel();
    };
  }, [referenceId, integrationName]);

  return (
    <div>
      <h4 className="uppercase text-kp-el-2 text-xs">You&rsquo;ve just synced</h4>
      <div className="space-y-2 mt-3">
        {data.map(item => {
          return (
            <div className="flex gap-2.5" key={item.label}>
              <div className="flex items-center text-kp-el-3 bg-[#5F783E]/10 rounded-[3px] w-10 h-10 justify-center ">
                <Icon name={item.icon} width={14} height={14} />
              </div>
              <span className="h-10 px-4 flex text-kp-el-5 text-[13px] font-medium items-center bg-gradient-radial">
                <NumberAnimator value={item.count} /> &nbsp;{item.label}
                {item.count > 1 && 's'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
