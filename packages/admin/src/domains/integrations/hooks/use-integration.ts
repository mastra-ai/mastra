import { useEffect, useState } from 'react';

import { toast } from '@/lib/toast';

import {
  addIntegrationAction,
  getIntegrationConnections,
  getIntegrationInstance,
  getIntegrationSyncedData,
} from '@/app/(dashboard)/integrations/actions';

import { CredentialInfo, IntegrationInstance, IntegrationSyncedDataItem } from '../types';

export const useConnections = ({ name }: { name: string }) => {
  const [connections, setConnections] = useState<
    {
      id: string;
      name: string;
      referenceId: string;
      createdAt: Date;
      updatedAt: Date | null;
      lastSyncAt: Date | null;
    }[]
  >();

  useEffect(() => {
    const getConnections = async () => {
      if (!name) return;
      try {
        const intConnections = await getIntegrationConnections({ name });
        setConnections(intConnections);
      } catch (err) {
        console.log(`Error getting connections for ${name}=`, { err });
      }
    };

    getConnections();
  }, [name]);

  return { connections };
};

export const useIntegrationDetails = ({ name }: { name: string }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [integration, setIntegration] = useState<IntegrationInstance>();
  const [credential, setCredential] = useState<CredentialInfo>({ clientID: '', clientSecret: '', scopes: [] });

  const saveIntegration = async () => {
    if (!integration) return;
    try {
      setSaving(true);
      await addIntegrationAction({
        integrationName: name,
        credential,
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
      if (!name) {
        setLoading(false);
        return;
      }
      try {
        const int = await getIntegrationInstance({ name });
        setIntegration(int);
        setCredential({ clientID: int.clientID, clientSecret: int.clientSecret, scopes: int.scopes });
        setLoading(false);
      } catch (err) {
        setLoading(false);
        console.log(`Error getting integration instance for ${name}=`, { err });
      }
    };

    getIntegration();
  }, [name]);

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

  useEffect(() => {
    const getSyncedData = async () => {
      if (!name) {
        setLoading(false);
        return;
      }
      try {
        const data = await getIntegrationSyncedData({ name });
        setSyncedData(data);
        setLoading(false);
      } catch (err) {
        setLoading(false);
        console.log(`Error getting integration synced data for ${name}=`, { err });
      }
    };

    getSyncedData();
  }, [name]);

  return { syncedData, loading };
};
