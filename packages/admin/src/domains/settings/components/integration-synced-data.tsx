'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';

import { useIntegrationSyncedData } from '@/domains/integrations/hooks/use-integration';
import { SyncedData } from '@/domains/onboarding/components/synced-data';

export const IntegrationSyncedData = ({ integrationName }: { integrationName: string }) => {
  const { loading, syncedData } = useIntegrationSyncedData({ name: integrationName });
  if (loading) {
    return (
      <div className="h-[17rem] p-8 space-y-4">
        <div className="flex gap-2.5">
          <Skeleton className="bg-[#5F783E]/10 rounded-[3px] w-10 h-10" />
          <Skeleton className="h-10 bg-gradient-radial flex-1" />
        </div>
        <div className="flex gap-2.5">
          <Skeleton className="bg-[#5F783E]/10 rounded-[3px] w-10 h-10" />
          <Skeleton className="h-10 bg-gradient-radial flex-1" />
        </div>
        <div className="flex gap-2.5">
          <Skeleton className="bg-[#5F783E]/10 rounded-[3px] w-10 h-10" />
          <Skeleton className="h-10 bg-gradient-radial flex-1" />
        </div>
      </div>
    );
  }
  return (
    <div className="p-8">
      <ScrollArea>
        <div className="max-h-[17rem]">
          {syncedData ? (
            <SyncedData
              integrationName={integrationName}
              syncedData={syncedData}
              title="sync status"
              className="space-y-4"
            />
          ) : null}
        </div>
      </ScrollArea>
    </div>
  );
};
