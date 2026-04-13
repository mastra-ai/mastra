import { Popover, PopoverTrigger, PopoverContent, RadioGroup, RadioGroupItem, Button } from '@mastra/playground-ui';
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
        <Button aria-label="Experimental UI" size="sm" className="mr-auto ml-3 bg-blue-600 text-white">
          <FlaskConicalIcon /> UI
        </Button>
      </PopoverTrigger>

      <PopoverContent side="top" align="start" className="w-auto p-4">
        <div className="grid gap-4">
          {visibleExperiments.map(experiment => (
            <div key={experiment.key}>
              <span className="text-ui-md text-neutral4">{experiment.name}</span>
              <RadioGroup
                value={getVariant(experiment.key)}
                onValueChange={(v: string) => setVariant(experiment.key, v)}
                className="mt-2"
              >
                {experiment.variants.map(option => (
                  <label key={option.value} className="flex items-center gap-3 text-ui-md text-neutral3 cursor-pointer">
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
