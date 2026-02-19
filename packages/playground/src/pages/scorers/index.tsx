import {
  Button,
  DocsIcon,
  HeaderAction,
  Icon,
  MainContentContent,
  useScorers,
  useLinkComponent,
  useIsCmsAvailable,
} from '@mastra/playground-ui';
import { Header, HeaderTitle, MainContentLayout, ScorersTable } from '@mastra/playground-ui';
import { GaugeIcon, Plus } from 'lucide-react';
import { Link } from 'react-router';

export default function Scorers() {
  const { Link: FrameworkLink } = useLinkComponent();
  const { data: scorers = {}, isLoading } = useScorers();
  const { isCmsAvailable } = useIsCmsAvailable();

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
          {isCmsAvailable && (
            <Button variant="light" as={FrameworkLink} to="/cms/scorers/create">
              <Icon>
                <Plus />
              </Icon>
              Create a scorer
            </Button>
          )}
          <Button variant="outline" as={Link} to="https://mastra.ai/en/docs/evals/overview" target="_blank">
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
    </MainContentLayout>
  );
}
