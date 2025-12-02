import { useEffect } from 'react';
import { useMemo } from '../../use-memo-one';
import type { Registry } from './registry-types';
import createRegistry from './create-registry';

export default function useRegistry(): Registry {
  const registry: Registry = useMemo(createRegistry, []);

  useEffect(() => {
    // clean up the registry to avoid any leaks
    return function unmount() {
      // We must invoke clean immediately. We won't be able to access the registry after the unmount.
      // more details here: https://react.dev/learn/synchronizing-with-effects#how-to-handle-the-effect-firing-twice-in-development
      registry.clean();
    };
  }, [registry]);

  return registry;
}
