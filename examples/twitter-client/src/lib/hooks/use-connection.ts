'use client';

import { Connection } from '@arkw/core';
import { useEffect, useState } from 'react';

import {
  getConnectionByReferenceId,
  getOAuthConnectionRoute,
  executeFrameworkApi,
  getAllSlackchannels,
  triggerSystemEvent,
} from '../actions';

export const useConnection = ({ name }: { name: string }) => {
  const [error, setError] = useState<unknown>();
  const [connection, setConnection] = useState<Connection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [oAuthConnectionRoute, setOAuthConnectionRoute] = useState('');
  const referenceId = 'user-47';

  const executeAPI = async ({ payload, apiType }: { payload: unknown; apiType: string }) => {
    if (!name) return { success: false, error: { message: 'Integration name is missing' } };
    try {
      const data = await executeFrameworkApi({
        name,
        apiType,
        payload,
        referenceId,
      });
      return { success: true, data };
    } catch (error) {
      console.error('Failed to execute api:', error);
      return { success: false, error: error };
    }
  };

  useEffect(() => {
    const getConnection = async () => {
      if (!name) return;

      try {
        setIsLoading(true);
        const newOAuthConnectionRoute = await getOAuthConnectionRoute({ name, referenceId });
        setOAuthConnectionRoute(newOAuthConnectionRoute);
        const newConnection = await getConnectionByReferenceId({ name, referenceId });
        setConnection(newConnection);
        setIsLoading(false);
      } catch (err) {
        setError(err);
        setIsLoading(false);
      }
    };

    getConnection();
  }, [name, referenceId]);

  return { oAuthConnectionRoute, connection, isLoading, error, executeAPI };
};

export const useSlackConnection = () => {
  const [error, setError] = useState<unknown>();
  const [isLoading, setIsLoading] = useState(true);
  const [channels, setChannels] = useState<{ id?: string; name?: string }[] | undefined>();
  const referenceId = 'user-47';

  useEffect(() => {
    const getAllChannels = async () => {
      try {
        setIsLoading(true);
        const allChannels = await getAllSlackchannels({ referenceId });
        setChannels(allChannels);
        setIsLoading(false);
      } catch (err) {
        setError(err);
        setIsLoading(false);
      }
    };

    getAllChannels();
  }, [referenceId]);

  return {
    channels,
    error,
    isLoading,
  };
};

export const useEvents = () => {
  const referenceId = 'user-47';

  const triggerEvent = async ({ payload, eventKey }: { payload: unknown; eventKey: string }) => {
    try {
      const data = await triggerSystemEvent({
        eventKey,
        payload,
        referenceId,
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
