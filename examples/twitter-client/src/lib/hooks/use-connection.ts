'use client';

import { Connection } from '@mastra/core';
import { useEffect, useState } from 'react';

import {
  getConnection,
  getOAuthConnectionRoute,
  callFrameworkApi,
  getAllSlackchannels,
  triggerSystemEvent,
} from '../actions';

export const useConnection = ({ name }: { name: string }) => {
  const [error, setError] = useState<unknown>();
  const [connection, setConnection] = useState<Connection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [oAuthConnectionRoute, setOAuthConnectionRoute] = useState('');
  const connectionId = 'user-47';

  const callApi = async ({ payload, apiType }: { payload: unknown; apiType: string }) => {
    if (!name) return { success: false, error: { message: 'Integration name is missing' } };
    try {
      const data = await callFrameworkApi({
        name,
        apiType,
        payload,
        connectionId,
      });
      return { success: true, data };
    } catch (error) {
      console.error('Failed to execute api:', error);
      return { success: false, error: error };
    }
  };

  useEffect(() => {
    const getConnectionData = async () => {
      if (!name) return;

      try {
        setIsLoading(true);
        const newOAuthConnectionRoute = getOAuthConnectionRoute({ name, connectionId });
        setOAuthConnectionRoute(newOAuthConnectionRoute);
        const newConnection = await getConnection({ name, connectionId });
        setConnection(newConnection);
        setIsLoading(false);
      } catch (err) {
        setError(err);
        setIsLoading(false);
      }
    };

    getConnectionData();
  }, [name, connectionId]);

  return { oAuthConnectionRoute, connection, isLoading, error, callApi };
};

export const useSlackConnection = () => {
  const [error, setError] = useState<unknown>();
  const [isLoading, setIsLoading] = useState(true);
  const [channels, setChannels] = useState<{ id?: string; name?: string }[] | undefined>();
  const connectionId = 'user-47';

  useEffect(() => {
    const getAllChannels = async () => {
      try {
        setIsLoading(true);
        const allChannels = await getAllSlackchannels({ connectionId });
        setChannels(allChannels);
        setIsLoading(false);
      } catch (err) {
        setError(err);
        setIsLoading(false);
      }
    };

    getAllChannels();
  }, [connectionId]);

  return {
    channels,
    error,
    isLoading,
  };
};

export const useEvents = () => {
  const connectionId = 'user-47';

  const triggerEvent = async ({ payload, eventKey }: { payload: unknown; eventKey: string }) => {
    try {
      const data = await triggerSystemEvent({
        eventKey,
        payload,
        connectionId,
      });
      return { success: true, data };
    } catch (error) {
      console.error('Failed to trigger event:', error);
      return { success: false, error: error };
    }
  };

  return {
    triggerEvent,
  };
};
