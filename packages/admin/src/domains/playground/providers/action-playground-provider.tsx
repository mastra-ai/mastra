'use client';

import type { RefinedIntegrationApi } from '@arkw/core';
import React, { createContext, useContext, useMemo, useState } from 'react';

import { getParsedFrameworkActions } from '@/domains/workflows/utils';

export interface ActionPlaygroundContextProps {
  frameworkActions: RefinedIntegrationApi[];
  selectedAction: RefinedIntegrationApi | undefined;
  setSelectedAction: React.Dispatch<React.SetStateAction<RefinedIntegrationApi | undefined>>;
  payload: Record<string, any>;
  setPayload: React.Dispatch<React.SetStateAction<Record<string, any>>>;
}

export const ActionPlaygroundContext = createContext({} as ActionPlaygroundContextProps);

export const useActionPlaygroundContext = () => {
  const context = useContext(ActionPlaygroundContext);
  if (!context) {
    throw new Error('useActionPlaygroundContext must be used within an ActionPlaygroundProvider');
  }
  return context;
};

export const ActionPlaygroundProvider = ({
  children,
  serializedFrameworkActions,
}: {
  children: React.ReactNode;
  serializedFrameworkActions: string;
}) => {
  const frameworkActions = useMemo(() => {
    return getParsedFrameworkActions(serializedFrameworkActions);
  }, [serializedFrameworkActions]);

  const [selectedAction, setSelectedAction] = useState<RefinedIntegrationApi | undefined>(undefined);

  const [payload, setPayload] = useState<Record<string, any>>({});

  const contextValue: ActionPlaygroundContextProps = useMemo(() => {
    return {
      selectedAction,
      frameworkActions,
      setSelectedAction,
      payload,
      setPayload,
    };
  }, [selectedAction, frameworkActions, payload]);

  return <ActionPlaygroundContext.Provider value={contextValue}>{children}</ActionPlaygroundContext.Provider>;
};
