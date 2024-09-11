'use client';

import type { RefinedIntegrationEvent } from '@kpl/core';
import React, { createContext, useContext, useMemo, useState } from 'react';

import { getParsedFrameworkEvents } from '@/domains/workflows/utils';

export interface EventPlaygroundContextProps {
  frameworkEvents: RefinedIntegrationEvent[];
  selectedEvent: RefinedIntegrationEvent | undefined;
  setSelectedEvent: React.Dispatch<React.SetStateAction<RefinedIntegrationEvent | undefined>>;
  payload: Record<string, any>;
  setPayload: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  keplerReferenceId: string;
  setArkwReferenceId: React.Dispatch<React.SetStateAction<string>>;
}

export const EventPlaygroundContext = createContext({} as EventPlaygroundContextProps);

export const useEventPlaygroundContext = () => {
  const context = useContext(EventPlaygroundContext);
  if (!context) {
    throw new Error('useActionPlaygroundContext must be used within an ActionPlaygroundProvider');
  }
  return context;
};

export const EventPlaygroundProvider = ({
  children,
  serializedFrameworkEvents,
}: {
  children: React.ReactNode;
  serializedFrameworkEvents: string;
}) => {
  const frameworkEvents = useMemo(() => {
    return getParsedFrameworkEvents(serializedFrameworkEvents);
  }, [serializedFrameworkEvents]);

  const [selectedEvent, setSelectedEvent] = useState<RefinedIntegrationEvent | undefined>(undefined);

  const [payload, setPayload] = useState<Record<string, any>>({});
  const [keplerReferenceId, setArkwReferenceId] = useState('');

  const contextValue: EventPlaygroundContextProps = useMemo(() => {
    return {
      selectedEvent,
      frameworkEvents,
      setSelectedEvent,
      payload,
      setPayload,
      keplerReferenceId,
      setArkwReferenceId,
    };
  }, [selectedEvent, frameworkEvents, payload, keplerReferenceId]);

  return <EventPlaygroundContext.Provider value={contextValue}>{children}</EventPlaygroundContext.Provider>;
};
