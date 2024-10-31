'use client';

import { useCallback, useEffect, useState } from 'react';
import { parse } from 'superjson';

import { toast } from '@/lib/toast';

import {
  addIntegrationAction,
  getAvailableIntegrations,
  getIntegrationConnections,
  getIntegrationConnectSnippet,
  getIntegrationInstance,
  getIntegrationSyncedData,
  getIntegrationSyncEvents,
} from '@/domains/integrations/actions';

import {
  ApiKeyConfigProps,
  CredentialInfo,
  IntegrationCredentialType,
  IntegrationInstance,
  IntegrationSyncedDataItem,
  IntegrationSyncEvent,
} from '../types';

export const useConnections = ({ name }: { name: string }) => {
  const [connections, setConnections] = useState<
    {
      id: string;
      name: string;
      connectionId: string;
      createdAt: Date;
      updatedAt: Date | null;
      lastSyncAt: Date | null;
    }[]
  >();

  const upperCaseName = name?.toUpperCase();

  useEffect(() => {
    const getConnections = async () => {
      if (!upperCaseName) return;
      try {
        const intConnections = await getIntegrationConnections({ name: upperCaseName });
        setConnections(intConnections);
      } catch (err) {
        console.log(`Error getting connections for ${upperCaseName}=`, { err });
      }
    };

    getConnections();
  }, [upperCaseName]);

  return { connections };
};

export const useIntegrationDetails = ({ name }: { name: string }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [integration, setIntegration] = useState<IntegrationInstance>();
  const [credential, setCredential] = useState<CredentialInfo>({ clientID: '', clientSecret: '', scopes: [] });

  const upperCaseName = name?.toUpperCase();

  const saveIntegration = async () => {
    if (!integration) return;
    try {
      setSaving(true);
      await addIntegrationAction({
        integrationName: upperCaseName,
        credential,
        isUserDefined: integration.isUserDefined,
      });

      setSaving(false);
      toast('Integration Updated');
    } catch (err) {
      setSaving(false);
      toast.error('Could not update integration, try again', {
        position: 'bottom-center',
      });
    }
  };

  const updateClientId = (clientID: string) => {
    setCredential(prev => ({ ...(prev || {}), clientID } as IntegrationInstance));
  };

  const updateClientSecret = (clientSecret: string) => {
    setCredential(prev => ({ ...(prev || {}), clientSecret } as IntegrationInstance));
  };

  const updateScopes = async (scopes: string[]) => {
    setCredential(prev => ({ ...(prev || {}), scopes } as IntegrationInstance));
  };

  useEffect(() => {
    const getIntegration = async () => {
      if (!upperCaseName) {
        setLoading(false);
        return;
      }
      try {
        const int = await getIntegrationInstance({ name: upperCaseName });
        setIntegration(int);
        setCredential({ clientID: int.clientID, clientSecret: int.clientSecret, scopes: int.scopes });
        setLoading(false);
      } catch (err) {
        setLoading(false);
        console.log(`Error getting integration instance for ${upperCaseName}=`, { err });
      }
    };

    getIntegration();
  }, [upperCaseName]);

  return {
    integration,
    loading,
    updateClientId,
    updateClientSecret,
    updateScopes,
    saveIntegration,
    saving,
    credential,
  };
};

export const useIntegrationSyncedData = ({ name }: { name: string }) => {
  const [loading, setLoading] = useState(true);
  const [syncedData, setSyncedData] = useState<IntegrationSyncedDataItem[]>();
  const upperCaseName = name?.toUpperCase();

  useEffect(() => {
    const getSyncedData = async () => {
      if (!upperCaseName) {
        setLoading(false);
        return;
      }
      try {
        const data = await getIntegrationSyncedData({ name: upperCaseName });
        setSyncedData(data);
        setLoading(false);
      } catch (err) {
        setLoading(false);
        console.log(`Error getting integration synced data for ${upperCaseName}=`, { err });
      }
    };

    getSyncedData();
  }, [upperCaseName]);

  return { syncedData, loading };
};

export const useIntegrationConnectSnippet = ({ name }: { name: string }) => {
  const [snippet, setSnippet] = useState('');

  const upperCaseName = name?.toUpperCase();

  useEffect(() => {
    const getIntegration = async () => {
      if (!upperCaseName) return;

      try {
        const int = await getIntegrationInstance({ name: upperCaseName });
        const authType = int?.authType;
        let apiKeyConfig: ApiKeyConfigProps = {
          type: 'object',
          properties: {
            apiKey: { type: 'string' },
          },
          required: ['apiKey'],
          $schema: '',
          additionalProperties: false,
        };

        if (int?.authType === IntegrationCredentialType.API_KEY && int?.config?.apiKey) {
          apiKeyConfig = int.config.apiKey!;
        }

        const _snippet = await getIntegrationConnectSnippet({ integrationName: upperCaseName, authType, apiKeyConfig });

        setSnippet(_snippet);
      } catch (err) {
        console.log(`Error getting integration connection snippet for ${upperCaseName}=`, { err });
      }
    };

    getIntegration();
  }, [upperCaseName]);

  return { snippet };
};

export const useAvailableIntegrations = () => {
  const [integrations, setIntegrations] = useState<{ name: string; logoUrl: string; entityTypes: string[] }[]>();

  useEffect(() => {
    const getAllAvailableIntegrations = async () => {
      try {
        const ints = await getAvailableIntegrations();
        setIntegrations(ints as { name: string; logoUrl: string; entityTypes: string[] }[]);
      } catch (err) {
        console.log(`Error getting availabel integrations`, { err });
      }
    };

    getAllAvailableIntegrations();
  }, []);

  return { integrations };
};

export const useIntegrationEventsAndEntities = ({
  integration: initialIntegration,
  page: initialPage = 1,
  pageSize: initialPageSize,
  searchedEntity: intialSearchedEntity,
}: {
  integration: string;
  page: number;
  pageSize?: number;
  searchedEntity?: string;
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [events, setEvents] = useState<IntegrationSyncEvent[]>([]);
  const [searchedEntity, setSearchedEntity] = useState(intialSearchedEntity);
  const [integration, setIntegration] = useState(initialIntegration);

  const getIntSyncEvents = useCallback(async () => {
    if (!integration) return;
    console.log('getting event');
    const upperCaseName = integration?.toUpperCase();
    try {
      const res = await getIntegrationSyncEvents({ integration: upperCaseName, page, pageSize, searchedEntity });

      if (res) {
        const parsedData = parse(res) as IntegrationSyncEvent[];
        const deserializedEvents = parsedData;
        setEvents(deserializedEvents);
      }

      setIsLoading(false);
    } catch (err) {
      setIsLoading(false);
      console.log(`Error getting integration events for ${upperCaseName}=`, { err });
    }
  }, [page, pageSize, searchedEntity, integration]);

  useEffect(() => {
    getIntSyncEvents();
  }, [getIntSyncEvents]);

  return {
    events,
    isLoading,
    setPage,
    setPageSize,
    setSearchedEntity,
    setIntegration,
  };
};
