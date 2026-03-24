import { Loader2 } from 'lucide-react';

const TOOL_DISPLAY_NAMES: Record<string, string> = {
  browser_navigate: 'Navigating',
  browser_click: 'Clicking',
  browser_type: 'Typing',
  browser_scroll: 'Scrolling',
  browser_screenshot: 'Capturing',
  browser_snapshot: 'Reading page',
  browser_close: 'Closing',
  browser_select: 'Selecting',
};

export interface AgentBusyOverlayProps {
  toolName: string | null;
}

/**
 * Semi-transparent overlay shown when agent is executing a browser tool.
 *
 * The overlay absorbs click events (default pointer-events behavior for
 * positioned elements) preventing user clicks from reaching the img element.
 * Mouse moves still show cursor on top of the overlay.
 */
export function AgentBusyOverlay({ toolName }: AgentBusyOverlayProps) {
  const displayName = toolName
    ? (TOOL_DISPLAY_NAMES[toolName] ?? toolName.replace('browser_', ''))
    : 'Working';

  return (
    <div className="absolute inset-0 bg-surface1/40 flex items-center justify-center z-10 cursor-not-allowed">
      <div className="flex items-center gap-2 bg-surface2 px-3 py-1.5 rounded-md border border-border1 shadow-sm">
        <Loader2 className="h-3.5 w-3.5 text-accent1 animate-spin" />
        <span className="text-xs font-medium text-neutral4">Agent: {displayName}</span>
      </div>
    </div>
  );
}
