import { cn } from '@/lib/utils';
import { Skeleton } from '@/ds/components/Skeleton';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useMemoryConfig } from '@/domains/memory/hooks';
import { SemanticRecall } from '@mastra/core/memory';

interface MemoryConfigSection {
  title: string;
  items: Array<{
    label: string;
    value: string | number | boolean | undefined;
    badge?: 'success' | 'info' | 'warning';
  }>;
}

interface AgentMemoryConfigProps {
  agentId: string;
}

export const AgentMemoryConfig = ({ agentId }: AgentMemoryConfigProps) => {
  const { data, isLoading } = useMemoryConfig(agentId);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['General', 'Semantic Recall']));

  const config = data?.config;
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
    const omConfig = (config as any).observationalMemory;
    if (omConfig?.enabled) {
      const formatThreshold = (threshold: number | { min: number; max: number } | undefined) => {
        if (!threshold) return 'Default';
        if (typeof threshold === 'number') return `${threshold.toLocaleString()} tokens`;
        return `${threshold.min.toLocaleString()}-${threshold.max.toLocaleString()} tokens`;
      };

      sections.push({
        title: 'Observational Memory',
        items: [
          { label: 'Enabled', value: true, badge: 'success' },
          { label: 'Scope', value: omConfig.scope || 'resource' },
          { label: 'Observation Threshold', value: formatThreshold(omConfig.observationThreshold) },
          { label: 'Reflection Threshold', value: formatThreshold(omConfig.reflectionThreshold) },
          ...(omConfig.observerModel ? [{ label: 'Observer Model', value: omConfig.observerModel }] : []),
          ...(omConfig.reflectorModel ? [{ label: 'Reflector Model', value: omConfig.reflectorModel }] : []),
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

  const renderValue = (value: string | number | boolean, badge?: 'success' | 'info' | 'warning') => {
    if (typeof value === 'boolean') {
      return (
        <span
          className={cn(
            'text-xs font-medium px-2 py-0.5 rounded',
            value
              ? badge === 'info'
                ? 'bg-blue-500/20 text-blue-400'
                : 'bg-green-500/20 text-green-400'
              : 'bg-red-500/20 text-red-400',
          )}
        >
          {value ? 'Yes' : 'No'}
        </span>
      );
    }

    if (badge) {
      const badgeColors = {
        success: 'bg-green-500/20 text-green-400',
        info: 'bg-blue-500/20 text-blue-400',
        warning: 'bg-yellow-500/20 text-yellow-400',
      };
      return <span className={cn('text-xs font-medium px-2 py-0.5 rounded', badgeColors[badge])}>{value}</span>;
    }

    return <span className="text-xs text-neutral3">{value}</span>;
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
        <h3 className="text-sm font-medium text-neutral5 mb-3">Memory Configuration</h3>
        <p className="text-xs text-neutral3">No memory configuration available</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h3 className="text-sm font-medium text-neutral5 mb-3">Memory Configuration</h3>
      <div className="space-y-2">
        {configSections.map(section => (
          <div key={section.title} className="border border-border1 rounded-lg bg-surface3">
            <button
              onClick={() => toggleSection(section.title)}
              className="w-full px-3 py-2 flex items-center justify-between hover:bg-surface4 transition-colors rounded-t-lg"
            >
              <span className="text-xs font-medium text-neutral5">{section.title}</span>
              {expandedSections.has(section.title) ? (
                <ChevronDown className="w-3 h-3 text-neutral3" />
              ) : (
                <ChevronRight className="w-3 h-3 text-neutral3" />
              )}
            </button>
            {expandedSections.has(section.title) && (
              <div className="px-3 pb-2 space-y-1">
                {section.items.map(item => (
                  <div key={`${section.title}-${item.label}`} className="flex items-center justify-between py-1">
                    <span className="text-xs text-neutral3">{item.label}</span>
                    {renderValue(item.value ?? '', item.badge)}
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
