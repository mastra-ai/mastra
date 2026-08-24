import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

type StarterLocationState = { userMessage?: string } | null;

/**
 * Reads the starter prompt forwarded via `navigate(..., { state })` and
 * captures it once into local state. After capture we clear the location
 * state via React Router so a hard refresh on the edit page does not
 * resurrect the starter prompt and re-dispatch it on top of the loaded
 * thread history.
 */
export const useStarterUserMessage = (): string | undefined => {
  const location = useLocation();
  const navigate = useNavigate();

  const [userMessage] = useState<string | undefined>(() => (location.state as StarterLocationState)?.userMessage);

  useEffect(
    () => {
      if (userMessage === undefined) return;
      // Stryker disable next-line StringLiteral: react-router resolves '' and '.' to the
      // same (current) path, so the two are indistinguishable from the outside.
      void navigate('.', { replace: true, state: null });
    },
    // `userMessage` is captured once by useState and react-router's `navigate` is
    // referentially stable, so an empty dependency list would schedule this effect
    // exactly the same way.
    // Stryker disable next-line ArrayDeclaration
    [userMessage, navigate],
  );

  return userMessage;
};
