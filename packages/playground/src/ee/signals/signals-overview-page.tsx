import { SignalsOverviewPage as SignalsOverviewPageContent } from '@mastra/playground-ui';
import { useNavigate } from 'react-router';
import type { Signal } from '@mastra/playground-ui';

export function SignalsOverviewPage() {
  const navigate = useNavigate();

  const handleSignalSelect = (signal: Signal) => {
    void navigate(`/signals/${signal.id}`, { viewTransition: true });
  };

  return <SignalsOverviewPageContent onSignalSelect={handleSignalSelect} />;
}

export default SignalsOverviewPage;
