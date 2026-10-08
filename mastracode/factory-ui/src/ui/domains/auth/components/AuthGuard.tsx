import { useFactoryAuth } from '../../../../hooks/useFactoryAuth';

import { AuthNotConfiguredScreen } from './AuthNotConfiguredScreen';
import { AuthPendingSkeleton } from './AuthPendingSkeleton';
import { AuthSessionGuard } from './AuthSessionGuard';
import { OnboardingGuard } from './OnboardingGuard';

export function AuthGuard() {
  const { isPending, isError, data } = useFactoryAuth({ monitorSession: true });

  if (isPending) return <AuthPendingSkeleton />;
  if (isError && !data) return <AuthPendingSkeleton label="Unable to reach MastraCode server" />;

  const state = data;
  if (!state?.authEnabled) return <AuthNotConfiguredScreen />;

  return (
    <AuthSessionGuard authenticated={state.authenticated}>
      <OnboardingGuard />
    </AuthSessionGuard>
  );
}
