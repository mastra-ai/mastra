import { Loader2 } from 'lucide-react';

const TOOL_DISPLAY_NAMES: Record<string, string> = {
  // AgentBrowser tools
  browser_navigate: 'Navigating',
  browser_goto: 'Navigating',
  browser_click: 'Clicking',
  browser_type: 'Typing',
  browser_scroll: 'Scrolling',
  browser_screenshot: 'Capturing',
  browser_snapshot: 'Reading page',
  browser_close: 'Closing',
  browser_select: 'Selecting',
  // StagehandBrowser tools
  stagehand_navigate: 'Navigating',
  stagehand_act: 'Acting',
  stagehand_extract: 'Extracting',
  stagehand_observe: 'Observing',
  stagehand_screenshot: 'Capturing',
  stagehand_close: 'Closing',
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
    ? (TOOL_DISPLAY_NAMES[toolName] ?? toolName.replace(/^(browser_|stagehand_)/, ''))
    : 'Working';

  return (
    <div className="bg-surface1/40 absolute inset-0 z-10 flex cursor-not-allowed items-center justify-center">
      <div className="bg-surface2 border-border1 flex items-center gap-2 rounded-md border px-3 py-1.5 shadow-sm">
        <Loader2 className="text-accent1 h-3.5 w-3.5 animate-spin" />
        <span className="text-neutral4 text-xs font-medium">Agent: {displayName}</span>
      </div>
    </div>
  );
}
