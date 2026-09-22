import { controlStateColorTransition } from '@mastra/playground-ui/primitives/transitions';
import { quietTextHover, quietTextHoverInGroup } from '@mastra/playground-ui/primitives/typography';
import { cn } from '@mastra/playground-ui/utils/cn';

import { EXAMPLES } from './constants';

export interface ExampleListProps {
  onExampleClick: (prompt: string) => void;
}

export const ExampleList = ({ onExampleClick }: ExampleListProps) => {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {EXAMPLES.map((example, i) => {
        const Icon = example.icon;
        return (
          <button
            key={example.title}
            type="button"
            onClick={() => onExampleClick(example.prompt)}
            data-testid={`agent-builder-starter-example-${example.title.toLowerCase().replace(/\s+/g, '-')}`}
            style={{ animationDelay: `${280 + i * 40}ms` }}
            className={cn(
              'starter-chip group border-border text-caption hover:border-border-strong hover:bg-fill-subtle inline-flex items-center gap-2 rounded-full border bg-transparent px-4 py-2',
              quietTextHover,
              controlStateColorTransition,
            )}
          >
            <Icon className={cn('h-3.5 w-3.5', quietTextHoverInGroup, controlStateColorTransition)} />
            {example.title}
          </button>
        );
      })}
    </div>
  );
};
