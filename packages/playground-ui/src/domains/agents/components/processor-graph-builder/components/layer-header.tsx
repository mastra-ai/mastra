import { ArrowDownToLine, Columns2, GitBranch, GripVertical, Trash2 } from 'lucide-react';
import type { DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';
import { Badge, type BadgeProps } from '@/ds/components/Badge';
import { IconButton } from '@/ds/components/IconButton';
import { Icon } from '@/ds/icons/Icon';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ds/components/Select';
import { useProcessorGraphBuilderContext } from './processor-graph-builder-context';
import type { BuilderLayer, BuilderLayerType } from '../types';

const LAYER_TYPE_CONFIG: Record<
  BuilderLayerType,
  { label: string; variant: BadgeProps['variant']; icon: React.ReactNode }
> = {
  step: { label: 'Step', variant: 'info', icon: <ArrowDownToLine /> },
  parallel: { label: 'Parallel', variant: 'success', icon: <Columns2 /> },
  conditional: { label: 'Conditional', variant: 'warning', icon: <GitBranch /> },
};

interface LayerHeaderProps {
  layer: BuilderLayer;
  dragHandleProps: DraggableProvidedDragHandleProps | null | undefined;
}

export function LayerHeader({ layer, dragHandleProps }: LayerHeaderProps) {
  const { builder, readOnly } = useProcessorGraphBuilderContext();

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border1 bg-surface3">
      {!readOnly && (
        <div
          {...dragHandleProps}
          className="cursor-grab rounded p-0.5 text-neutral3 hover:text-neutral5 hover:bg-surface5"
        >
          <Icon>
            <GripVertical />
          </Icon>
        </div>
      )}

      <Badge variant={LAYER_TYPE_CONFIG[layer.entry.type].variant} icon={LAYER_TYPE_CONFIG[layer.entry.type].icon}>
        {LAYER_TYPE_CONFIG[layer.entry.type].label}
      </Badge>

      {!readOnly && (
        <div className="flex items-center gap-1 ml-auto">
          <Select
            value={layer.entry.type}
            onValueChange={value => builder.setLayerType(layer.id, value as BuilderLayerType)}
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="step">Step</SelectItem>
              <SelectItem value="parallel">Parallel</SelectItem>
              <SelectItem value="conditional">Conditional</SelectItem>
            </SelectContent>
          </Select>

          <IconButton variant="ghost" size="sm" tooltip="Remove layer" onClick={() => builder.removeLayer(layer.id)}>
            <Trash2 className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      )}
    </div>
  );
}
