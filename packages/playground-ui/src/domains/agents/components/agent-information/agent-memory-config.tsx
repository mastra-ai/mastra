import { Skeleton } from '@/ds/components/Skeleton';
import { Badge } from '@/ds/components/Badge';
import { Txt } from '@/ds/components/Txt';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/ds/components/Collapsible';
import { ChevronRight } from 'lucide-react';
import { useMemo } from 'react';
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

    return sections;
  }, [config]);

  const renderValue = (value: string | number | boolean, badge?: 'success' | 'info' | 'warning') => {
    if (typeof value === 'boolean') {
      const variant = value ? (badge === 'info' ? 'info' : 'success') : 'error';
      return <Badge variant={variant}>{value ? 'Yes' : 'No'}</Badge>;
    }

    if (badge) {
      return <Badge variant={badge}>{value}</Badge>;
    }

    return (
      <Txt variant="ui-xs" className="text-neutral3">
        {value}
      </Txt>
    );
  };

  if (isLoading) {
    return (
      <div className="p-4" data-testid="memory-config-loading">
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!config || configSections.length === 0) {
    return (
      <div className="p-4" data-testid="memory-config-empty">
        <Txt as="h3" variant="ui-sm" className="font-medium text-neutral5 mb-3">
          Memory Configuration
        </Txt>
        <Txt variant="ui-xs" className="text-neutral3">
          No memory configuration available
        </Txt>
      </div>
    );
  }

  return (
    <div className="p-4" data-testid="memory-config">
      <Txt as="h3" variant="ui-sm" className="font-medium text-neutral5 mb-3">
        Memory Configuration
      </Txt>
      <div className="space-y-2">
        {configSections.map(section => (
          <Collapsible key={section.title} defaultOpen className="border border-border1 rounded-lg bg-surface3">
            <CollapsibleTrigger className="w-full px-3 py-2 flex items-center justify-between hover:bg-surface4 rounded-t-lg">
              <Txt variant="ui-xs" className="font-medium text-neutral5">
                {section.title}
              </Txt>
              <ChevronRight className="w-3 h-3 text-neutral3" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-3 pb-2 space-y-1">
                {section.items.map(item => (
                  <div
                    key={`${section.title}-${item.label}`}
                    className="flex items-center justify-between py-1"
                    data-testid={`memory-config-item-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Txt variant="ui-xs" className="text-neutral3">
                      {item.label}
                    </Txt>
                    {renderValue(item.value ?? '', item.badge)}
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    </div>
  );
};
