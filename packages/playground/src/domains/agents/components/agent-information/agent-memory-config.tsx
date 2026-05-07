import type { SemanticRecall } from '@mastra/core/memory';
import { Skeleton, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, Icon, cn } from '@mastra/playground-ui';
import { ChevronRight, ChevronDown, InfoIcon } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useMemoryConfig } from '@/domains/memory/hooks';
import { useLinkComponent } from '@/lib/framework';

interface MemoryConfigItem {
  label: string;
  value: string | number | boolean | undefined;
  badge?: 'success' | 'info' | 'warning';
  hint?: { link: string; title: string };
  children?: Array<{ label: string; value: string | number }>;
}

interface MemoryConfigSection {
  title: string;
  items: MemoryConfigItem[];
}

interface AgentMemoryConfigProps {
  agentId: string;
}

export const AgentMemoryConfig = ({ agentId }: AgentMemoryConfigProps) => {
  const { Link } = useLinkComponent();
  const { data, isLoading } = useMemoryConfig(agentId);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['Memory Configuration']),
  );

  const config = data?.config;
  const configSections: MemoryConfigSection[] = useMemo(() => {
    if (!config) return [];

    const isSemanticRecallEnabled = Boolean(config.semanticRecall);
    const isWorkingMemoryEnabled = Boolean(config.workingMemory?.enabled);
    const isOMEnabled =
      typeof config.observationalMemory === 'object' && Boolean(config.observationalMemory?.enabled);

    const sections: MemoryConfigSection[] = [
      {
        title: 'Memory Configuration',
        items: [
          { label: 'Last Messages', value: config.lastMessages || 0 },
          {
            label: 'Auto-generate Titles',
            value: !!config.generateTitle,
            badge: config.generateTitle ? 'info' : undefined,
          },
          {
            label: 'Semantic Recall',
            value: isSemanticRecallEnabled,
            badge: isSemanticRecallEnabled ? 'success' : undefined,
            hint: { link: 'https://mastra.ai/en/docs/memory/semantic-recall', title: 'Learn about semantic recall' },
            ...(isSemanticRecallEnabled
              ? {
                  children: (() => {
                    const sr =
                      typeof config.semanticRecall === 'object' ? config.semanticRecall : ({} as SemanticRecall);
                    const messageRange =
                      typeof sr.messageRange === 'object'
                        ? `${sr.messageRange.before || 1} before, ${sr.messageRange.after || 1} after`
                        : sr.messageRange !== undefined
                          ? `${sr.messageRange} before, ${sr.messageRange} after`
                          : '1 before, 1 after';
                    return [
                      { label: 'Scope', value: sr.scope || 'resource' },
                      { label: 'Top K Results', value: sr.topK || 4 },
                      { label: 'Message Range', value: messageRange },
                    ];
                  })(),
                }
              : {}),
          },
          {
            label: 'Working Memory',
            value: isWorkingMemoryEnabled,
            badge: isWorkingMemoryEnabled ? 'success' : undefined,
            hint: { link: 'https://mastra.ai/en/docs/memory/working-memory', title: 'Learn about working memory' },
          },
          {
            label: 'Observational Memory',
            value: isOMEnabled,
            badge: isOMEnabled ? 'success' : undefined,
          },
        ],
      },
    ];

    const omConfig = config.observationalMemory;
    if (typeof omConfig === 'object' && omConfig?.enabled) {
      const formatThreshold = (threshold: number | { min: number; max: number } | undefined) => {
        if (!threshold) return 'Default';
        if (typeof threshold === 'number') return `${threshold.toLocaleString()} tokens`;
        return `${threshold.min.toLocaleString()}-${threshold.max.toLocaleString()} tokens`;
      };

      const observationModel = omConfig.model || omConfig.observation?.model;
      const reflectionModel = omConfig.model || omConfig.reflection?.model;

      sections.push({
        title: 'Observational Memory',
        items: [
          { label: 'Enabled', value: true, badge: 'success' },
          { label: 'Scope', value: omConfig.scope || 'thread' },
          { label: 'Message Tokens', value: formatThreshold(omConfig.observation?.messageTokens) },
          { label: 'Observation Tokens', value: formatThreshold(omConfig.reflection?.observationTokens) },
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

  const renderValue = (value: string | number | boolean, badge?: 'success' | 'info' | 'warning') => {
    if (typeof value === 'boolean') {
      return (
        <span
          className={cn(
            'text-xs font-medium px-2 py-0.5 rounded',
            value
              ? badge === 'info'
                ? 'dark:bg-blue-500/20 dark:text-blue-400 bg-blue-500/10 text-blue-600'
                : 'dark:bg-green-500/20 dark:text-green-400 bg-green-500/10 text-green-600'
              : 'text-neutral3',
          )}
        >
          {value ? 'On' : 'Off'}
        </span>
      );
    }

    if (badge) {
      const badgeColors = {
        success: 'dark:bg-green-500/20 dark:text-green-400 bg-green-500/10 text-green-600',
        info: 'dark:bg-blue-500/20 dark:text-blue-400 bg-blue-500/10 text-blue-600',
        warning: 'dark:bg-yellow-500/20 dark:text-yellow-400 bg-yellow-500/10 text-yellow-600',
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
        <p className="text-xs text-neutral3">No memory configuration available</p>
      </div>
    );
  }

  return (
    <div className="p-4">
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
                  <div key={`${section.title}-${item.label}`}>
                    <div className="flex items-center justify-between py-1">
                      <span className="text-xs text-neutral3 flex items-center gap-1">
                        {item.label}
                        {item.hint && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Link href={item.hint.link} target="_blank" rel="noopener noreferrer">
                                  <Icon className="text-neutral3" size="sm">
                                    <InfoIcon />
                                  </Icon>
                                </Link>
                              </TooltipTrigger>
                              <TooltipContent>{item.hint.title}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </span>
                      {renderValue(item.value ?? '', item.badge)}
                    </div>
                    {item.children && (
                      <div className="ml-3 pl-2 border-l border-border1 space-y-0.5 mb-1">
                        {item.children.map(child => (
                          <div
                            key={`${item.label}-${child.label}`}
                            className="flex items-center justify-between py-0.5"
                          >
                            <span className="text-xs text-neutral3">{child.label}</span>
                            <span className="text-xs text-neutral3">{child.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
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
