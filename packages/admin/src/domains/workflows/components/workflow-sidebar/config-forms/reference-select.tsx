'use client';

import { Skeleton } from '@/components/ui/skeleton';

import { useGetConnectionIds } from '@/lib/hooks/use-reference-ids';

import BaseSelect from './base-select';

function ReferenceSelect({
  onSelect,
  selected,
  integrationName,
}: {
  onSelect: any;
  selected?: string;
  integrationName: string;
}) {
  const { connectionIds, isLoading } = useGetConnectionIds({ integrationName });

  const allOptions = [
    { label: "Use trigger event's reference ID", value: '' },
    ...(connectionIds?.length
      ? connectionIds?.map(({ connectionId }) => ({ label: connectionId, value: connectionId }))
      : []),
  ];

  return isLoading ? (
    <Skeleton className="w-full h-8" />
  ) : (
    <BaseSelect
      allOptions={allOptions}
      onSelect={onSelect}
      canUseVariables={false}
      selected={selected || ''}
      field="mastraConnectionId"
      fieldValue={selected || ''}
      withoutClearSelection
    />
  );
}

export default ReferenceSelect;
