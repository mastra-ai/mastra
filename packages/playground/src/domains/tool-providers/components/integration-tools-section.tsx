import { Badge } from '@mastra/playground-ui/components/Badge';
import { Entity, EntityContent, EntityName, EntityDescription } from '@mastra/playground-ui/components/Entity';
import { Section, SubSectionRoot } from '@mastra/playground-ui/components/Section';
import { cn } from '@mastra/playground-ui/utils/cn';
import { hueFillClass, hueForName } from '@mastra/playground-ui/utils/colors';
import { useToolProviders } from '@mastra/react/hooks/tool-providers';
import { Plug } from 'lucide-react';
import { useMemo, useState } from 'react';

import { ToolProviderDialog } from './tool-provider-dialog';
import { SubSectionHeader } from '@/domains/cms/components/section/section-header';

interface Provider {
  id: string;
  name: string;
  description?: string;
}

interface IntegrationToolsSectionProps {
  selectedToolIds?: Record<string, { description?: string }>;
  onSubmitTools?: (providerId: string, tools: Map<string, string>) => void;
}

export function IntegrationToolsSection({ selectedToolIds, onSubmitTools }: IntegrationToolsSectionProps) {
  const { data, isLoading } = useToolProviders();
  const providers = data?.providers ?? [];
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);

  const toolCountsByProvider = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!selectedToolIds) return counts;
    for (const key of Object.keys(selectedToolIds)) {
      const sep = key.indexOf(':');
      if (sep === -1) continue;
      const providerId = key.slice(0, sep);
      counts[providerId] = (counts[providerId] ?? 0) + 1;
    }
    return counts;
  }, [selectedToolIds]);

  if (isLoading || providers.length === 0) {
    return null;
  }

  return (
    <>
      <SubSectionRoot>
        <Section.Header>
          <SubSectionHeader title="Integration Tools" icon={<Plug />} />
        </Section.Header>

        <div className="flex flex-col gap-1">
          {providers.map(provider => {
            const count = toolCountsByProvider[provider.id] ?? 0;

            return (
              <Entity key={provider.id} onClick={() => setSelectedProvider(provider)}>
                <div
                  className={cn(
                    'flex size-11 shrink-0 items-center justify-center rounded-lg uppercase shadow-inset',
                    hueFillClass(hueForName(provider.name)),
                  )}
                >
                  {provider.name[0]}
                </div>

                <EntityContent>
                  <EntityName>{provider.name}</EntityName>
                  {provider.description && <EntityDescription>{provider.description}</EntityDescription>}
                </EntityContent>

                <div className="flex items-center gap-2">
                  {count > 0 && (
                    <Badge>
                      {count} {count === 1 ? 'tool' : 'tools'}
                    </Badge>
                  )}
                  <Badge variant="success">Available</Badge>
                </div>
              </Entity>
            );
          })}
        </div>
      </SubSectionRoot>

      <ToolProviderDialog
        provider={selectedProvider}
        onClose={() => setSelectedProvider(null)}
        selectedToolIds={selectedToolIds}
        onSubmit={onSubmitTools}
      />
    </>
  );
}
