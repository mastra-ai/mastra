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
            className="starter-chip group inline-flex items-center gap-2 rounded-full border border-border1 bg-transparent px-4 py-2 text-ui-sm text-neutral4 transition-colors duration-normal ease-out-custom hover:border-border2 hover:bg-surface2 hover:text-neutral6"
          >
            <Icon className="h-3.5 w-3.5 text-neutral3 transition-colors group-hover:text-neutral5" />
            {example.title}
          </button>
        );
      })}
    </div>
  );
};
