import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { PanelProps, PanelImperativeHandle } from 'react-resizable-panels';
import { Panel, usePanelRef } from 'react-resizable-panels';
import { Button } from '@/ds/components/Button/Button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ds/components/Tooltip';
import { Icon } from '@/ds/icons';

export interface CollapsiblePanelTriggerProps {
  tooltip?: string;
  label?: string;
  icon?: React.ReactNode;
}

export interface CollapsiblePanelProps extends Omit<PanelProps, 'panelRef'> {
  direction: 'left' | 'right';
  collapsedTrigger?: CollapsiblePanelTriggerProps;
  panelRef?: React.RefObject<PanelImperativeHandle | null>;
  showCollapsedTrigger?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export const CollapsiblePanel = ({
  collapsedSize,
  children,
  direction,
  collapsedTrigger,
  panelRef: externalPanelRef,
  showCollapsedTrigger = true,
  onCollapsedChange,
  ...props
}: CollapsiblePanelProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const internalPanelRef = usePanelRef();
  const panelRef = externalPanelRef ?? internalPanelRef;

  const expand = () => {
    if (!panelRef.current) return;
    panelRef.current.expand();
  };

  const defaultIcon = direction === 'left' ? <ArrowRight /> : <ArrowLeft />;

  useEffect(() => {
    onCollapsedChange?.(collapsed);
  }, [collapsed, onCollapsedChange]);

  return (
    <Panel
      panelRef={panelRef}
      collapsedSize={collapsedSize}
      {...props}
      onResize={size => {
        if (collapsedSize === undefined || collapsedSize === null) return;
        if (typeof collapsedSize !== 'number') return;

        if (size.inPixels <= collapsedSize) {
          setCollapsed(true);
        } else if (collapsed) {
          setCollapsed(false);
        }
      }}
    >
      {collapsed ? (
        showCollapsedTrigger ? (
          <Tooltip>
            <div className="flex items-center justify-center h-full">
              <TooltipTrigger asChild>
                <Button onClick={expand} className="h-48! border-none">
                  <Icon>{collapsedTrigger?.icon ?? defaultIcon}</Icon>
                </Button>
              </TooltipTrigger>
            </div>

            <TooltipContent>{collapsedTrigger?.tooltip ?? 'Expand'}</TooltipContent>
          </Tooltip>
        ) : null
      ) : (
        children
      )}
    </Panel>
  );
};
