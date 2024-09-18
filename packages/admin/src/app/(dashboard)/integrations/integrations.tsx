'use client';

import { Credential } from '@kpl/core';
import { ScrollArea } from '@radix-ui/react-scroll-area';
import React, { useCallback, useEffect, useState } from 'react';

import { Dialog, DialogContent } from '@/components/ui/dialog';

import { toast } from '@/lib/toast';

import { IntegrationButtonCodeSnippetDialog } from '@/domains/integrations/components/integration-button-code-snippet-dialog';
import { IntegrationConnectDialog } from '@/domains/integrations/components/integration-connect-dialog';
import IntegrationsTable from '@/domains/integrations/components/integrations-table/integrations-table';
import { integrationsTableColumns } from '@/domains/integrations/components/integrations-table/integrations-table-columns';
import { ReferenceDialog } from '@/domains/integrations/components/reference-dialog';
import { Integration, IntegrationWithConnection } from '@/domains/integrations/types';

import { connectIntegrationByAPIKey, getIntegrationConnections, getOAuthConnectionRoute } from './actions';

const Integrations = ({ availableIntegrations }: { availableIntegrations: Integration[] }) => {
  const [referenceId, setReferenceId] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnectingManually, setIsConnectingManually] = useState(false);
  const [integrationInfo, setIntegrationInfo] = useState<Integration>();
  const [openReferenceIdDialog, setOpenReferneceIdDialog] = useState(false);
  const [openCodeSnippet, setOpenCodeSnippet] = useState(false);
  const [integrations, setIntegrations] = useState<IntegrationWithConnection[]>([]);

  const handleConnectIntegration = (integration: Integration) => {
    setIntegrationInfo(integration);
    setOpenReferneceIdDialog(true);
  };

  const handleConnectionButtonSnippet = (integration: Integration) => {
    setIntegrationInfo(integration);
    setOpenCodeSnippet(true);
  };

  const handleConnect = useCallback(
    async (referenceId: string) => {
      if (!integrationInfo) return;
      const { isAPIKeyConnection, name } = integrationInfo || {};
      if (isAPIKeyConnection) {
        setIsConnectingManually(true);
        setOpenReferneceIdDialog(false);
        return;
      }

      setIsConnecting(true);

      try {
        const path = await getOAuthConnectionRoute({ name, referenceId });
        if (path) {
          window.location.assign(path);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsConnecting(false);
      }
    },
    [integrationInfo],
  );

  const onManualConnect = async (credential: unknown) => {
    if (!integrationInfo) return;
    const { name } = integrationInfo || {};
    setIsConnectingManually(false);
    setIsConnecting(true);

    try {
      const error = await connectIntegrationByAPIKey({
        name,
        credential: credential as Credential,
        referenceId,
      });
      if (error) {
        toast.error(error);
      }
    } catch (err) {
      toast.error('Unable to connect to the Integration');
      console.error(err);
    } finally {
      setIsConnecting(false);
    }
  };

  useEffect(() => {
    async function fetchIntegrations() {
      const intObj = {} as Record<string, number>;

      availableIntegrations.forEach(int => {
        intObj[int.name] = 0;
      });

      async function getConnection(name: string) {
        const conn = await getIntegrationConnections({ name });
        return conn?.length;
      }

      await Promise.all(
        Object.keys(intObj).map(async key => {
          intObj[key] = (await getConnection(key)) as number;
        }),
      );

      if (Object.keys(intObj).length == 0)
        return setIntegrations(availableIntegrations.map(int => ({ ...int, connections: 0 })));

      const sortedIntegrations = availableIntegrations
        .sort((a, b) => {
          if (a.name > b.name) {
            return 1;
          } else if (a.name < b.name) {
            return -1;
          } else {
            return 0;
          }
        })
        .map(int => {
          if (intObj[int.name]) {
            return {
              ...int,
              connections: intObj[int.name],
            };
          } else {
            return { ...int, connections: 0 };
          }
        })
        .sort((a, b) => b.connections - a.connections);
      setIntegrations(sortedIntegrations);
    }

    fetchIntegrations();
  }, [availableIntegrations]);

  return (
    <ScrollArea className="h-full">
      <IntegrationsTable
        data={integrations}
        columns={integrationsTableColumns({ handleConnectIntegration, handleConnectionButtonSnippet })}
      />

      <IntegrationConnectDialog
        connectOptions={integrationInfo?.APIKeyConnectOptions}
        isOpen={isConnectingManually}
        onCancel={() => setIsConnectingManually(false)}
        onConnect={onManualConnect}
      />

      <IntegrationButtonCodeSnippetDialog
        isOpen={openCodeSnippet}
        onOpenChange={() => setOpenCodeSnippet(prev => !prev)}
        onCancel={() => setOpenCodeSnippet(false)}
        name={integrationInfo?.name!}
        logoUrl={integrationInfo?.logoUrl!}
      />

      <Dialog open={openReferenceIdDialog} onOpenChange={setOpenReferneceIdDialog}>
        <DialogContent>
          <ReferenceDialog setReferenceId={setReferenceId} handleConnect={handleConnect} />
        </DialogContent>
      </Dialog>
    </ScrollArea>
  );
};

export default Integrations;
