import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useMemoryConfig } from '@/hooks/use-memory';

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
  const { config, isLoading } = useMemoryConfig(agentId);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['General', 'Semantic Recall']));

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
            value: !!config.threads?.generateTitle,
            badge: config.threads?.generateTitle ? 'info' : undefined,
          },
        ],
      },
    ];

    // Semantic Recall section
    if (config.semanticRecall !== undefined) {
      const semanticRecall = typeof config.semanticRecall === 'object' ? config.semanticRecall : {};
      const enabled = config.semanticRecall !== false;

      sections.push({
        title: 'Semantic Recall',
        items: [
          { label: 'Enabled', value: enabled, badge: enabled ? 'success' : undefined },
          ...(enabled
            ? [
                { label: 'Scope', value: semanticRecall.scope || 'thread' },
                { label: 'Top K Results', value: semanticRecall.topK || 5 },
                {
                  label: 'Message Range',
                  value:
                    typeof semanticRecall.messageRange === 'object'
                      ? `${semanticRecall.messageRange.before || 0} before, ${semanticRecall.messageRange.after || 0} after`
                      : `${semanticRecall.messageRange || 20} messages`,
                },
              ]
            : []),
        ],
      });
    }

    // Working Memory section
    if (config.workingMemory) {
      sections.push({
        title: 'Working Memory',
        items: [
          {
            label: 'Enabled',
            value: config.workingMemory.enabled,
            badge: config.workingMemory.enabled ? 'success' : undefined,
          },
          ...(config.workingMemory.enabled
            ? [
                { label: 'Scope', value: config.workingMemory.scope || 'thread' },
                { label: 'Template', value: config.workingMemory.template || 'default' },
              ]
            : []),
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

    return <span className="text-xs text-icon3">{value}</span>;
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
        <h3 className="text-sm font-medium text-icon5 mb-3">Memory Configuration</h3>
        <p className="text-xs text-icon3">No memory configuration available</p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <h3 className="text-sm font-medium text-icon5 mb-3">Memory Configuration</h3>
      <div className="space-y-2">
        {configSections.map(section => (
          <div key={section.title} className="border border-border1 rounded-lg bg-surface3">
            <button
              onClick={() => toggleSection(section.title)}
              className="w-full px-3 py-2 flex items-center justify-between hover:bg-surface4 transition-colors rounded-t-lg"
            >
              <span className="text-xs font-medium text-icon5">{section.title}</span>
              {expandedSections.has(section.title) ? (
                <ChevronDown className="w-3 h-3 text-icon3" />
              ) : (
                <ChevronRight className="w-3 h-3 text-icon3" />
              )}
            </button>
            {expandedSections.has(section.title) && (
              <div className="px-3 pb-2 space-y-1">
                {section.items.map((item, index) => (
                  <div key={`${section.title}-${item.label}`} className="flex items-center justify-between py-1">
                    <span className="text-xs text-icon3">{item.label}</span>
                    {renderValue(item.value, item.badge)}
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
