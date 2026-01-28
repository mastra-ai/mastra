import { PanelProps, Panel, usePanelRef } from 'react-resizable-panels';
import { useState } from 'react';
import { Button } from '@/ds/components/Button/Button';
import { Icon } from '@/ds/icons';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';

export interface CollapsiblePanelProps extends PanelProps {
  direction: 'left' | 'right';
}

export const CollapsiblePanel = ({ collapsedSize, children, direction, ...props }: CollapsiblePanelProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const panelRef = usePanelRef();

  const expand = () => {
    if (!panelRef.current) return;
    panelRef.current.expand();
  };

  return (
    <Panel
      panelRef={panelRef}
      collapsedSize={collapsedSize}
      {...props}
      onResize={size => {
        if (!collapsedSize) return;
        if (typeof collapsedSize !== 'number') return;

        if (size.inPixels <= collapsedSize) {
          setCollapsed(true);
        } else if (collapsed) {
          setCollapsed(false);
        }
      }}
    >
      {collapsed ? (
        <Tooltip>
          <div className="flex items-center justify-center h-full">
            <TooltipTrigger asChild>
              <Button onClick={expand} className="!h-48 border-none">
                <Icon>{direction === 'left' ? <ArrowRight /> : <ArrowLeft />}</Icon>
              </Button>
            </TooltipTrigger>
          </div>

          <TooltipContent>Expand</TooltipContent>
        </Tooltip>
      ) : (
        children
      )}
    </Panel>
  );
};
