import {
  Button,
  DocsIcon,
  HeaderAction,
  Icon,
  MainContentContent,
  useScorers,
  CreateScorerDialog,
} from '@mastra/playground-ui';
import { Header, HeaderTitle, MainContentLayout, ScorersTable } from '@mastra/playground-ui';
import { GaugeIcon, Plus } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { useState } from 'react';

export default function Scorers() {
  const { data: scorers = {}, isLoading } = useScorers();
  const navigate = useNavigate();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

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
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Icon>
              <Plus />
            </Icon>
            Create Scorer
          </Button>
          <Button as={Link} to="https://mastra.ai/en/docs/evals/overview" target="_blank">
            <Icon>
              <DocsIcon />
            </Icon>
            Scorers documentation
          </Button>
        </HeaderAction>
      </Header>

      <MainContentContent isCentered={!isLoading && Object.keys(scorers || {}).length === 0}>
        <ScorersTable isLoading={isLoading} scorers={scorers} />
      </MainContentContent>

      <CreateScorerDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={id => navigate(`/scorers/${id}`)}
      />
    </MainContentLayout>
  );
}
