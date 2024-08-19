'use client';

import type { RefinedIntegrationAction } from '@arkw/core';
import React, { createContext, useContext, useMemo, useState } from 'react';

import { getParsedFrameworkActions } from '@/domains/workflows/utils';

export interface ActionPlaygroundContextProps {
  frameworkActions: RefinedIntegrationAction[];
  selectedAction: RefinedIntegrationAction | undefined;
  setSelectedAction: React.Dispatch<React.SetStateAction<RefinedIntegrationAction | undefined>>;
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

  const [selectedAction, setSelectedAction] = useState<RefinedIntegrationAction | undefined>(undefined);

  const contextValue: ActionPlaygroundContextProps = useMemo(() => {
    return {
      selectedAction,
      frameworkActions,
      setSelectedAction,
    };
  }, [selectedAction, frameworkActions]);

  return <ActionPlaygroundContext.Provider value={contextValue}>{children}</ActionPlaygroundContext.Provider>;
};
