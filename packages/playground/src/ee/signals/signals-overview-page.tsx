import { SignalsOverviewPage as SignalsOverviewPageContent } from '@mastra/playground-ui/ee/signals/components/signals-overview-page';
import type { SignalsOverviewPageProps } from '@mastra/playground-ui/ee/signals/components/signals-overview-page';
import { useNavigate } from 'react-router';

export function SignalsOverviewPage() {
  const navigate = useNavigate();

  const handleSignalSelect: SignalsOverviewPageProps['onSignalSelect'] = signal => {
    void navigate(`/signals/${signal.id}`, { viewTransition: true });
  };

  return <SignalsOverviewPageContent onSignalSelect={handleSignalSelect} />;
}

export default SignalsOverviewPage;
