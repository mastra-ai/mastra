import { useMastraClient } from '@mastra/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/ds/components/Button';
import { Checkbox } from '@/ds/components/Checkbox';
import { DataPanel } from '@/ds/components/DataPanel';
import { Field, FieldLabel } from '@/ds/components/Field';
import { Input } from '@/ds/components/Input';
import { RadioGroup, RadioGroupItem } from '@/ds/components/RadioGroup';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ds/components/Select';
import { Txt } from '@/ds/components/Txt';
import { useLinkComponent } from '@/lib/framework';

export interface ReplaySource {
  agentId: string;
  threadId: string;
  resourceId?: string;
}

/** Mount when opened so every invocation starts with the agent's history default. */
export function CreateReplayDatasetDialog({ source, onClose }: { source: ReplaySource; onClose: () => void }) {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { navigate, paths } = useLinkComponent();
  const [datasetId, setDatasetId] = useState('new');
  const [name, setName] = useState('Golden thread replay');
  const [mode, setMode] = useState<'turns' | 'conversation'>('turns');
  const [history, setHistory] = useState('');
  const [allHistory, setAllHistory] = useState(false);
  const validHistory =
    mode === 'conversation' ||
    allHistory ||
    history === '' ||
    (Number.isSafeInteger(Number(history)) && Number(history) >= 0);
  const historyLimit: number | false | undefined = allHistory ? false : history === '' ? undefined : Number(history);
  const params = mode === 'conversation' ? { ...source, mode } : { ...source, historyLimit };
  const datasets = useQuery({
    queryKey: ['replay-datasets'],
    queryFn: async () => {
      const all = [];
      for (let page = 0; ; page++) {
        // Replay items are agent inputs; workflow datasets would feed them to a workflow as input.
        const result = await client.listDatasets({ page, perPage: 100, targetType: 'agent' });
        all.push(...result.datasets);
        if (!result.pagination.hasMore) return all;
      }
    },
  });
  const preview = useQuery({
    queryKey: ['replay-preview', params],
    queryFn: () => client.previewReplayDataset(params),
    enabled: validHistory,
  });
  const create = useMutation({
    mutationFn: async () => {
      let selectedId = datasetId;
      if (selectedId === 'new') {
        const dataset = await client.createDataset({
          name: name.trim(),
          targetType: 'agent',
          targetIds: [source.agentId],
        });
        selectedId = dataset.id;
        setDatasetId(dataset.id);
      }
      const result = await client.addDatasetItemsFromThread({ datasetId: selectedId, ...params });
      await queryClient.invalidateQueries({ queryKey: ['datasets'] });
      await queryClient.invalidateQueries({ queryKey: ['dataset-items', selectedId] });
      return { ...result, datasetId: selectedId };
    },
  });
  return (
    <DataPanel open onClose={onClose} title="Create replay dataset">
      <DataPanel.Header>
        <DataPanel.Heading>Create replay dataset</DataPanel.Heading>
        <DataPanel.CloseButton onClick={onClose} />
      </DataPanel.Header>
      <DataPanel.Content>
        <div className="grid gap-5">
          <Txt tone="muted">Replay a recorded conversation against an agent using recorded tool results.</Txt>
          {create.data ? (
            <>
              <Txt>
                {create.data.turnCount} turns added as {create.data.itemIds.length}{' '}
                {mode === 'conversation' ? 'conversation' : 'test cases'}.
              </Txt>
              <Button
                onClick={() => {
                  navigate(`${paths.datasetLink(create.data.datasetId)}?run=true`);
                  onClose();
                }}
              >
                Run experiment
              </Button>
              <Button
                variant="default"
                onClick={() => {
                  navigate(paths.datasetLink(create.data.datasetId));
                  onClose();
                }}
              >
                Review dataset
              </Button>
            </>
          ) : (
            <>
              <RadioGroup
                aria-label="Replay mode"
                value={mode}
                disabled={create.isPending}
                onValueChange={value => {
                  if (value === 'turns' || value === 'conversation') setMode(value);
                }}
              >
                <label className="grid grid-cols-[auto_1fr] items-start gap-2">
                  <RadioGroupItem value="turns" aria-label="Independent turns" />
                  <div>
                    <Txt>Independent turns</Txt>
                    <Txt tone="muted">Use recorded history before each turn.</Txt>
                  </div>
                </label>
                <label className="grid grid-cols-[auto_1fr] items-start gap-2">
                  <RadioGroupItem value="conversation" aria-label="Whole conversation" />
                  <div>
                    <Txt>Whole conversation</Txt>
                    <Txt tone="muted">Carry the candidate’s history and memory forward.</Txt>
                  </div>
                </label>
              </RadioGroup>
              {mode === 'conversation' && (
                <Txt tone="muted">
                  User messages stay fixed in their recorded order, even if the candidate replies differently. History
                  follows the candidate’s memory configuration.
                </Txt>
              )}
              <Field>
                <FieldLabel>Dataset</FieldLabel>
                <Select
                  value={datasetId}
                  onValueChange={value => {
                    if (value) setDatasetId(value);
                  }}
                  disabled={create.isPending}
                >
                  <SelectTrigger aria-label="Dataset">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">Create new dataset</SelectItem>
                    {datasets.data?.map(dataset => (
                      <SelectItem key={dataset.id} value={dataset.id}>
                        {dataset.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {datasetId === 'new' && (
                <Field>
                  <FieldLabel htmlFor="replay-name">Dataset name</FieldLabel>
                  <Input
                    id="replay-name"
                    value={name}
                    onChange={event => setName(event.target.value)}
                    disabled={create.isPending}
                  />
                </Field>
              )}
              {mode === 'turns' && (
                <>
                  <Field>
                    <FieldLabel htmlFor="replay-history">Prior messages per turn</FieldLabel>
                    <Input
                      id="replay-history"
                      type="number"
                      min={0}
                      step={1}
                      value={history}
                      placeholder="Agent default"
                      disabled={allHistory || create.isPending}
                      onChange={event => setHistory(event.target.value)}
                    />
                  </Field>
                  <label className="text-ui-md flex items-center gap-2">
                    <Checkbox
                      checked={allHistory}
                      disabled={create.isPending}
                      onCheckedChange={checked => setAllHistory(checked === true)}
                    />
                    Include all prior messages
                  </label>
                </>
              )}
              {!validHistory && <Txt role="alert">Enter a whole number of zero or more prior messages.</Txt>}
              {preview.isFetching ? (
                <Txt>Counting completed turns…</Txt>
              ) : (
                preview.data && (
                  <div className="grid gap-1">
                    <Txt>
                      {preview.data.turnCount} turns →{' '}
                      {mode === 'conversation' && preview.data.turnCount
                        ? '1 conversation'
                        : `${preview.data.turnCount} test cases`}
                    </Txt>
                    {mode === 'turns' && (
                      <Txt>
                        {preview.data.turnCount} completed turns ·{' '}
                        {preview.data.historyLimit === false
                          ? 'All prior messages'
                          : `${preview.data.historyLimit} prior messages per turn`}
                      </Txt>
                    )}
                  </div>
                )
              )}
              {(preview.error || create.error || datasets.error) && (
                <Txt role="alert">{(preview.error ?? create.error ?? datasets.error)?.message}</Txt>
              )}
              <Button
                disabled={
                  !validHistory ||
                  !preview.data?.turnCount ||
                  preview.isFetching ||
                  !!preview.error ||
                  create.isPending ||
                  (datasetId === 'new' && !name.trim())
                }
                onClick={() => create.mutate()}
              >
                {create.isPending ? 'Creating replay…' : 'Create replay dataset'}
              </Button>
            </>
          )}
        </div>
      </DataPanel.Content>
    </DataPanel>
  );
}
