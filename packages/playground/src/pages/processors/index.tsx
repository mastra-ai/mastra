import {
  MainContentLayout,
  Header,
  HeaderTitle,
  MainContentContent,
  Icon,
  HeaderAction,
  DocsIcon,
  Button,
  ButtonWithTooltip,
  ProcessorTable,
  ProcessorsList,
  ProcessorIcon,
  ListSearch,
  MainHeader,
  EntityListPageLayout,
  useProcessors,
} from '@mastra/playground-ui';
import { useExperimentalUI } from '@/domains/experimental-ui/experimental-ui-context';
import { BookIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

export function Processors() {
  const { data: processors = {}, isLoading, error } = useProcessors();
  const { variant } = useExperimentalUI('entity-list-page');
  const [search, setSearch] = useState('');

  const isEmpty = !isLoading && Object.keys(processors).length === 0;

  if (variant === 'new-proposal') {
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
                href="https://mastra.ai/docs/agents/processors"
                target="_blank"
                rel="noopener noreferrer"
                tooltipContent="Go to Processors documentation"
              >
                <BookIcon />
              </ButtonWithTooltip>
            </MainHeader.Column>
          </MainHeader>
          <div className="max-w-[30rem]">
            <ListSearch onSearch={setSearch} label="Filter processors" placeholder="Filter by name" />
          </div>
        </EntityListPageLayout.Top>

        <ProcessorsList processors={processors} isLoading={isLoading} error={error} search={search} onSearch={setSearch} />
      </EntityListPageLayout>
    );
  }

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>
          <Icon>
            <ProcessorIcon />
          </Icon>
          Processors
        </HeaderTitle>

        <HeaderAction>
          <Button
            as={Link}
            to="https://mastra.ai/docs/agents/processors"
            target="_blank"
            rel="noopener noreferrer"
            variant="ghost"
            size="md"
          >
            <DocsIcon />
            Processors documentation
          </Button>
        </HeaderAction>
      </Header>

      <MainContentContent isCentered={isEmpty}>
        <ProcessorTable processors={processors} isLoading={isLoading} error={error} />
      </MainContentContent>
    </MainContentLayout>
  );
}
