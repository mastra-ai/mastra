import { Button } from '@mastra/playground-ui/components/Button';
import { Field, FieldItem, FieldLabel, Fieldset, FieldsetLegend } from '@mastra/playground-ui/components/Field';
import { Popover, PopoverTrigger, PopoverContent } from '@mastra/playground-ui/components/Popover';
import { RadioGroup, RadioGroupItem } from '@mastra/playground-ui/components/RadioGroup';
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
            <Field key={experiment.key}>
              <Fieldset
                className="gap-2"
                render={
                  <RadioGroup
                    value={getVariant(experiment.key)}
                    onValueChange={(v: string) => setVariant(experiment.key, v)}
                  />
                }
              >
                <FieldsetLegend textVariant="body" className="text-muted-foreground">
                  {experiment.name}
                </FieldsetLegend>
                {experiment.variants.map(option => (
                  <FieldItem key={option.value}>
                    <RadioGroupItem value={option.value} />
                    <FieldLabel size="smaller">{option.label}</FieldLabel>
                  </FieldItem>
                ))}
              </Fieldset>
            </Field>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
