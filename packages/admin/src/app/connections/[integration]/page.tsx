import { IntegrationMap } from '@arkw/core';

import { framework } from '@/lib/framework-utils';

export default async function Page({ params }: { params: { integration: string } }) {
  const integrationName = params.integration.toUpperCase() as keyof IntegrationMap;
  const connections = (await framework?.dataLayer.getConnectionsByIntegrationName({ name: integrationName as string }))
    ?.length;

  return (
    <section>
      <h1 className="text-sm  gradient h-fit capitalize border-b-[0.5px] py-2 border-primary-border p-4">
        {params.integration}
      </h1>
      <div className="p-4 flex gap-3">
        <div className="flex p-2 flex-col gap-2 border-[0.5px] border-arkw-border-1 rounded bg-arkw-bg-3 w-60">
          <div className="flex flex-col gap-1">
            <p className="flex items-center gap-1">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="text-arkw-el-6 h-4 w-4"
              >
                <path
                  className="db-icon"
                  d="M3.73438 17.4219L9.82009 21.3407C11.1383 22.1895 12.8308 22.19 14.1494 21.3419L20.2445 17.4219"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  opacity="0.4"
                ></path>
                <path
                  className="db-icon"
                  d="M3.73438 13.2344L9.82009 17.1532C11.1383 18.002 12.8308 18.0025 14.1494 17.1544L18 14.6779"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  opacity="0.5"
                ></path>
                <path
                  className="db-icon"
                  d="M14.7947 3.01918L13.5843 2.26647C12.6142 1.66322 11.3858 1.66322 10.4157 2.26647L4.67104 5.83894C3.42741 6.61233 3.40935 8.41608 4.63725 9.21421L10.365 12.9373C11.3592 13.5835 12.6408 13.5835 13.635 12.9373L16.0048 11.3969"
                  stroke="currentColor"
                  stroke-width="1.49862"
                  stroke-linecap="round"
                  opacity="0.6"
                ></path>
                <g>
                  <path
                    d="M18 3.5V9.5"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></path>
                  <path
                    d="M15 6.5H21"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  ></path>
                </g>
              </svg>
              <span className="flex items-center gap-1">
                <span> Connections: </span>
                <span className="gradient">{connections || 0}</span>
              </span>
            </p>
          </div>

          <button className="text-xs bg-arkw-bg-4/50 hover:bg-arkw-bg-4/80  rounded px-3 hover:text-arkw-el-6 transition-all text-arkw-el-3 p-1">
            View all{' '}
          </button>
        </div>
      </div>
    </section>
  );
}
