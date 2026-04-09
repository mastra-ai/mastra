import {
  ButtonWithTooltip,
  ProcessorsList,
  ProcessorIcon,
  ListSearch,
  MainHeader,
  EntityListPageLayout,
  useProcessors,
} from '@mastra/playground-ui';
import { BookIcon } from 'lucide-react';
import { useState } from 'react';

export function Processors() {
  const { data: processors = {}, isLoading, error } = useProcessors();
  const [search, setSearch] = useState('');

  return (
    <EntityListPageLayout>
      <EntityListPageLayout.Top>
        <MainHeader withMargins={false}>
          <MainHeader.Column>
            <MainHeader.Title isLoading={isLoading}>
              <ProcessorIcon /> Processors
            </MainHeader.Title>
          </MainHeader.Column>
          <MainHeader.Column className="flex justify-end gap-2">
            <ButtonWithTooltip
              as="a"
              href="https://mastra.ai/en/docs/agents/processors"
              target="_blank"
              rel="noopener noreferrer"
              tooltipContent="Go to Processors documentation"
            >
              <BookIcon />
            </ButtonWithTooltip>
          </MainHeader.Column>
        </MainHeader>
        <div className="max-w-120">
          <ListSearch onSearch={setSearch} label="Filter processors" placeholder="Filter by name" />
        </div>
      </EntityListPageLayout.Top>

      <ProcessorsList
        processors={processors}
        isLoading={isLoading}
        error={error}
        search={search}
        onSearch={setSearch}
      />
    </EntityListPageLayout>
  );
}
