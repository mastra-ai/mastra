import {
  Button,
  useScorers,
  useLinkComponent,
  useIsCmsAvailable,
  ScorersList,
  PageContent,
  MainHeader,
} from '@mastra/playground-ui';
import { ExternalLinkIcon, GaugeIcon, Plus } from 'lucide-react';
import { Link } from 'react-router';

export default function Scorers() {
  const { Link: FrameworkLink } = useLinkComponent();
  const { data: scorers = {}, isLoading, error } = useScorers();
  const { isCmsAvailable } = useIsCmsAvailable();

  return (
    <PageContent>
      <PageContent.TopBar>
        <Button as={Link} to="https://mastra.ai/en/docs/evals/overview" target="_blank" rel="noopener noreferrer" variant="ghost" size="md">
          Scorers documentation
          <ExternalLinkIcon />
        </Button>
      </PageContent.TopBar>
      <PageContent.Main>
        <div className="w-full max-w-[80rem] px-10 mx-auto grid h-full grid-rows-[auto_1fr] overflow-y-auto">
          <MainHeader>
            <MainHeader.Column>
              <MainHeader.Title isLoading={isLoading}>
                <GaugeIcon /> Scorers
              </MainHeader.Title>
            </MainHeader.Column>
            {isCmsAvailable && (
              <MainHeader.Column>
                <Button variant="primary" as={FrameworkLink} to="/cms/scorers/create">
                  <Plus />
                  Create Scorer
                </Button>
              </MainHeader.Column>
            )}
          </MainHeader>

          <ScorersList scorers={scorers} isLoading={isLoading} error={error} />
        </div>
      </PageContent.Main>
    </PageContent>
  );
}
