import { Trash2 } from 'lucide-react';

import { IconButton } from '@/ds/components/IconButton';
import { Textarea } from '@/ds/components/Textarea';
import { Icon } from '@/ds/icons';

export interface EntityAccordionItemProps {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  onDescriptionChange: (description: string) => void;
  onRemove: () => void;
}

export function EntityAccordionItem({
  id,
  name,
  icon,
  description,
  onDescriptionChange,
  onRemove,
}: EntityAccordionItemProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size="sm">{icon}</Icon>
          <span className="text-xs font-medium text-icon6">{name}</span>
        </div>
        <IconButton tooltip={`Remove ${name}`} onClick={onRemove} variant="ghost" size="sm">
          <Trash2 />
        </IconButton>
      </div>

      <Textarea
        id={`description-${id}`}
        value={description}
        onChange={e => onDescriptionChange(e.target.value)}
        placeholder="Custom description for this entity..."
        className="min-h-[40px] text-xs bg-surface3 border-dashed px-2 py-1"
        size="sm"
      />
    </div>
  );
}
