import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { focusRing } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { Handle, Position } from '@xyflow/react';
import type { Node, NodeProps } from '@xyflow/react';
import { Play } from 'lucide-react';
import { useParams } from 'react-router';

import { settingsSectionPath } from '../settings/settingsSections';
import type { PlacedNode } from './problemMap';
import type { MapColumn, MapNode } from './problemMapNodes';
import { STORIES } from './stories';
import type { StoryPlace } from './stories';

export type ProblemCardNode = Node<{ placed: PlacedNode }, 'card'>;
export type ProblemLabelNode = Node<{ text: string; kind: 'column' | 'group' }, 'label'>;

type Tone = MapColumn | 'open';

const TONES: Record<Tone, { label: string; className: string }> = {
  problem: {
    label: 'Need / problem',
    className: 'border-badge-red-edge bg-badge-red-subtle text-badge-red-foreground',
  },
  solution: {
    label: 'Solution in the prototype',
    className: 'border-badge-green-edge bg-badge-green-subtle text-badge-green-foreground',
  },
  risk: {
    label: 'New risk',
    className: 'border-badge-orange-edge bg-badge-orange-subtle text-badge-orange-foreground',
  },
  fix: { label: 'Fix', className: 'border-badge-blue-edge bg-badge-blue-subtle text-badge-blue-foreground' },
  open: {
    label: 'Open question',
    className: 'border-border-strong bg-fill-subtle text-muted-foreground border-dashed',
  },
};

const PLACE_PATH: Record<StoryPlace, (factoryId: string) => string> = {
  onboarding: factoryId => `/factories/${factoryId}/work`,
  board: factoryId => `/factories/${factoryId}/work`,
  session: factoryId => `/factories/${factoryId}/work`,
  settings: factoryId => settingsSectionPath(factoryId, 'models'),
  rules: factoryId => `/factories/${factoryId}/rules`,
};

function toneOf(node: MapNode): Tone {
  return node.open ? 'open' : node.column;
}

function useOpenStory(): (storyId: string) => void {
  const { factoryId = '' } = useParams<{ factoryId: string }>();
  return storyId => {
    const place = STORIES.find(story => story.id === storyId)?.steps[0]?.where ?? 'board';
    window.location.assign(`${PLACE_PATH[place](factoryId)}?storyboard=${storyId}`);
  };
}

function CardBody({ node }: { node: MapNode }) {
  return (
    <>
      <Txt as="span" variant="body-sm" className="line-clamp-2 leading-tight">
        {node.label}
      </Txt>
      {node.story && (
        <Txt as="span" variant="meta" className="flex items-center gap-1 font-mono">
          <Play size={10} aria-hidden />
          {node.story}
        </Txt>
      )}
    </>
  );
}

export function ProblemMapCard({ data }: NodeProps<ProblemCardNode>) {
  const { node } = data.placed;
  const openStory = useOpenStory();
  const className = cn(
    'flex h-full w-full flex-col justify-center gap-1 rounded-lg border px-3 py-2 text-left',
    TONES[toneOf(node)].className,
  );
  const story = node.story;
  return (
    <>
      <Handle type="target" position={Position.Left} className="!invisible" />
      <Tooltip>
        <TooltipTrigger
          render={
            story ? (
              <button
                type="button"
                aria-label={`${node.label}: open story ${story}`}
                onClick={() => openStory(story)}
                className={cn(className, 'cursor-pointer hover:ring-1 hover:ring-current', focusRing)}
              />
            ) : (
              <div tabIndex={0} className={cn(className, focusRing)} />
            )
          }
        >
          <CardBody node={node} />
        </TooltipTrigger>
        <TooltipContent side="bottom" className="flex max-w-72 flex-col gap-1">
          <span>{node.detail}</span>
          {node.sources.length > 0 && <span className="opacity-70">Source: {node.sources.join(', ')}</span>}
          {story && <span className="opacity-70">Click to open the story</span>}
        </TooltipContent>
      </Tooltip>
      <Handle type="source" position={Position.Right} className="!invisible" />
    </>
  );
}

export function ProblemMapLabel({ data }: NodeProps<ProblemLabelNode>) {
  if (data.kind === 'column') {
    return (
      <Txt as="span" variant="column" tone="muted" className="uppercase">
        {data.text}
      </Txt>
    );
  }
  return (
    <div className="border-border flex h-full items-end border-b pb-1">
      <Txt as="span" variant="label" tone="ink">
        {data.text}
      </Txt>
    </div>
  );
}

export function ProblemMapLegend() {
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Legend">
      {Object.values(TONES).map(tone => (
        <li key={tone.label} className={cn('rounded-md border px-2 py-0.5', tone.className)}>
          <Txt as="span" variant="meta">
            {tone.label}
          </Txt>
        </li>
      ))}
    </ul>
  );
}
