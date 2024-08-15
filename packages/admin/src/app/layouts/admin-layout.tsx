import { ReactNode } from 'react';

import { Integration } from '@/domains/integrations/types';

import { IntegrationTab } from '../components/integration-tab';
import { Sidebar } from '../components/sidebar';

export default function AdminLayout({ children, integrations }: { children: ReactNode; integrations: Integration[] }) {
  return (
    <main className="bg-main-bg grid h-full w-full grid-cols-[15rem_minmax(0,_1fr)] overflow-clip">
      <div className="z-20 h-full">
        <div className="h-full">
          <Sidebar>
            {integrations.map(integration => {
              return <IntegrationTab key={integration.name} name={integration.name} />;
            })}
          </Sidebar>
        </div>
      </div>
      <div className="bg-window-bg grid border-primary-border rounded-xs border-thin m-2 overflow-hidden border-solid">
        {children}
      </div>
    </main>
  );
}
