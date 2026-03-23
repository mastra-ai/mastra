import {
  Button,
  ButtonWithTooltip,
  DocsIcon,
  HeaderAction,
  Icon,
  MainContentContent,
  useScorers,
  Header,
  HeaderTitle,
  MainContentLayout,
  ScorersTable,
  ScorersList,
  ListSearch,
  MainHeader,
  EntityListPageLayout,
} from '@mastra/playground-ui';
import { useExperimentalUI } from '@/domains/experimental-ui/experimental-ui-context';
import { BookIcon, GaugeIcon, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

export default function Scorers() {
  const { data: scorers = {}, isLoading, error } = useScorers();
  const { variant } = useExperimentalUI('entity-list-page');
  const [search, setSearch] = useState('');

  if (variant === 'new-proposal') {
    return (
      <EntityListPageLayout>
        <EntityListPageLayout.Top>
          <MainHeader withMargins={false}>
            <MainHeader.Column>
              <MainHeader.Title isLoading={isLoading}>
                <GaugeIcon /> Scorers
              </MainHeader.Title>
            </MainHeader.Column>
            <MainHeader.Column className="flex justify-end gap-2">
              <ButtonWithTooltip
                as="a"
                href="https://mastra.ai/en/docs/evals/overview"
                target="_blank"
                rel="noopener noreferrer"
                tooltipContent="Go to Scorers documentation"
              >
                <BookIcon />
              </ButtonWithTooltip>
              {isCmsAvailable && (
                <Button as={Link} to="/cms/scorers/create" variant="primary">
                  <Plus />
                  Create Scorer
                </Button>
              )}
            </MainHeader.Column>
          </MainHeader>
          <div className="max-w-[30rem]">
            <ListSearch onSearch={setSearch} label="Filter scorers" placeholder="Filter by name" />
          </div>
        </EntityListPageLayout.Top>

        <ScorersList scorers={scorers} isLoading={isLoading} error={error} search={search} onSearch={setSearch} />
      </EntityListPageLayout>
    );
  }

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>
          <Icon>
            <GaugeIcon />
          </Icon>
          Scorers
        </HeaderTitle>

        <HeaderAction>
          <Button as={Link} to="https://mastra.ai/en/docs/evals/overview" target="_blank" variant="ghost" size="md">
            <DocsIcon />
            Scorers documentation
          </Button>
        </HeaderAction>
      </Header>

      <MainContentContent isCentered={!isLoading && Object.keys(scorers || {}).length === 0}>
        <ScorersTable isLoading={isLoading} scorers={scorers} error={error} />
      </MainContentContent>
    </MainContentLayout>
  );
}
