import { useState } from 'react';
import { Plug } from 'lucide-react';

import { Section } from '@/ds/components/Section';
import { Entity, EntityIcon, EntityContent, EntityName, EntityDescription } from '@/ds/components/Entity';

import { useToolProviders } from '../hooks/use-tool-providers';
import { ToolProviderDialog } from './tool-provider-dialog';
import { SubSectionHeader } from '@/domains/cms/components/section/section-header';
import { SubSectionRoot } from '@/ds/components/Section/section-root';
import { stringToColor } from '@/lib/colors';
import { Badge } from '@/ds/components/Badge';

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
            const firstLetter = provider.name.charAt(0).toUpperCase();
            const bg = stringToColor(firstLetter);
            const text = stringToColor(firstLetter, 25);

            return (
              <Entity key={provider.id} onClick={() => setSelectedProvider(provider)} className="bg-surface2">
                <div
                  className="aspect-square h-full rounded-lg flex items-center justify-center uppercase shrink-0"
                  style={{ backgroundColor: bg, color: text }}
                >
                  {firstLetter}
                </div>

                <EntityContent>
                  <EntityName>{provider.name}</EntityName>
                  {provider.description && <EntityDescription>{provider.description}</EntityDescription>}
                </EntityContent>

                <div className="flex items-center">
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
