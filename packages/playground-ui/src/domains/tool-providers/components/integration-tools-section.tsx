import { useState } from 'react';
import { Plug } from 'lucide-react';

import { Section } from '@/ds/components/Section';
import { Entity, EntityIcon, EntityContent, EntityName, EntityDescription } from '@/ds/components/Entity';

import { useToolProviders } from '../hooks/use-tool-providers';
import { ToolProviderDialog } from './tool-provider-dialog';

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
      <Section>
        <Section.Header>
          <Section.Heading>
            <Plug />
            Integration Tools
          </Section.Heading>
        </Section.Header>

        <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {providers.map(provider => (
            <Entity key={provider.id} onClick={() => setSelectedProvider(provider)}>
              <EntityIcon>
                <Plug />
              </EntityIcon>
              <EntityContent>
                <EntityName>{provider.name}</EntityName>
                {provider.description && <EntityDescription>{provider.description}</EntityDescription>}
              </EntityContent>
            </Entity>
          ))}
        </div>
      </Section>

      <ToolProviderDialog
        provider={selectedProvider}
        onClose={() => setSelectedProvider(null)}
        selectedToolIds={selectedToolIds}
        onSubmit={onSubmitTools}
      />
    </>
  );
}
