import { EntityListPageLayout, ListSearch, PageHeader } from '@mastra/playground-ui';
import { LibraryIcon } from 'lucide-react';
import { useState } from 'react';
import { AgentBuilderLibraryList } from '@/domains/agent-builder/components/agent-builder-library/agent-builder-library-list';
import { libraryAgentsFixture } from '@/domains/agent-builder/fixtures/library-agents';

export default function AgentBuilderLibraryPage() {
  const [search, setSearch] = useState('');

  return (
    <EntityListPageLayout>
      <EntityListPageLayout.Top>
        <div className="flex items-start justify-between gap-4">
          <PageHeader>
            <PageHeader.Title>
              <LibraryIcon /> Library
            </PageHeader.Title>
            <PageHeader.Description>Agents shared with the team library.</PageHeader.Description>
          </PageHeader>
        </div>
        <div className="max-w-120">
          <ListSearch
            onSearch={setSearch}
            label="Filter library"
            placeholder="Filter by name, description, or owner"
          />
        </div>
      </EntityListPageLayout.Top>

      <AgentBuilderLibraryList agents={libraryAgentsFixture} search={search} />
    </EntityListPageLayout>
  );
}
