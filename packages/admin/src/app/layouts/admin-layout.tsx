import { ReactNode } from 'react';

import { Sidebar } from '../components/sidebar';
import { Integration } from '../records/types';

export default function AdminLayout({ children, integrations }: { children: ReactNode; integrations: Integration[] }) {
  return (
    <main className="bg-main-bg grid h-full w-full grid-cols-[15rem_minmax(0,_1fr)] overflow-clip">
      <div className="z-20 h-full">
        <div className="h-full">
          <Sidebar integrations={integrations} />
        </div>
      </div>
      <div className="bg-window-bg grid border-primary-border rounded-xs border-thin m-2 overflow-hidden border-solid">
        {children}
      </div>
    </main>
  );
}
