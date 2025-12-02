import React from 'react';
import { useMemo } from '../use-memo-one';
import type { Id } from '../types';

interface Options {
  separator: string;
}

const defaults: Options = { separator: '::' };

function useUniqueId(prefix: string, options: Options = defaults): Id {
  const id = React.useId();

  return useMemo(
    () => `${prefix}${options.separator}${id}`,
    [options.separator, prefix, id],
  );
}

export default useUniqueId;
