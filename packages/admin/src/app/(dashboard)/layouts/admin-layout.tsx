'use client';

import { ReactNode, useEffect, useState } from 'react';

import { IntegrationTab } from '@/components/integration-tab';
import { Sidebar } from '@/components/sidebar';

import { IntegrationWithConnectionAndEntityTypes, IntegrationWithEntityTypes } from '@/domains/integrations/types';

import { getIntegrationConnections } from '../../../domains/integrations/actions';

export default function AdminLayout({
  children,
  availableIntegrations,
}: {
  children: ReactNode;
  availableIntegrations: IntegrationWithEntityTypes[];
}) {
  const [integrations, setIntegrations] = useState<IntegrationWithConnectionAndEntityTypes[]>([]);

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
    <main className="bg-mastra-bg-1 grid h-full w-full grid-cols-[15rem_minmax(0,_1fr)] overflow-clip">
      <div className="z-20 h-full">
        <div className="h-full">
          <Sidebar>
            {integrations.map(integration => {
              return (
                <IntegrationTab
                  key={integration.name}
                  name={integration.name}
                  logoUrl={integration.logoUrl}
                  connections={integration.connections}
                  entityTypes={integration.entityTypes}
                />
              );
            })}
          </Sidebar>
        </div>
      </div>
      <div className="bg-mastra-bg-2 grid relative border-mastra-border-1 rounded-xs border-thin m-2 overflow-hidden border-solid">
        {children}
      </div>
    </main>
  );
}
