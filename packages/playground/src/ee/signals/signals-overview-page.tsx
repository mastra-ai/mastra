import { SignalsOverviewPage as SignalsOverviewPageContent } from '@mastra/playground-ui';
import { useNavigate } from 'react-router';

export function SignalsOverviewPage() {
  const navigate = useNavigate();

  const handleSignalSelect = (signalName: string) => {
    void navigate(`/signals/${signalName}`, { viewTransition: true });
  };

  return <SignalsOverviewPageContent onSignalSelect={handleSignalSelect} />;
}

export default SignalsOverviewPage;
