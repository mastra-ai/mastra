import type { BackgroundTaskEvent } from '@mastra/react/hooks/agents';
import { backgroundTaskOutputText } from './background-task-output';
import { BackgroundWorkRow } from './background-work-row';
import { presentTool, ToolCallOutput } from '@/ds/components/ai/tool-call';
import { Txt } from '@/ds/components/Txt';

// The running event carries when the task started, though the stream's event type leaves it out.
const startedAtOf = (task: BackgroundTaskEvent): number | undefined => {
  const startedAt: unknown = 'startedAt' in task ? task.startedAt : undefined;
  if (typeof startedAt !== 'string' && !(startedAt instanceof Date)) return undefined;
  const time = new Date(startedAt).getTime();
  return Number.isNaN(time) ? undefined : time;
};

/** A running background task: what it is, how long it has run and what it streamed. */
export function BackgroundTaskRow({ task }: { task: BackgroundTaskEvent }) {
  const { icon: Icon, label, detail, description } = presentTool(task.toolName, task.args);
  const output = backgroundTaskOutputText(task.output);

  return (
    <BackgroundWorkRow
      icon={<Icon aria-hidden />}
      label={label}
      detail={description ?? detail}
      startedAt={startedAtOf(task)}
    >
      {output ? (
        <ToolCallOutput text={output} />
      ) : (
        <Txt variant="caption" tone="muted">
          No output yet
        </Txt>
      )}
    </BackgroundWorkRow>
  );
}
