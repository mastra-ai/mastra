import { clearMastraCodeStorage, redirectToLogout } from '../../auth/services/auth';
import { clearOnboardingFlow } from './onboardingFlow';

/** Signs out from onboarding. The draft lives in sessionStorage; the next account in this tab must not inherit it. */
export function signOutOfOnboarding(baseUrl: string): void {
  clearMastraCodeStorage();
  clearOnboardingFlow();
  redirectToLogout(baseUrl);
}
