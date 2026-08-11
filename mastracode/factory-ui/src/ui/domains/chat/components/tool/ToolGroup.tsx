import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { cn } from '@mastra/playground-ui/utils/cn';
import { X } from 'lucide-react';
import { useState } from 'react';

import type { ToolCall } from '../../services/transcript';
import { ROW_RAIL, ROW_TRIGGER, TranscriptRow } from '../TranscriptRow';
import { ToolCard } from './ToolCard';
import { presentTool } from './tool-presentation';

/** Consecutive tool calls this long collapse into one group row. */
export const TOOL_GROUP_MIN = 3;

export function ToolGroup({ tools }: { tools: ToolCall[] }) {
  const [expanded, setExpanded] = useState(false);
  const running = tools.find(tool => tool.status === 'running');
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
      <CollapsibleTrigger className={ROW_TRIGGER}>
        <TranscriptRow
          label={live?.label ?? `${tools.length} steps`}
          detail={live?.detail ?? actionSummary(tools)}
          running={Boolean(running)}
          expanded={expanded}
          rule
          trailing={<GroupProgress tools={tools} />}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="max-w-full min-w-0">
        <div className={cn(ROW_RAIL, 'py-0.5 pr-0 pl-2.5')}>
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

/** Steps done while the group runs, then the failure mark if any step failed. */
function GroupProgress({ tools }: { tools: ToolCall[] }) {
  const done = tools.filter(tool => tool.status !== 'running').length;
  if (done < tools.length) {
    return (
      <Txt as="span" variant="ui-xs" className="text-icon3 shrink-0 tabular-nums">
        {done}/{tools.length}
      </Txt>
    );
  }
  if (tools.some(tool => tool.status === 'error')) {
    return <X size={13} role="img" aria-label="Failed" className="text-error shrink-0" />;
  }
  return null;
}

function actionSummary(tools: ToolCall[]): string {
  const labels = [...new Set(tools.map(tool => presentTool(tool.toolName, tool.args).label))];
  return labels.slice(0, 4).join(' · ');
}
