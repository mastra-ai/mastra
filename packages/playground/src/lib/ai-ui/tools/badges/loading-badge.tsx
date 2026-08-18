import { Tool, ToolHeader, ToolIcon } from '@mastra/playground-ui/components/ai/tool-call';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Spinner } from '@mastra/playground-ui/components/Spinner';

export const LoadingBadge = () => {
  return (
    <Tool status="running" collapsible={false} aria-label="Loading tool call">
      <ToolHeader>
        <ToolIcon tooltip="Tool">
          <Spinner className="text-neutral3" />
        </ToolIcon>
        <Skeleton className="ml-2 h-2 w-12" />
      </ToolHeader>
    </Tool>
  );
};
