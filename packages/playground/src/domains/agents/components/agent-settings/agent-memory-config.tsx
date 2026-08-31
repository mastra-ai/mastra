import type { SemanticRecall } from '@mastra/core/memory';
import { Badge } from '@mastra/playground-ui/components/Badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { KeyValueList } from '@mastra/playground-ui/components/KeyValueList';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { ChevronRight } from 'lucide-react';
import { useMemo } from 'react';
import { useMemoryConfig } from '@/domains/memory/hooks';

interface MemoryConfigSection {
  title: string;
  items: Array<{
    label: string;
    value: MemoryConfigItemValue | undefined;
    badge?: MemoryConfigBadge;
  }>;
}

type MemoryConfigBadge = 'success' | 'info' | 'warning';
type MemoryConfigItemValue = string | number | boolean;

interface AgentMemoryConfigProps {
  agentId: string;
}

type DisplayMemoryConfig = {
  lastMessages?: number | false;
  generateTitle?: boolean;
  semanticRecall?: SemanticRecall | boolean;
  observationalMemory?:
    | boolean
    | {
        enabled?: boolean;
        scope?: 'resource' | 'thread';
        model?: unknown;
        observationModel?: string;
        reflectionModel?: string;
        observation?: {
          model?: unknown;
          messageTokens?: number | { min: number; max: number };
        };
        reflection?: {
          model?: unknown;
          observationTokens?: number | { min: number; max: number };
        };
      };
};

const formatThreshold = (threshold: number | { min: number; max: number } | undefined) => {
  if (threshold === undefined) return 'Default';
  if (typeof threshold === 'number') return `${threshold.toLocaleString()} tokens`;
  return `${threshold.min.toLocaleString()}-${threshold.max.toLocaleString()} tokens`;
};

const badgeVariants: Record<MemoryConfigBadge, 'green' | 'blue' | 'yellow'> = {
  success: 'green',
  info: 'blue',
  warning: 'yellow',
};

function MemoryConfigValue({ value, badge }: { value: MemoryConfigItemValue; badge?: MemoryConfigBadge }) {
  if (typeof value === 'boolean') {
    return (
      <Badge size="xs" indicator="dot" variant={value ? (badge ? badgeVariants[badge] : 'green') : 'red'}>
        {value ? 'Yes' : 'No'}
      </Badge>
    );
  }

  if (badge) {
    return (
      <Badge size="xs" variant={badgeVariants[badge]}>
        {value}
      </Badge>
    );
  }

  return <>{value}</>;
}

export const AgentMemoryConfig = ({ agentId }: AgentMemoryConfigProps) => {
  const { data, isLoading } = useMemoryConfig(agentId);

  const config = data?.config as DisplayMemoryConfig | undefined;
  const configSections: MemoryConfigSection[] = useMemo(() => {
    if (!config) return [];

    // Memory is enabled if we have a config
    const memoryEnabled = !!config;

    const sections: MemoryConfigSection[] = [
      {
        title: 'General',
        items: [
          { label: 'Memory Enabled', value: memoryEnabled, badge: memoryEnabled ? 'success' : undefined },
          { label: 'Last Messages', value: config.lastMessages || 0 },
          {
            label: 'Auto-generate Titles',
            value: !!config.generateTitle,
            badge: config.generateTitle ? 'info' : undefined,
          },
        ],
      },
    ];

    // Semantic Recall section
    if (config.semanticRecall) {
      const enabled = Boolean(config.semanticRecall);
      const semanticRecall = typeof config.semanticRecall === 'object' ? config.semanticRecall : ({} as SemanticRecall);

      sections.push({
        title: 'Semantic Recall',
        items: [
          { label: 'Enabled', value: enabled, badge: enabled ? 'success' : undefined },
          ...(enabled
            ? [
                { label: 'Scope', value: semanticRecall.scope || 'resource' },
                { label: 'Top K Results', value: semanticRecall.topK || 4 },
                {
                  label: 'Message Range',
                  value:
                    typeof semanticRecall.messageRange === 'object'
                      ? `${semanticRecall.messageRange.before || 1} before, ${semanticRecall.messageRange.after || 1} after`
                      : semanticRecall.messageRange !== undefined
                        ? `${semanticRecall.messageRange} before, ${semanticRecall.messageRange} after`
                        : '1 before, 1 after',
                },
              ]
            : []),
        ],
      });
    }

    // Observational Memory section
    const omConfig = config.observationalMemory;
    const isOmConfigObject = omConfig !== null && typeof omConfig === 'object';
    const isObservationalMemoryEnabled = omConfig === true || (isOmConfigObject && omConfig.enabled !== false);

    if (isObservationalMemoryEnabled) {
      const observationModel = isOmConfigObject
        ? omConfig.observationModel || omConfig.model || omConfig.observation?.model
        : undefined;
      const reflectionModel = isOmConfigObject
        ? omConfig.reflectionModel || omConfig.model || omConfig.reflection?.model
        : undefined;

      sections.push({
        title: 'Observational Memory',
        items: [
          { label: 'Enabled', value: true, badge: 'success' },
          { label: 'Scope', value: isOmConfigObject ? omConfig.scope || 'thread' : 'thread' },
          {
            label: 'Message Tokens',
            value: formatThreshold(isOmConfigObject ? omConfig.observation?.messageTokens : undefined),
          },
          {
            label: 'Observation Tokens',
            value: formatThreshold(isOmConfigObject ? omConfig.reflection?.observationTokens : undefined),
          },
          ...(observationModel ? [{ label: 'Observation Model', value: String(observationModel) }] : []),
          ...(reflectionModel ? [{ label: 'Reflection Model', value: String(reflectionModel) }] : []),
        ],
      });
    }

    return sections;
  }, [config]);

  if (isLoading) {
    return (
      <div className="p-4">
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!config || configSections.length === 0) {
    return (
      <div className="p-4">
        <Txt variant="ui-xs" className="text-neutral3">
          No memory configuration available
        </Txt>
      </div>
    );
  }

  return (
    <div className="divide-border1 divide-y pt-1.5 pb-2">
      {configSections.map(section => (
        <Collapsible key={section.title} defaultOpen={section.title !== 'Observational Memory'}>
          <CollapsibleTrigger className="text-neutral5 flex w-full items-center justify-between px-4 py-2.5">
            <Txt as="span" variant="ui-md" className="font-medium text-inherit">
              {section.title}
            </Txt>
            <ChevronRight className="text-neutral3 size-4" />
          </CollapsibleTrigger>
          <CollapsibleContent className="px-4 pb-3">
            <KeyValueList
              data={section.items.map(item => ({
                key: `${section.title}-${item.label}`,
                label: item.label,
                value: <MemoryConfigValue value={item.value ?? ''} badge={item.badge} />,
              }))}
            />
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  );
};
