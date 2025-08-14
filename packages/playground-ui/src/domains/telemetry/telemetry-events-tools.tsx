import { Button } from '@/components/ui/elements/buttons';
import { Select } from '@/components/ui/elements/select';
import { XIcon } from 'lucide-react';

type TelemetryEventsToolsProps = {
  onEntityChange: (val: string) => void;
  selectedEntity?: string;
  entityOptions?: string[];
  onReset?: () => void;
};

export function TelemetryEventsTools({
  onEntityChange,
  onReset,
  selectedEntity,
  entityOptions,
}: TelemetryEventsToolsProps) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-[3rem] items-center">
      <div className="items-center gap-4 max-w-[40rem] flex">
        <Select
          name={'select-entity'}
          onChange={onEntityChange}
          value={selectedEntity}
          options={entityOptions || []}
          placeholder="Select Entity"
        />
        <Button variant="primary" onClick={onReset}>
          Reset <XIcon />
        </Button>
      </div>
    </div>
  );
}
