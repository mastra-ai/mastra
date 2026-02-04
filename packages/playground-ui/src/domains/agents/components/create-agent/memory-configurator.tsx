import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ds/components/Select';
import { Input } from '@/ds/components/Input';
import { Label } from '@/ds/components/Label';
import { Switch } from '@/ds/components/Switch';
import { Card } from '@/ds/components/Card';
import type { SerializedMemoryConfig } from '@mastra/client-js';

interface MemoryConfiguratorProps {
  value?: SerializedMemoryConfig;
  onChange: (value: SerializedMemoryConfig | undefined) => void;
  availableVectors?: Array<{ id: string; name: string }>;
  availableEmbedders?: Array<{ id: string; name: string }>;
}

export function MemoryConfigurator({
  value,
  onChange,
  availableVectors = [],
  availableEmbedders = [],
}: MemoryConfiguratorProps) {
  const handleEnabledChange = (enabled: boolean) => {
    if (enabled) {
      onChange({
        vector: availableVectors[0]?.id || undefined,
        options: {
          lastMessages: 10,
          readOnly: false,
          semanticRecall: false,
          generateTitle: false,
        },
      });
    } else {
      onChange(undefined);
    }
  };

  const handleVectorChange = (vectorId: string) => {
    onChange({
      ...value,
      vector: vectorId === 'none' ? false : vectorId,
    });
  };

  const handleEmbedderChange = (embedderId: string) => {
    onChange({
      ...value,
      embedder: embedderId === 'none' ? undefined : embedderId,
    });
  };

  const handleOptionsChange = (key: keyof NonNullable<SerializedMemoryConfig['options']>, val: any) => {
    if (!value) return;
    onChange({
      ...value,
      options: {
        ...value?.options,
        [key]: val,
      },
    });
  };

  const semanticRecallEnabled = value?.options?.semanticRecall !== false && value?.options?.semanticRecall !== undefined;
  const generateTitleEnabled = value?.options?.generateTitle !== false && value?.options?.generateTitle !== undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label htmlFor="memory-enabled">Enable Memory</Label>
        <Switch
          id="memory-enabled"
          checked={value !== undefined}
          onCheckedChange={handleEnabledChange}
        />
      </div>

      {value && (
        <Card className="p-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="vector-store">Vector Store</Label>
            <Select value={value.vector === false ? 'none' : (value.vector || 'none')} onValueChange={handleVectorChange}>
              <SelectTrigger id="vector-store">
                <SelectValue placeholder="Select vector store" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {(availableVectors || []).map(v => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="last-messages">Last Messages</Label>
            <Input
              id="last-messages"
              type="number"
              min={0}
              value={value.options?.lastMessages === false ? 0 : (value.options?.lastMessages || 10)}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const val = parseInt(e.target.value, 10);
                handleOptionsChange('lastMessages', val === 0 ? false : val);
              }}
              placeholder="Number of recent messages to include"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="read-only"
              checked={value.options?.readOnly || false}
              onCheckedChange={(checked: boolean) => handleOptionsChange('readOnly', checked)}
            />
            <Label htmlFor="read-only">Read Only</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="semantic-recall"
              checked={semanticRecallEnabled}
              onCheckedChange={(checked: boolean) => {
                if (checked) {
                  handleOptionsChange('semanticRecall', {
                    topK: 5,
                    messageRange: 20,
                    scope: 'thread' as const,
                    threshold: 0.7,
                  });
                } else {
                  handleOptionsChange('semanticRecall', false);
                }
              }}
            />
            <Label htmlFor="semantic-recall">Enable Semantic Recall</Label>
          </div>

          {semanticRecallEnabled && typeof value.options?.semanticRecall === 'object' && (
            <Card className="p-3 space-y-3 bg-muted/50">
              <div className="space-y-2">
                <Label htmlFor="embedder">Embedder (Required for Semantic Recall)</Label>
                <Select value={value.embedder || 'none'} onValueChange={handleEmbedderChange}>
                  <SelectTrigger id="embedder">
                    <SelectValue placeholder="Select embedder" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {(availableEmbedders || []).map(e => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="topk">Top K Results</Label>
                <Input
                  id="topk"
                  type="number"
                  min={1}
                  value={value.options.semanticRecall.topK || 5}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const topK = parseInt(e.target.value, 10) || 5;
                  if (typeof value.options?.semanticRecall === 'object') {
                    handleOptionsChange('semanticRecall', {
                      ...value.options.semanticRecall,
                      topK,
                    });
                  }
                }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message-range">Message Range</Label>
                <Input
                  id="message-range"
                  type="number"
                  min={1}
                  value={
                    typeof value.options.semanticRecall.messageRange === 'number'
                      ? value.options.semanticRecall.messageRange
                      : 20
                  }
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const range = parseInt(e.target.value, 10) || 20;
                  if (typeof value.options?.semanticRecall === 'object') {
                    handleOptionsChange('semanticRecall', {
                      ...value.options.semanticRecall,
                      messageRange: range,
                    });
                  }
                }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="threshold">Similarity Threshold</Label>
                <Input
                  id="threshold"
                  type="number"
                  min={0}
                  max={1}
                  step={0.1}
                  value={value.options.semanticRecall.threshold || 0.7}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const threshold = parseFloat(e.target.value) || 0.7;
                  if (typeof value.options?.semanticRecall === 'object') {
                    handleOptionsChange('semanticRecall', {
                      ...value.options.semanticRecall,
                      threshold,
                    });
                  }
                }}
                />
              </div>
            </Card>
          )}

          <div className="flex items-center space-x-2">
            <Switch
              id="generate-title"
              checked={generateTitleEnabled}
              onCheckedChange={(checked: boolean) => {
                if (checked) {
                  handleOptionsChange('generateTitle', true);
                } else {
                  handleOptionsChange('generateTitle', false);
                }
              }}
            />
            <Label htmlFor="generate-title">Generate Thread Titles</Label>
          </div>
        </Card>
      )}
    </div>
  );
}