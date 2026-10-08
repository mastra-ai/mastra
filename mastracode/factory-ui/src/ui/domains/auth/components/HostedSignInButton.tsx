import { Button } from '@mastra/playground-ui/components/Button';
import { LogoWithoutText } from '@mastra/playground-ui/components/Logo';
import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';
import { useState } from 'react';

import { useApiConfig } from '../../../../api/config';
import { redirectToLogin } from '../services/auth';

export function HostedSignInButton({ studioAuth, returnTo }: { studioAuth: boolean; returnTo: string }) {
  const { baseUrl } = useApiConfig();
  const [redirecting, setRedirecting] = useState(false);
  const label = studioAuth ? 'Sign in with Mastra Platform' : 'Continue with GitHub';
  const pendingLabel = studioAuth ? 'Opening Mastra Platform…' : 'Opening GitHub…';

  const signIn = () => {
    setRedirecting(true);
    redirectToLogin(baseUrl, returnTo);
  };

  return (
    <Button variant="primary" size="lg" className="w-80 max-w-full" disabled={redirecting} onClick={signIn}>
      {studioAuth ? <LogoWithoutText className="w-4" aria-hidden="true" /> : <GithubIcon aria-hidden="true" />}
      {redirecting ? pendingLabel : label}
    </Button>
  );
}
