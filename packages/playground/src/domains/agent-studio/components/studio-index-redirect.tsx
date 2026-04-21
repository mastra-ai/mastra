import { Navigate } from 'react-router';
import { useShouldShowAgentStudio } from '../hooks/use-should-show-agent-studio';

/**
 * Decides where to land when the user hits `/`.
 *
 * Admins + users without Agent Studio access go to the default `/agents` list.
 * End-users (when `MastraAgentBuilder` is configured and they have
 * `stored-agents:read`) land on `/agent-studio/agents` so the Studio is the
 * primary experience rather than the admin console.
 *
 * Waits for auth/packages to load before redirecting so we don't flash the
 * admin route to an end-user mid-hydration.
 */
export const StudioIndexRedirect = () => {
  const { showAgentStudio, isLoading } = useShouldShowAgentStudio();

  if (isLoading) return null;

  return <Navigate to={showAgentStudio ? '/agent-studio/agents' : '/agents'} replace />;
};
