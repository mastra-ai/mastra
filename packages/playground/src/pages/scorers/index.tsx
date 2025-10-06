import { Button, DocsIcon, HeaderAction, Icon, useScorers } from '@mastra/playground-ui';
import { Header, HeaderTitle, MainContentLayout, ScorersTable } from '@mastra/playground-ui';
import { GaugeIcon } from 'lucide-react';
import { Link } from 'react-router';

export default function Scorers() {
  const { data: scorers = {}, isLoading } = useScorers();

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
          <Button as={Link} to="https://mastra.ai/en/docs/scorers/overview" target="_blank">
            <Icon>
              <DocsIcon />
            </Icon>
            Scorers documentation
          </Button>
        </HeaderAction>
      </Header>

      <ScorersTable isLoading={isLoading} scorers={scorers} />
    </MainContentLayout>
  );
}
