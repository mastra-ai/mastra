import type { SemanticRecall } from '@mastra/core/memory';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { cn } from '@mastra/playground-ui/utils/cn';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { useState, useMemo } from 'react';
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

const badgeColors: Record<MemoryConfigBadge, string> = {
  success: 'bg-green-500/20 text-green-400',
  info: 'bg-blue-500/20 text-blue-400',
  warning: 'bg-yellow-500/20 text-yellow-400',
};

function MemoryConfigValue({ value, badge }: { value: MemoryConfigItemValue; badge?: MemoryConfigBadge }) {
  if (typeof value === 'boolean') {
    return (
      <span
        className={cn(
          'text-xs font-medium px-2 py-0.5 rounded',
          value
            ? badge === 'info'
              ? 'dark:bg-blue-500/20 dark:text-blue-400 bg-blue-500/10 text-blue-600'
              : 'dark:bg-green-500/20 dark:text-green-400 bg-green-500/10 text-green-600'
            : 'dark:bg-red-500/20 dark:text-red-400 bg-red-500/10 text-red-600',
        )}
      >
        {value ? 'Yes' : 'No'}
      </span>
    );
  }

  if (badge) {
    return <span className={cn('text-xs font-medium px-2 py-0.5 rounded', badgeColors[badge])}>{value}</span>;
  }

  return <span className="text-neutral3 text-xs">{value}</span>;
}

export const AgentMemoryConfig = ({ agentId }: AgentMemoryConfigProps) => {
  const { data, isLoading } = useMemoryConfig(agentId);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['General', 'Semantic Recall']));

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

  const toggleSection = (title: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(title)) {
      newExpanded.delete(title);
    } else {
      newExpanded.add(title);
    }
    setExpandedSections(newExpanded);
  };

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
        <h3 className="text-neutral5 mb-3 text-sm font-medium">Memory Configuration</h3>
        <p className="text-neutral3 text-xs">No memory configuration available</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h3 className="text-neutral5 mb-3 text-sm font-medium">Memory Configuration</h3>
      <div className="space-y-2">
        {configSections.map(section => (
          <div key={section.title} className="border-border1 bg-surface3 rounded-lg border">
            <button
              type="button"
              onClick={() => toggleSection(section.title)}
              className="hover:bg-surface4 flex w-full items-center justify-between rounded-t-lg px-3 py-2 transition-colors"
            >
              <span className="text-neutral5 text-xs font-medium">{section.title}</span>
              {expandedSections.has(section.title) ? (
                <ChevronDown className="text-neutral3 h-3 w-3" />
              ) : (
                <ChevronRight className="text-neutral3 h-3 w-3" />
              )}
            </button>
            {expandedSections.has(section.title) && (
              <div className="space-y-1 px-3 pb-2">
                {section.items.map(item => (
                  <div key={`${section.title}-${item.label}`} className="flex items-center justify-between py-1">
                    <span className="text-neutral3 text-xs">{item.label}</span>
                    <MemoryConfigValue value={item.value ?? ''} badge={item.badge} />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
