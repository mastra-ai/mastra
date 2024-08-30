import { framework } from '@/lib/framework-utils';

import { ConnectionList } from './components/connection-list';

async function Playground() {
  const connections = await framework?.dataLayer.getAllConnections();

  return (
    <section>
      <h1 className="text-sm gradient capitalize border-b-[0.5px] py-2 border-primary-border p-4">Playground</h1>
      <div className="p-4 flex flex-col gap-4 mx-auto max-w-[40em]">
        <div className="">
          <h1 className="text-xl">Connected Integrations</h1>
          <p className="text-sm text-arkw-el-3">Explore events and apis for connected integrations</p>
        </div>
        <ConnectionList connections={connections} />
      </div>
    </section>
  );
}

export default Playground;
