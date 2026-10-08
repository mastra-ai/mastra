import { CredentialSignInForm } from './CredentialSignInForm';
import { HostedSignInButton } from './HostedSignInButton';

export function SignInMethod({
  provider,
  signUpDisabled,
  returnTo,
}: {
  provider?: string;
  signUpDisabled: boolean;
  returnTo: string;
}) {
  if (provider === 'better-auth') {
    return <CredentialSignInForm returnTo={returnTo} signUpDisabled={signUpDisabled} />;
  }

  return <HostedSignInButton studioAuth={provider === 'mastra-studio'} returnTo={returnTo} />;
}
