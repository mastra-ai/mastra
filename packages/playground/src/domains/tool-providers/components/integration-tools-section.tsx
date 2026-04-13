import {
  Badge,
  Entity,
  EntityContent,
  EntityName,
  EntityDescription,
  Section,
  SubSectionRoot,
  stringToColor,
} from '@mastra/playground-ui';
import { Plug } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useToolProviders } from '../hooks/use-tool-providers';
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
            const bg = stringToColor(provider.name);
            const text = stringToColor(provider.name, 25);
            const count = toolCountsByProvider[provider.id] ?? 0;

            return (
              <Entity key={provider.id} onClick={() => setSelectedProvider(provider)} className="bg-surface2">
                <div
                  className="size-11 rounded-lg flex items-center justify-center uppercase shrink-0"
                  style={{ backgroundColor: bg, color: text }}
                >
                  {provider.name[0]}
                </div>

                <EntityContent>
                  <EntityName>{provider.name}</EntityName>
                  {provider.description && <EntityDescription>{provider.description}</EntityDescription>}
                </EntityContent>

                <div className="flex items-center gap-2">
                  {count > 0 && (
                    <Badge variant="default">
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
