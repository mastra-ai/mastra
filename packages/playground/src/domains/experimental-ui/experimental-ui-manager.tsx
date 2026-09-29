import { Button } from '@mastra/playground-ui/components/Button';
import { Popover, PopoverTrigger, PopoverContent } from '@mastra/playground-ui/components/Popover';
import { RadioGroup, RadioGroupItem } from '@mastra/playground-ui/components/RadioGroup';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { FlaskConicalIcon } from 'lucide-react';
import { useMaybeExperimentalUI } from './experimental-ui-context';

export function ExperimentalUIManager({ pathname }: { pathname?: string }) {
  const context = useMaybeExperimentalUI();
  if (!context) return null;

  const { experiments, getVariant, setVariant } = context;

  const visibleExperiments = pathname
    ? experiments.filter(e => !e.path || (Array.isArray(e.path) ? e.path.includes(pathname) : e.path === pathname))
    : experiments;

  if (visibleExperiments.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          aria-label="Experimental UI"
          variant="primary"
          size="sm"
          className="mr-auto ml-3"
          icon={<FlaskConicalIcon />}
        >
          UI
        </Button>
      </PopoverTrigger>

      <PopoverContent side="top" align="start" className="w-auto p-4">
        <div className="grid gap-4">
          {visibleExperiments.map(experiment => (
            <div key={experiment.key}>
              <Txt as="span" tone="muted">
                {experiment.name}
              </Txt>
              <RadioGroup
                value={getVariant(experiment.key)}
                onValueChange={(v: string) => setVariant(experiment.key, v)}
                className="mt-2"
              >
                {experiment.variants.map(option => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-center gap-3 text-caption text-muted-foreground"
                  >
                    <RadioGroupItem value={option.value} />
                    {option.label}
                  </label>
                ))}
              </RadioGroup>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
