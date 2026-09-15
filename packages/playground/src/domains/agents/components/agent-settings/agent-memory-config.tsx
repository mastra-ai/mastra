import type { GetMemoryConfigResponse } from '@mastra/client-js';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Button } from '@mastra/playground-ui/components/Button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { KeyValueList } from '@mastra/playground-ui/components/KeyValueList';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ChevronRight } from 'lucide-react';
import { z } from 'zod';
import { useMemoryConfig } from '@/domains/memory/hooks';

interface MemoryConfigSection {
  title: string;
  items: Array<{ label: string; value: string | number | boolean }>;
}

const semanticRecallSchema = z.object({
  scope: z.enum(['resource', 'thread']).optional(),
  topK: z.number().optional(),
  messageRange: z
    .union([z.number(), z.object({ before: z.number().optional(), after: z.number().optional() })])
    .optional(),
});

function formatThreshold(threshold: number | { min: number; max: number } | undefined) {
  if (threshold === undefined) return 'Default';
  if (typeof threshold === 'number') return `${threshold.toLocaleString()} tokens`;
  return `${threshold.min.toLocaleString()}–${threshold.max.toLocaleString()} tokens`;
}

function getMemorySections(config: NonNullable<GetMemoryConfigResponse['config']>) {
  const sections: MemoryConfigSection[] = [
    {
      title: 'General',
      items: [
        { label: 'Status', value: true },
        { label: 'Last Messages', value: config.lastMessages ?? 'Default' },
        { label: 'Auto-generate Titles', value: 'generateTitle' in config && Boolean(config.generateTitle) },
      ],
    },
  ];

  if (config.semanticRecall) {
    const semanticRecall = semanticRecallSchema.parse(config.semanticRecall === true ? {} : config.semanticRecall);
    const messageRange = semanticRecall.messageRange;
    const before = typeof messageRange === 'object' ? messageRange.before : messageRange;
    const after = typeof messageRange === 'object' ? messageRange.after : messageRange;

    sections.push({
      title: 'Semantic Recall',
      items: [
        { label: 'Status', value: true },
        { label: 'Scope', value: semanticRecall.scope ?? 'resource' },
        { label: 'Top K Results', value: semanticRecall.topK ?? 4 },
        { label: 'Message Range', value: `${before ?? 1} before, ${after ?? 1} after` },
      ],
    });
  }

  const observationalMemory = config.observationalMemory;
  if (observationalMemory?.enabled) {
    sections.push({
      title: 'Observational Memory',
      items: [
        { label: 'Status', value: true },
        { label: 'Scope', value: observationalMemory.scope ?? 'thread' },
        { label: 'Message Tokens', value: formatThreshold(observationalMemory.messageTokens) },
        { label: 'Observation Tokens', value: formatThreshold(observationalMemory.observationTokens) },
        ...(observationalMemory.observationModel
          ? [{ label: 'Observation Model', value: observationalMemory.observationModel }]
          : []),
        ...(observationalMemory.reflectionModel
          ? [{ label: 'Reflection Model', value: observationalMemory.reflectionModel }]
          : []),
      ],
    });
  }

  return sections;
}

function formatMemoryValue(value: string | number | boolean) {
  if (typeof value === 'boolean') return value ? 'Enabled' : 'Disabled';
  return value;
}

function MemoryConfigFields({ items }: Pick<MemoryConfigSection, 'items'>) {
  return (
    <KeyValueList
      className="grid-cols-2"
      data={items.map(item => ({
        key: item.label,
        label: (
          <Txt as="span" variant="ui-smd">
            {item.label}
          </Txt>
        ),
        value: (
          <Badge className="h-auto min-h-5 min-w-0 break-words whitespace-normal">
            {formatMemoryValue(item.value)}
          </Badge>
        ),
      }))}
    />
  );
}

export function AgentMemoryConfig({ agentId }: { agentId: string }) {
  const { data, isLoading, isError, isFetching, refetch } = useMemoryConfig(agentId);

  if (isLoading) return <Skeleton className="h-28 w-full" />;

  if (isError) {
    return (
      <div role="alert" className="flex flex-col items-start gap-2">
        <Txt variant="caption">Unable to load memory configuration</Txt>
        <Button size="sm" variant="outline" disabled={isFetching} onClick={() => void refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  if (!data?.config) return <Txt variant="caption">No memory configuration available</Txt>;

  return (
    <div className="flex flex-col gap-3">
      {getMemorySections(data.config).map(section =>
        section.title === 'General' ? (
          <MemoryConfigFields key={section.title} items={section.items} />
        ) : (
          <Collapsible key={section.title} defaultOpen={section.title !== 'Observational Memory'}>
            <CollapsibleTrigger className="flex w-full items-center justify-between gap-2">
              <Txt as="span" variant="ui-smd">
                {section.title}
              </Txt>
              <ChevronRight className="size-4" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <MemoryConfigFields items={section.items} />
            </CollapsibleContent>
          </Collapsible>
        ),
      )}
    </div>
  );
}
