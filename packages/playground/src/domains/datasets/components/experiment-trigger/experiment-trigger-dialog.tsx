import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { ComboboxParts as C } from '@mastra/playground-ui/components/Combobox';
import {
  Dialog,
  DialogAction,
  DialogBody,
  DialogCancel,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@mastra/playground-ui/components/Dialog';
import { Field, FieldDescription, FieldLabel, Fieldset, FieldsetLegend } from '@mastra/playground-ui/components/Field';
import { Input } from '@mastra/playground-ui/components/Input';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Spinner } from '@mastra/playground-ui/components/Spinner';
import { Textarea } from '@mastra/playground-ui/components/Textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { DynamicForm } from '@mastra/playground-ui/lib/form/dynamic-form';
import { jsonSchemaToZodRuntime } from '@mastra/playground-ui/lib/form/json-schema-to-zod-runtime';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DatasetVersions } from '../dataset-versions';
import { datasetDetail, usePrefetchDataset, useExperimentTrigger } from './use-experiment-trigger';
import type {
  DatasetOption,
  ExperimentTriggerInitialValues,
  ScorerOption,
  TargetOption,
} from './use-experiment-trigger';

export interface ExperimentTriggerDialogProps extends ExperimentTriggerInitialValues {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (experimentId: string) => void;
}

const sameValue = <T extends { value: string }>(a: T | null, b: T | null) => a?.value === b?.value;

const TARGET_GROUPS: { type: TargetOption['type']; label: string }[] = [
  { type: 'agent', label: 'Agents' },
  { type: 'workflow', label: 'Workflows' },
  { type: 'scorer', label: 'Scorers' },
];

/**
 * Schema-driven request context form. Converts the dataset's plain JSON Schema into a zod schema and
 * surfaces values via onChange (no global store coupling).
 */
function RequestContextForm({
  requestContextSchema,
  onChange,
}: {
  requestContextSchema: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
}) {
  const zodSchema = useMemo(() => {
    try {
      return jsonSchemaToZodRuntime(requestContextSchema as Parameters<typeof jsonSchemaToZodRuntime>[0]);
    } catch (error) {
      console.error('Failed to parse requestContextSchema:', error);
      return null;
    }
  }, [requestContextSchema]);

  if (!zodSchema) {
    return (
      <div role="alert">
        <Notice variant="destructive">Failed to parse request context schema</Notice>
      </div>
    );
  }

  return (
    <Fieldset>
      <FieldsetLegend>Request context</FieldsetLegend>
      <DynamicForm schema={zodSchema} onValuesChange={onChange} className="[&_button[type=submit]]:hidden" />
    </Fieldset>
  );
}

/**
 * New experiment: pick what to run, on which data, and how to score it. Everything else has a default
 * and sits under Advanced, whose toggle shows in the footer while closed and stays in place as the
 * section's header row once opened.
 */
export function ExperimentTriggerDialog(props: ExperimentTriggerDialogProps) {
  // A fresh form on every open, while the closing dialog keeps its state through its exit animation.
  const [openCount, setOpenCount] = useState(0);
  const [wasOpen, setWasOpen] = useState(props.open);
  if (props.open !== wasOpen) {
    setWasOpen(props.open);
    if (props.open) setOpenCount(count => count + 1);
  }
  return <NewExperimentDialog key={openCount} {...props} />;
}

function NewExperimentDialog({ open, onOpenChange, onSuccess, ...initial }: ExperimentTriggerDialogProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const state = useExperimentTrigger({ ...initial, onOpenChange, onSuccess });
  const prefetchDataset = usePrefetchDataset();

  // The toggle remounts when it moves between footer and body; keep keyboard focus on it.
  useEffect(() => {
    const active = document.activeElement;
    if (active && active !== document.body) return;
    contentRef.current?.querySelector<HTMLElement>('[data-slot=collapsible-trigger]')?.focus();
  }, [state.advancedOpen]);

  const targetGroups = TARGET_GROUPS.map(group => ({
    value: group.label,
    items: state.targetOptions.filter(option => option.type === group.type),
  })).filter(group => group.items.length > 0);
  const dataset = state.datasets.find(option => option.value === state.datasetId) ?? null;
  const pickedScorers = state.scorerOptions.filter(option => state.scorerIds.includes(option.value));

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && state.canRun) {
      event.preventDefault();
      void state.run();
    }
  };

  const advancedToggle = <CollapsibleTrigger variant="disclosure">Advanced</CollapsibleTrigger>;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} pending={state.isRunning}>
      <DialogContent ref={contentRef} size="md" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle>New experiment</DialogTitle>
          <DialogDescription>Run every item in a dataset through an agent, workflow or scorer.</DialogDescription>
        </DialogHeader>

        {/* `contents`, so the Collapsible wraps body and footer without changing the dialog's layout. */}
        <Collapsible open={state.advancedOpen} onOpenChange={state.setAdvancedOpen} className="contents">
          <DialogBody>
            {/* A plain block, so the closed Advanced panel adds no gap below the fields. */}
            <div>
              <div className="space-y-5">
                <Field>
                  <FieldLabel
                    required
                    info="What runs on each item: an agent, a workflow, or a scorer you want to test."
                  >
                    Target
                  </FieldLabel>
                  <C.Combobox
                    items={targetGroups}
                    value={state.target ?? null}
                    onValueChange={(next: TargetOption | null) => state.setTargetValue(next?.value ?? '')}
                    isItemEqualToValue={sameValue}
                    disabled={state.targetsLoading}
                    autoHighlight
                  >
                    <C.ComboboxInput placeholder="Pick an agent, workflow or scorer" />
                    <C.ComboboxContent container={contentRef}>
                      <C.ComboboxEmpty>Nothing to run</C.ComboboxEmpty>
                      <C.ComboboxList>
                        {(group: (typeof targetGroups)[number], index: number) => (
                          <C.ComboboxGroup key={group.value} items={group.items}>
                            {index > 0 ? <C.ComboboxSeparator /> : null}
                            <C.ComboboxLabel>{group.value}</C.ComboboxLabel>
                            <C.ComboboxCollection>
                              {(item: TargetOption) => (
                                <C.ComboboxItem key={item.value} value={item}>
                                  {item.label}
                                </C.ComboboxItem>
                              )}
                            </C.ComboboxCollection>
                          </C.ComboboxGroup>
                        )}
                      </C.ComboboxList>
                    </C.ComboboxContent>
                  </C.Combobox>
                </Field>

                <Field>
                  <FieldLabel
                    required
                    info="The items to run. Each item's input goes to the target. Runs on the latest version unless you pick one under Advanced."
                  >
                    Dataset
                  </FieldLabel>
                  <C.Combobox
                    items={state.datasets}
                    value={dataset}
                    onValueChange={(next: DatasetOption | null) => next && state.setDataset(next.value)}
                    onItemHighlighted={(item: DatasetOption | undefined) => prefetchDataset(item?.value)}
                    isItemEqualToValue={sameValue}
                    autoHighlight
                  >
                    <C.ComboboxInput placeholder="Select a dataset">
                      {datasetDetail(state.itemCount, state.version)}
                    </C.ComboboxInput>
                    <C.ComboboxContent container={contentRef}>
                      <C.ComboboxEmpty>No datasets found</C.ComboboxEmpty>
                      <C.ComboboxList>
                        {(item: DatasetOption) => (
                          <C.ComboboxItem key={item.value} value={item}>
                            {item.label}
                          </C.ComboboxItem>
                        )}
                      </C.ComboboxList>
                    </C.ComboboxContent>
                  </C.Combobox>
                </Field>

                <Field>
                  <FieldLabel info="Grade each output automatically. Outputs are saved either way, so you can always review them yourself.">
                    Scorers
                  </FieldLabel>
                  <C.Combobox
                    multiple
                    items={state.scorerOptions}
                    value={pickedScorers}
                    onValueChange={(next: ScorerOption[]) => state.setScorerIds(next.map(option => option.value))}
                    isItemEqualToValue={sameValue}
                    autoHighlight
                  >
                    <C.ComboboxChips>
                      <C.ComboboxValue>
                        {(items: ScorerOption[]) => (
                          <>
                            {items.map(item => (
                              <C.ComboboxChip key={item.value}>{item.label}</C.ComboboxChip>
                            ))}
                            <C.ComboboxChipsInput
                              placeholder={items.length === 0 ? 'No scoring, read the outputs yourself' : undefined}
                            />
                          </>
                        )}
                      </C.ComboboxValue>
                    </C.ComboboxChips>
                    <C.ComboboxContent container={contentRef}>
                      <C.ComboboxEmpty>No scorers registered</C.ComboboxEmpty>
                      <C.ComboboxList>
                        {(item: ScorerOption) => {
                          const row = (
                            <C.ComboboxItem key={item.value} value={item}>
                              {item.label}
                            </C.ComboboxItem>
                          );
                          if (!item.description) return row;
                          return (
                            <Tooltip key={item.value}>
                              <TooltipTrigger render={row} />
                              <TooltipContent side="right" className="max-w-64">
                                {item.description}
                              </TooltipContent>
                            </Tooltip>
                          );
                        }}
                      </C.ComboboxList>
                    </C.ComboboxContent>
                  </C.Combobox>
                  {state.usesDefaultScorers && <FieldDescription>The dataset's default scorers.</FieldDescription>}
                </Field>
              </div>

              {/* While open the toggle heads the section, 16px down like the footer row it came from
                  (the body's bottom padding plus the footer's top padding), so it doesn't move. */}
              {state.advancedOpen && <div className="mt-4">{advancedToggle}</div>}

              <CollapsibleContent className="space-y-4 pt-3">
                {state.datasetId && state.showVersion && (
                  <Field>
                    <FieldLabel>Dataset version</FieldLabel>
                    <DatasetVersions
                      datasetId={state.datasetId}
                      value={state.version ?? null}
                      onValueChange={next => state.setVersion(next ?? undefined)}
                      container={contentRef}
                    />
                  </Field>
                )}
                <Field>
                  <FieldLabel>Experiment name</FieldLabel>
                  <Input
                    value={state.name}
                    placeholder={state.defaultName}
                    onChange={event => state.setName(event.target.value)}
                    disabled={state.isRunning}
                  />
                </Field>
                <Field>
                  <FieldLabel>Description</FieldLabel>
                  <Textarea
                    value={state.description}
                    onChange={event => state.setDescription(event.target.value)}
                    placeholder="Optional"
                    rows={2}
                    disabled={state.isRunning}
                  />
                </Field>
                {state.requestContextSchema ? (
                  <RequestContextForm
                    requestContextSchema={state.requestContextSchema}
                    onChange={state.setRequestContextValues}
                  />
                ) : (
                  <Field>
                    <FieldLabel>Request context (JSON)</FieldLabel>
                    <CodeEditor
                      value={state.requestContextRaw}
                      onChange={state.setRequestContextRaw}
                      showCopyButton={false}
                      aria-label="Request context JSON"
                      className="min-h-[120px]"
                    />
                  </Field>
                )}
              </CollapsibleContent>
            </div>
          </DialogBody>

          <DialogFooter start={state.advancedOpen ? undefined : advancedToggle}>
            <DialogCancel>Cancel</DialogCancel>
            <DialogAction onConfirm={state.run} disabled={!state.canRun}>
              {state.isRunning ? (
                <>
                  <Spinner className="h-4 w-4" />
                  Starting…
                </>
              ) : (
                'Run experiment'
              )}
            </DialogAction>
          </DialogFooter>
        </Collapsible>
      </DialogContent>
    </Dialog>
  );
}
