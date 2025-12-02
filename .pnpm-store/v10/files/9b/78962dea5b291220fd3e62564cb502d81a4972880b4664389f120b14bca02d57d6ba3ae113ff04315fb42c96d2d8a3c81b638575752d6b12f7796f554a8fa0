import { memo } from 'motion-utils';
import { supportsFlags } from './flags.mjs';

function memoSupports(callback, supportsFlag) {
    const memoized = memo(callback);
    return () => supportsFlags[supportsFlag] ?? memoized();
}

export { memoSupports };
