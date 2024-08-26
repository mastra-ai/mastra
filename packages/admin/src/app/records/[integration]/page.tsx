import { IntegrationMap } from '@arkw/core';

import { framework } from '@/lib/framework-utils';

import { Icon } from '@/app/components/icon';

export default async function Integration({ params }: { params: { integration: string } }) {
  const integrationName = params.integration.toUpperCase() as keyof IntegrationMap;
  const integration = framework?.getIntegration(String(integrationName));

  const indexEntityType = Object.values(integration?.entityTypes!)[0];

  const connections = (await framework?.dataLayer.getConnectionsByIntegrationName({ name: integrationName as string }))
    ?.length;

  // usage
  // const recordData = await future.getIntegration(params.integration.toUpperCase())?.query({
  //   referenceId: `1`,
  //   entityType: 'CONTACTS',
  //   filters: {
  //     'data.email': {
  //       contains: 'mail',
  //     },
  //   },
  //   sort: ['asc(createdAt)', 'desc(updatedAt)'],
  // });

  return (
    <section>
      <h1 className="text-sm  gradient h-fit capitalize border-b-[0.5px] py-2 border-primary-border p-4">
        {params.integration}
      </h1>
      <div className="p-4 flex gap-3">
        <div className="flex p-2 flex-col gap-2 border-[0.5px] border-arkw-border-1 rounded bg-arkw-bg-3 w-60 h-30">
          <p className="flex items-center gap-1">
            <Icon name="connections-db" className="text-arkw-el-3 w-3 h-3" />
            <span className="gradient"> Connections</span>
          </p>
          <p className="gradient text-3xl ml-auto">{connections || 0}</p>
        </div>
        <a
          href={`/records/${String(integrationName)?.toLowerCase()}/${indexEntityType?.toLowerCase()}`}
          className="flex p-2 flex-col group gap-2 border-[0.5px] cursor-pointer border-arkw-border-1 rounded bg-arkw-bg-3 w-60 h-30"
        >
          <p className="flex gap-1 items-center">
            <Icon name="records" className="text-arkw-el-3 w-3 h-3" />
            <span className="gradient ">Records</span>
          </p>
          <p className="mt-auto ml-auto">
            <Icon
              name="arrow-up"
              className="rotate-90 -translate-x-1 transition-transform group-hover:translate-x-0 text-arkw-el-3"
            />
          </p>
        </a>
      </div>
    </section>
  );
}
