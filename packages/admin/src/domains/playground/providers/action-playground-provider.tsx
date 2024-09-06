'use client';

import type { RefinedIntegrationApi } from '@arkw/core';
import React, { createContext, useContext, useMemo, useState } from 'react';

import { getParsedFrameworkActions } from '@/domains/workflows/utils';

export interface ActionPlaygroundContextProps {
  frameworkActions: RefinedIntegrationApi[];
  selectedAction: RefinedIntegrationApi | undefined;
  setSelectedAction: React.Dispatch<React.SetStateAction<RefinedIntegrationApi | undefined>>;

  buttonContainer: HTMLDivElement | null;
  setButtonContainer: React.Dispatch<React.SetStateAction<HTMLDivElement | null>>;
  payload: Record<string, any>;
  setPayload: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  arkwReferenceId: string;
  setArkwReferenceId: React.Dispatch<React.SetStateAction<string>>;
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
  serializedFrameworkActions?: string;
}) => {
  const frameworkActions = useMemo(() => {
    return serializedFrameworkActions ? getParsedFrameworkActions(serializedFrameworkActions) : [];
  }, [serializedFrameworkActions]);

  const [selectedAction, setSelectedAction] = useState<RefinedIntegrationApi | undefined>(undefined);
  const [buttonContainer, setButtonContainer] = useState<HTMLDivElement | null>(null);

  const [payload, setPayload] = useState<Record<string, any>>({});
  const [arkwReferenceId, setArkwReferenceId] = useState('');

  const contextValue = useMemo(() => {
    return {
      selectedAction,
      buttonContainer,
      setButtonContainer,
      frameworkActions,
      setSelectedAction,
      payload,
      setPayload,
      arkwReferenceId,
      setArkwReferenceId,
    };
  }, [selectedAction, buttonContainer, frameworkActions, payload, arkwReferenceId]);

  return <ActionPlaygroundContext.Provider value={contextValue}>{children}</ActionPlaygroundContext.Provider>;
};
