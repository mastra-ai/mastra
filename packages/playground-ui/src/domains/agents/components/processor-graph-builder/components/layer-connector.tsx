import { ChevronDown } from 'lucide-react';
import { Icon } from '@/ds/icons/Icon';

export function LayerConnector() {
  return (
    <div className="flex justify-center py-2 text-neutral3">
      <Icon>
        <ChevronDown />
      </Icon>
    </div>
  );
}
