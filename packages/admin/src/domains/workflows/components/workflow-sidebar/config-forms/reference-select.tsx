'use client';

import { Skeleton } from '@/components/ui/skeleton';

import { useGetReferenceIds } from '@/lib/hooks/use-reference-ids';

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
  const { referenceIds, isLoading } = useGetReferenceIds({ integrationName });
  const allOptions = [
    { label: "Use trigger event's reference ID", value: '' },
    ...(referenceIds?.length
      ? referenceIds?.map(({ referenceId }) => ({ label: referenceId, value: referenceId }))
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
      field="keplerConnectionId"
      fieldValue={selected || ''}
      withoutClearSelection
    />
  );
}

export default ReferenceSelect;
