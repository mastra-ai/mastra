import { Combobox } from '@/ds/components/Combobox';

export interface ResourceIdSelectorProps {
  value: string;
  onChange: (resourceId: string) => void;
  agentId: string;
  availableResourceIds: string[];
  disabled?: boolean;
}

export function ResourceIdSelector({
  value,
  onChange,
  agentId,
  availableResourceIds,
  disabled = false,
}: ResourceIdSelectorProps) {
  const options = [
    { label: agentId, value: agentId },
    ...availableResourceIds.filter(id => id !== agentId).map(id => ({ label: id, value: id })),
  ];

  return (
    <Combobox
      options={options}
      value={value}
      onValueChange={onChange}
      placeholder="Select resource ID..."
      searchPlaceholder="Search or type resource ID..."
      emptyText="No resource IDs found."
      disabled={disabled}
      variant="outline"
    />
  );
}
