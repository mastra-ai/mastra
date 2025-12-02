import { useContext } from 'react';
import type { Context as ContextType } from 'react';
import { invariant } from '../invariant';

export default function useRequiredContext<T>(
  Context: ContextType<T | null>,
): T {
  const result: T | null = useContext(Context);
  invariant(result, 'Could not find required context');
  return result;
}
