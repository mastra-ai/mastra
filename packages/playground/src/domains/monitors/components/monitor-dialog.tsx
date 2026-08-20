'use client';
import type { CreateMonitorParams, Monitor } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody } from '@mastra/playground-ui/components/Dialog';
import { SelectFieldBlock } from '@mastra/playground-ui/components/FormFieldBlocks';
import { Input } from '@mastra/playground-ui/components/Input';
import { Label } from '@mastra/playground-ui/components/Label';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useEffect, useState } from 'react';
import { useMonitorMutations } from '../hooks';

const AGGREGATION_OPTIONS = [
  { value: 'avg', label: 'Average score' },
  { value: 'p50', label: 'Median (p50)' },
  { value: 'p95', label: 'p95' },
  { value: 'count', label: 'Score count' },
  { value: 'passRate', label: 'Pass rate' },
];

const OP_OPTIONS = [
  { value: 'lt', label: '< (below)' },
  { value: 'lte', label: '≤ (at or below)' },
  { value: 'gt', label: '> (above)' },
  { value: 'gte', label: '≥ (at or above)' },
];

export interface MonitorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided the dialog edits this monitor instead of creating one. */
  monitor?: Monitor;
  scorerOptions: Array<{ value: string; label: string }>;
}

export function MonitorDialog({ open, onOpenChange, monitor, scorerOptions }: MonitorDialogProps) {
  const { createMonitor, updateMonitor } = useMonitorMutations();
  const isEdit = Boolean(monitor);

  const [name, setName] = useState('');
  const [scorerId, setScorerId] = useState('');
  const [metadataFilter, setMetadataFilter] = useState('');
  const [windowMinutes, setWindowMinutes] = useState('60');
  const [aggregation, setAggregation] = useState('avg');
  const [op, setOp] = useState('lt');
  const [thresholdValue, setThresholdValue] = useState('0.7');
  const [cooldownMinutes, setCooldownMinutes] = useState('30');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [slackFormat, setSlackFormat] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(monitor?.name ?? '');
    setScorerId(monitor?.filter?.scorerIds?.[0] ?? '');
    setMetadataFilter(monitor?.filter?.metadata ? JSON.stringify(monitor.filter.metadata) : '');
    setWindowMinutes(String(monitor?.windowMinutes ?? 60));
    setAggregation(monitor?.aggregation ?? 'avg');
    setOp(monitor?.threshold?.op ?? 'lt');
    setThresholdValue(String(monitor?.threshold?.value ?? 0.7));
    setCooldownMinutes(String(monitor?.cooldownMinutes ?? 30));
    setWebhookUrl(monitor?.channels?.[0]?.url ?? '');
    setSlackFormat(monitor?.channels?.[0]?.format === 'slack');
  }, [open, monitor]);

  const isPending = createMonitor.isPending || updateMonitor.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Monitor name is required');
      return;
    }

    let metadata: Record<string, unknown> | undefined;
    if (metadataFilter.trim()) {
      try {
        metadata = JSON.parse(metadataFilter);
      } catch {
        toast.error('Metadata filter must be valid JSON (e.g. {"cohort": "oncology"})');
        return;
      }
    }

    const params: CreateMonitorParams = {
      name: name.trim(),
      filter: {
        ...(scorerId ? { scorerIds: [scorerId] } : {}),
        ...(metadata ? { metadata } : {}),
      },
      windowMinutes: Number(windowMinutes) || 60,
      aggregation: aggregation as CreateMonitorParams['aggregation'],
      threshold: { op: op as 'lt' | 'lte' | 'gt' | 'gte', value: Number(thresholdValue) },
      cooldownMinutes: Number(cooldownMinutes) || 0,
      channels: webhookUrl.trim()
        ? [{ type: 'webhook', url: webhookUrl.trim(), format: slackFormat ? 'slack' : 'json' }]
        : [],
    };

    try {
      if (isEdit && monitor) {
        await updateMonitor.mutateAsync({ monitorId: monitor.id, params });
        toast.success('Monitor updated');
      } else {
        await createMonitor.mutateAsync(params);
        toast.success('Monitor created');
      }
      onOpenChange(false);
    } catch (error) {
      toast.error(
        `Failed to ${isEdit ? 'update' : 'create'} monitor: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Monitor' : 'Create Monitor'}</DialogTitle>
        </DialogHeader>
        <DialogBody className="max-h-[70vh] overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="monitor-name">Name *</Label>
              <Input
                id="monitor-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Relevancy floor — oncology cohort"
                autoFocus
              />
            </div>

            <SelectFieldBlock
              label="Scorer"
              name="monitor-scorer"
              placeholder="All scorers"
              options={scorerOptions}
              value={scorerId}
              onValueChange={setScorerId}
              helpText="Restrict the monitor to scores from a single scorer."
              disabled={isPending}
            />

            <div className="space-y-2">
              <Label htmlFor="monitor-metadata">Metadata filter (JSON)</Label>
              <Input
                id="monitor-metadata"
                value={metadataFilter}
                onChange={e => setMetadataFilter(e.target.value)}
                placeholder='{"cohort": "oncology", "deployment": "v42"}'
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="monitor-window">Window (minutes)</Label>
                <Input
                  id="monitor-window"
                  type="number"
                  min={1}
                  value={windowMinutes}
                  onChange={e => setWindowMinutes(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="monitor-cooldown">Cooldown (minutes)</Label>
                <Input
                  id="monitor-cooldown"
                  type="number"
                  min={0}
                  value={cooldownMinutes}
                  onChange={e => setCooldownMinutes(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <SelectFieldBlock
                label="Aggregation"
                name="monitor-aggregation"
                options={AGGREGATION_OPTIONS}
                value={aggregation}
                onValueChange={setAggregation}
                disabled={isPending}
              />
              <SelectFieldBlock
                label="Breach when"
                name="monitor-op"
                options={OP_OPTIONS}
                value={op}
                onValueChange={setOp}
                disabled={isPending}
              />
              <div className="space-y-2">
                <Label htmlFor="monitor-threshold">Threshold</Label>
                <Input
                  id="monitor-threshold"
                  type="number"
                  step="any"
                  value={thresholdValue}
                  onChange={e => setThresholdValue(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="monitor-webhook">Webhook URL</Label>
              <Input
                id="monitor-webhook"
                value={webhookUrl}
                onChange={e => setWebhookUrl(e.target.value)}
                placeholder="https://hooks.example.com/alerts"
              />
            </div>

            <SelectFieldBlock
              label="Webhook format"
              name="monitor-webhook-format"
              options={[
                { value: 'json', label: 'JSON payload' },
                { value: 'slack', label: 'Slack-compatible' },
              ]}
              value={slackFormat ? 'slack' : 'json'}
              onValueChange={value => setSlackFormat(value === 'slack')}
              disabled={isPending}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isPending || !name.trim()}>
                {isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Monitor'}
              </Button>
            </div>
          </form>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
