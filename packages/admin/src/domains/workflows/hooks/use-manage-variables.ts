'use client';

import type { ActionVariables } from '@mastra/core';
import { useEffect, useRef, useState } from 'react';

import isEqual from 'lodash/isEqual';

import { extractVariables } from '../utils';

function useVariables({
  initialVariables,
  fieldValue,
  cb,
}: {
  initialVariables?: ActionVariables;
  fieldValue: string | string[];
  cb?: ({ variablePayload }: { variablePayload: ActionVariables }) => {} | void;
}) {
  const [variables, setVariables] = useState<string[]>([]);
  const [variablePayload, setVariablePayload] = useState<ActionVariables | undefined>(initialVariables);
  const isMounted = useRef(false);

  function handleUpdateVariablePayload({
    variable,
    refBlockId,
    path,
  }: {
    variable: string;
    refBlockId: string;
    path: string;
  }) {
    setVariablePayload({ ...variablePayload, [variable]: { refBlockId, path } });
  }

  useEffect(() => {
    setVariables(extractVariables(fieldValue));
  }, [fieldValue]);

  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    !!variablePayload && !isEqual(variablePayload, initialVariables) && cb?.({ variablePayload });
  }, [variablePayload]);

  function updateVariables(value: string | string[]) {
    const matches = extractVariables(value);
    setVariables(matches);
  }

  return { variables, variablePayload, handleUpdateVariablePayload, updateVariables };
}

export default useVariables;
