import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { useState } from 'react';

import type { ToolCall } from '../../services/transcript';
import { ToolCard } from './ToolCard';
import { presentTool } from './tool-presentation';
import { ToolRow, TOOL_RAIL_OFFSET, TOOL_ROW_TRIGGER } from './ToolRow';

/** Consecutive tool calls this long collapse into one group row. */
export const TOOL_GROUP_MIN = 3;

export function ToolGroup({ tools }: { tools: ToolCall[] }) {
  const [expanded, setExpanded] = useState(false);
  const running = tools.find(tool => tool.status === 'running');
  const hasError = tools.some(tool => tool.status === 'error');
  const doneCount = tools.filter(tool => tool.status !== 'running').length;

  const live = running ? presentTool(running.toolName, running.args) : undefined;

  return (
    <Collapsible
      open={expanded}
      onOpenChange={setExpanded}
      className="max-w-full min-w-0"
      role="group"
      aria-label={`Tool group: ${tools.length} steps`}
      aria-busy={Boolean(running)}
    >
      <CollapsibleTrigger className={TOOL_ROW_TRIGGER}>
        <ToolRow
          label={live?.label ?? `${tools.length} steps`}
          detail={live?.detail ?? actionSummary(tools)}
          status={running ? 'running' : hasError ? 'error' : 'done'}
          expanded={expanded}
          rule
          trailing={
            running && (
              <Txt as="span" variant="ui-xs" className="text-icon3 shrink-0 tabular-nums">
                {doneCount}/{tools.length}
              </Txt>
            )
          }
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="max-w-full min-w-0">
        <div className={cn('border-border1 max-w-full min-w-0 border-l py-0.5 pl-2.5', TOOL_RAIL_OFFSET)}>
          <ScrollArea maxHeight="18rem" autoScroll={Boolean(running)}>
            {tools.map(tool => (
              <ToolCard key={tool.toolCallId} tool={tool} />
            ))}
          </ScrollArea>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function actionSummary(tools: ToolCall[]): string {
  const labels = [...new Set(tools.map(tool => presentTool(tool.toolName, tool.args).label))];
  return labels.slice(0, 4).join(' · ');
}
