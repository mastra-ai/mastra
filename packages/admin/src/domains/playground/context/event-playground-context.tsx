'use client';

import type { RefinedIntegrationEvent } from '@mastra/core';
import React, { createContext, useContext, useMemo, useState } from 'react';

import { getParsedFrameworkEvents } from '@/domains/workflows/utils';

type EventRunState = 'idle' | 'loading' | 'success' | 'fail';

export interface EventPlaygroundContextProps {
  frameworkEvents: RefinedIntegrationEvent[];

  selectedEvent: RefinedIntegrationEvent | undefined;
  setSelectedEvent: React.Dispatch<React.SetStateAction<RefinedIntegrationEvent | undefined>>;

  payload: Record<string, any>;
  setPayload: React.Dispatch<React.SetStateAction<Record<string, any>>>;

  mastraConnectionId: string;
  setMastraConnectionId: React.Dispatch<React.SetStateAction<string>>;

  buttonContainer: HTMLDivElement | null;
  setButtonContainer: React.Dispatch<React.SetStateAction<HTMLDivElement | null>>;

  eventRunState: EventRunState;
  setEventRunState: React.Dispatch<React.SetStateAction<EventRunState>>;

  eventResult: string;
  setEventResult: React.Dispatch<React.SetStateAction<string>>;
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
  const [buttonContainer, setButtonContainer] = useState<HTMLDivElement | null>(null);
  const [mastraConnectionId, setMastraConnectionId] = useState('');

  const [eventRunState, setEventRunState] = useState<EventRunState>('idle');
  const [eventResult, setEventResult] = useState('');

  const contextValue: EventPlaygroundContextProps = useMemo(() => {
    return {
      selectedEvent,
      frameworkEvents,
      setSelectedEvent,
      payload,
      setPayload,
      mastraConnectionId,
      setMastraConnectionId,
      buttonContainer,
      setButtonContainer,
      eventRunState,
      setEventRunState,
      eventResult,
      setEventResult,
    };
  }, [selectedEvent, frameworkEvents, eventResult, eventRunState, buttonContainer, payload, mastraConnectionId]);

  return <EventPlaygroundContext.Provider value={contextValue}>{children}</EventPlaygroundContext.Provider>;
};
