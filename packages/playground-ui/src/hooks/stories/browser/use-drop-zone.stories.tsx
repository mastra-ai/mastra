import type { Meta, StoryObj } from '@storybook/react-vite';
import type { DragEvent } from 'react';
import { useState } from 'react';
import { HookDemo } from '../../../../.storybook/fixtures/hooks/hook-demo';
import { Txt } from '@/ds/components/Txt';
import { useDropZone } from '@/hooks/use-drop-zone';
import { cn } from '@/lib/utils';

const TASK_TYPE = 'application/x-story-task';

function Lane({ name, tasks, onDropTask }: { name: string; tasks: string[]; onDropTask: (task: string) => void }) {
  const { isDragOver, dropZoneProps } = useDropZone({
    accept: TASK_TYPE,
    dropEffect: 'move',
    onDrop: dataTransfer => onDropTask(dataTransfer.getData(TASK_TYPE)),
  });
  return (
    <section
      aria-label={name}
      className={cn(
        'flex min-h-40 flex-1 flex-col gap-2 rounded-lg border border-border p-3 transition-colors',
        isDragOver && 'bg-fill-hover',
      )}
      {...dropZoneProps}
    >
      <Txt variant="label" className="font-semibold">
        {name}
      </Txt>
      {tasks.map(task => (
        <div
          key={task}
          draggable
          onDragStart={(event: DragEvent<HTMLDivElement>) => event.dataTransfer.setData(TASK_TYPE, task)}
          className="cursor-grab rounded-md border border-border bg-card px-3 py-2"
        >
          <Txt>{task}</Txt>
        </div>
      ))}
    </section>
  );
}

function DropZoneDemo() {
  const [lanes, setLanes] = useState<Record<string, string[]>>({ Todo: ['Write docs', 'Fix login'], Done: [] });
  const moveTask = (task: string, toLane: string) =>
    setLanes(current =>
      Object.fromEntries(
        Object.entries(current).map(([lane, tasks]) => [
          lane,
          lane === toLane
            ? [...tasks.filter(existing => existing !== task), task]
            : tasks.filter(existing => existing !== task),
        ]),
      ),
    );
  return (
    <HookDemo>
      <Txt>Drag a task to the other lane. Dragging a file over a lane leaves it untouched.</Txt>
      <div className="flex gap-3">
        {Object.entries(lanes).map(([lane, tasks]) => (
          <Lane key={lane} name={lane} tasks={tasks} onDropTask={task => moveTask(task, lane)} />
        ))}
      </div>
    </HookDemo>
  );
}

const meta = {
  title: 'Hooks/useDropZone',
  component: DropZoneDemo,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'Turns an element into a native HTML drop target for one `DataTransfer` type, and reports while an accepted drag is over it. Other drags pass through. Import from `@mastra/playground-ui/hooks/use-drop-zone`.',
      },
    },
  },
} satisfies Meta<typeof DropZoneDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
