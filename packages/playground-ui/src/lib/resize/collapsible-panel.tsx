import { ChevronLeft, ChevronRight } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { PanelProps } from 'react-resizable-panels';
import { Panel, usePanelRef } from 'react-resizable-panels';
import { IconButton } from '@/ds/components/IconButton/IconButton';
import { Icon } from '@/ds/icons';

interface CollapsiblePanelContextValue {
  collapsed: boolean;
  collapse: () => void;
  expand: () => void;
  toggle: () => void;
}

const CollapsiblePanelContext = createContext<CollapsiblePanelContextValue | null>(null);

export const useCollapsiblePanel = () => {
  const ctx = useContext(CollapsiblePanelContext);
  if (!ctx) {
    throw new Error('useCollapsiblePanel must be used inside a <CollapsiblePanel>.');
  }
  return ctx;
};

export interface CollapsiblePanelProps extends PanelProps {
  direction: 'left' | 'right';
}

export const CollapsiblePanel = ({ collapsedSize, children, direction, ...props }: CollapsiblePanelProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const panelRef = usePanelRef();

  const expand = useCallback(() => {
    panelRef.current?.expand();
  }, [panelRef]);

  const collapse = useCallback(() => {
    panelRef.current?.collapse();
  }, [panelRef]);

  const toggle = useCallback(() => {
    if (!panelRef.current) return;
    if (collapsed) panelRef.current.expand();
    else panelRef.current.collapse();
  }, [collapsed, panelRef]);

  const ctx = useMemo<CollapsiblePanelContextValue>(
    () => ({ collapsed, collapse, expand, toggle }),
    [collapsed, collapse, expand, toggle],
  );

  return (
    <Panel
      panelRef={panelRef}
      collapsedSize={collapsedSize}
      {...props}
      onResize={size => {
        if (typeof collapsedSize !== 'number') return;
        if (size.inPixels <= collapsedSize) setCollapsed(true);
        else if (collapsed) setCollapsed(false);
      }}
    >
      <CollapsiblePanelContext.Provider value={ctx}>
        {collapsed ? <CollapsedPanelHandle direction={direction} onExpand={expand} /> : children}
      </CollapsiblePanelContext.Provider>
    </Panel>
  );
};

interface CollapsedPanelHandleProps {
  direction: 'left' | 'right';
  onExpand: () => void;
}

const CollapsedPanelHandle = ({ direction, onExpand }: CollapsedPanelHandleProps) => (
  <div className="flex h-full items-start justify-center pt-3">
    <IconButton variant="default" size="sm" tooltip="Expand" onClick={onExpand}>
      <Icon>{direction === 'left' ? <ChevronRight /> : <ChevronLeft />}</Icon>
    </IconButton>
  </div>
);
