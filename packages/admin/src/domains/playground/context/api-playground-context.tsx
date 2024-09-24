'use client';

import type { RefinedIntegrationApi } from '@kpl/core';
import React, { createContext, useContext, useMemo, useState } from 'react';

import { getParsedFrameworkApis } from '@/domains/workflows/utils';

type ApirunState = 'idle' | 'loading' | 'success' | 'fail';

export interface ApiPlaygroundContextProps {
  frameworkApis: RefinedIntegrationApi[];

  selectedApi: RefinedIntegrationApi | undefined;
  setSelectedApi: React.Dispatch<React.SetStateAction<RefinedIntegrationApi | undefined>>;

  apiResult: string;
  setApiResult: React.Dispatch<React.SetStateAction<string>>;

  apiRunState: ApirunState;
  setApiRunState: React.Dispatch<React.SetStateAction<ApirunState>>;

  buttonContainer: HTMLDivElement | null;
  setButtonContainer: React.Dispatch<React.SetStateAction<HTMLDivElement | null>>;

  payload: Record<string, any>;
  setPayload: React.Dispatch<React.SetStateAction<Record<string, any>>>;

  keplerConnectionId: string;
  setKeplerConnectionId: React.Dispatch<React.SetStateAction<string>>;
}

export const ApiPlaygroundContext = createContext({} as ApiPlaygroundContextProps);

export const useApiPlaygroundContext = () => {
  const context = useContext(ApiPlaygroundContext);
  if (!context) {
    throw new Error('useActionPlaygroundContext must be used within an ActionPlaygroundProvider');
  }
  return context;
};

export const ApiPlaygroundProvider = ({
  children,
  serializedFrameworkApis,
}: {
  children: React.ReactNode;
  serializedFrameworkApis?: string;
}) => {
  const frameworkApis = useMemo(() => {
    return serializedFrameworkApis ? getParsedFrameworkApis(serializedFrameworkApis) : [];
  }, [serializedFrameworkApis]);

  const [selectedApi, setSelectedApi] = useState<RefinedIntegrationApi | undefined>(undefined);
  const [buttonContainer, setButtonContainer] = useState<HTMLDivElement | null>(null);

  const [payload, setPayload] = useState<Record<string, any>>({});
  const [keplerConnectionId, setKeplerConnectionId] = useState('');

  const [apiRunState, setApiRunState] = useState<ApirunState>('idle');
  const [apiResult, setApiResult] = useState('');

  const contextValue = useMemo(() => {
    return {
      selectedApi,
      setSelectedApi,

      buttonContainer,
      setButtonContainer,

      apiResult,
      setApiResult,

      apiRunState,
      setApiRunState,

      frameworkApis,

      payload,
      setPayload,

      keplerConnectionId,
      setKeplerConnectionId,
    };
  }, [selectedApi, buttonContainer, apiResult, apiRunState, frameworkApis, payload, keplerConnectionId]);

  return <ApiPlaygroundContext.Provider value={contextValue}>{children}</ApiPlaygroundContext.Provider>;
};
