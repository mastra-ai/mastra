'use client';

import { useState } from 'react';
import { PlayIcon, LoaderIcon } from 'lucide-react';

import { Button } from '@/ds/components/Button';
import { Badge } from '@/ds/components/Badge';
import { Icon } from '@/ds/icons/Icon';

import type { TrainingConfig, TrainingMethod } from '../types';

interface TrainingConfigFormProps {
  agentId: string;
  agentName: string;
  scorers: Array<{ id: string; name: string }>;
  onSubmit: (config: TrainingConfig) => Promise<void>;
  isSubmitting?: boolean;
  disabled?: boolean;
}

const methodDescriptions: Record<TrainingMethod, string> = {
  sft: 'Supervised Fine-Tuning: Train on high-quality input/output pairs',
  dpo: 'Direct Preference Optimization: Train using preference pairs (chosen vs rejected)',
};

const baseModels = [
  { id: 'gpt-4o-mini-2024-07-18', name: 'GPT-4o Mini (Recommended)' },
  { id: 'gpt-4o-2024-08-06', name: 'GPT-4o' },
  { id: 'gpt-4-0613', name: 'GPT-4' },
  { id: 'gpt-3.5-turbo-0125', name: 'GPT-3.5 Turbo' },
];

export function TrainingConfigForm({
  agentId,
  agentName,
  scorers,
  onSubmit,
  isSubmitting,
  disabled,
}: TrainingConfigFormProps) {
  const [method, setMethod] = useState<TrainingMethod>('sft');
  const [dataSource, setDataSource] = useState<'traces' | 'dataset'>('traces');
  const [baseModel, setBaseModel] = useState(baseModels[0]!.id);
  const [epochs, setEpochs] = useState(3);
  const [minScore, setMinScore] = useState(0.7);
  const [maxExamples, setMaxExamples] = useState(1000);
  const [holdoutRatio, setHoldoutRatio] = useState(0.1);
  const [selectedScorers, setSelectedScorers] = useState<string[]>(scorers.slice(0, 1).map(s => s.id));
  const [weights, setWeights] = useState<Record<string, number>>(() => {
    const w: Record<string, number> = {};
    scorers.forEach(s => {
      w[s.id] = 1;
    });
    return w;
  });
  const [since, setSince] = useState('');
  const [until, setUntil] = useState('');
  const [limit, setLimit] = useState<number | undefined>(undefined);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const config: TrainingConfig = {
      method,
      dataSource,
      filter:
        dataSource === 'traces'
          ? {
              since: since || undefined,
              until: until || undefined,
              limit,
            }
          : undefined,
      scoring: {
        scorerIds: selectedScorers,
        weights: Object.fromEntries(selectedScorers.map(id => [id, weights[id] ?? 1])),
      },
      selection: {
        minScore,
        maxExamples,
        holdoutRatio,
        dedupe: true,
      },
      provider: {
        baseModel,
        epochs,
      },
    };

    await onSubmit(config);
  };

  const inputClasses =
    'w-full px-3 py-2 border-sm border-border1 rounded-md bg-surface1 text-icon6 text-ui-md focus:outline-none focus:border-accent1';
  const labelClasses = 'block text-icon3 text-ui-sm uppercase mb-2';
  const sectionClasses = 'p-4 rounded-md bg-surface3 space-y-4';

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Method Selection */}
      <div>
        <label className={labelClasses}>Training Method</label>
        <div className="grid grid-cols-2 gap-3">
          {(['sft', 'dpo'] as TrainingMethod[]).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              className={`p-4 rounded-md border-sm text-left transition-colors ${
                method === m ? 'border-accent1 bg-surface4' : 'border-border1 hover:border-border1 hover:bg-surface3'
              }`}
            >
              <div className="font-medium text-icon6 mb-1">{m.toUpperCase()}</div>
              <div className="text-ui-sm text-icon3">{methodDescriptions[m]}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Data Source */}
      <div>
        <label className={labelClasses}>Data Source</label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setDataSource('traces')}
            className={`flex-1 p-3 rounded-md border-sm transition-colors ${
              dataSource === 'traces' ? 'border-accent1 bg-surface4' : 'border-border1'
            }`}
          >
            <div className="font-medium text-icon6">From Traces</div>
            <div className="text-ui-sm text-icon3">Use historical agent runs from observability</div>
          </button>
          <button
            type="button"
            onClick={() => setDataSource('dataset')}
            className={`flex-1 p-3 rounded-md border-sm border-border1 opacity-50 cursor-not-allowed`}
            disabled
          >
            <div className="font-medium text-icon3">Upload Dataset</div>
            <div className="text-ui-sm text-icon3">Coming soon</div>
          </button>
        </div>
      </div>

      {/* Trace Filters */}
      {dataSource === 'traces' && (
        <div className={sectionClasses}>
          <h4 className="font-medium text-icon6">Trace Filters</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClasses}>Since</label>
              <input
                type="datetime-local"
                value={since}
                onChange={e => setSince(e.target.value)}
                className={inputClasses}
              />
            </div>
            <div>
              <label className={labelClasses}>Until</label>
              <input
                type="datetime-local"
                value={until}
                onChange={e => setUntil(e.target.value)}
                className={inputClasses}
              />
            </div>
          </div>
          <div>
            <label className={labelClasses}>Max Traces to Fetch</label>
            <input
              type="number"
              value={limit || ''}
              onChange={e => setLimit(e.target.value ? parseInt(e.target.value) : undefined)}
              placeholder="Unlimited"
              className={inputClasses}
            />
          </div>
        </div>
      )}

      {/* Scorers */}
      <div>
        <label className={labelClasses}>Scorers for Quality Assessment</label>
        {scorers.length === 0 ? (
          <div className="p-4 rounded-md bg-surface3 text-icon3 text-ui-sm">
            No scorers configured. Add scorers to your Mastra instance to enable quality-based selection.
          </div>
        ) : (
          <div className="space-y-2">
            {scorers.map(scorer => (
              <div
                key={scorer.id}
                className="flex items-center gap-3 p-3 rounded-md border-sm border-border1 bg-surface2"
              >
                <input
                  type="checkbox"
                  id={`scorer-${scorer.id}`}
                  checked={selectedScorers.includes(scorer.id)}
                  onChange={e => {
                    if (e.target.checked) {
                      setSelectedScorers([...selectedScorers, scorer.id]);
                    } else {
                      setSelectedScorers(selectedScorers.filter(id => id !== scorer.id));
                    }
                  }}
                  className="w-4 h-4 accent-accent1"
                />
                <label htmlFor={`scorer-${scorer.id}`} className="flex-1 text-icon6">
                  {scorer.name}
                </label>
                {selectedScorers.includes(scorer.id) && (
                  <div className="flex items-center gap-2">
                    <span className="text-ui-sm text-icon3">Weight:</span>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      value={weights[scorer.id] ?? 1}
                      onChange={e => setWeights({ ...weights, [scorer.id]: parseFloat(e.target.value) || 1 })}
                      className="w-16 px-2 py-1 text-ui-sm border-sm border-border1 rounded-md bg-surface1 text-icon6"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Selection */}
      <div className={sectionClasses}>
        <h4 className="font-medium text-icon6">Selection Criteria</h4>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className={labelClasses}>Min Score (0-1)</label>
            <input
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={minScore}
              onChange={e => setMinScore(parseFloat(e.target.value))}
              className={inputClasses}
            />
          </div>
          <div>
            <label className={labelClasses}>Max Examples</label>
            <input
              type="number"
              min="1"
              value={maxExamples}
              onChange={e => setMaxExamples(parseInt(e.target.value))}
              className={inputClasses}
            />
          </div>
          <div>
            <label className={labelClasses}>Holdout Ratio</label>
            <input
              type="number"
              min="0"
              max="0.5"
              step="0.05"
              value={holdoutRatio}
              onChange={e => setHoldoutRatio(parseFloat(e.target.value))}
              className={inputClasses}
            />
          </div>
        </div>
      </div>

      {/* Model & Training */}
      <div className={sectionClasses}>
        <h4 className="font-medium text-icon6">Model Configuration</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClasses}>Base Model</label>
            <select value={baseModel} onChange={e => setBaseModel(e.target.value)} className={inputClasses}>
              {baseModels.map(model => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClasses}>Epochs</label>
            <input
              type="number"
              min="1"
              max="10"
              value={epochs}
              onChange={e => setEpochs(parseInt(e.target.value))}
              className={inputClasses}
            />
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-3 pt-2">
        <Button
          type="submit"
          variant="light"
          size="lg"
          disabled={disabled || isSubmitting || selectedScorers.length === 0}
        >
          <Icon className={isSubmitting ? 'animate-spin' : ''}>{isSubmitting ? <LoaderIcon /> : <PlayIcon />}</Icon>
          {isSubmitting ? 'Starting Training...' : 'Start Training'}
        </Button>
      </div>
    </form>
  );
}
