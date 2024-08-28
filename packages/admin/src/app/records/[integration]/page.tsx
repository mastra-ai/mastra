import { IntegrationMap } from '@arkw/core';

import { redirect } from 'next/navigation';

import { framework } from '@/lib/framework-utils';
import { capitalizeFirstLetter } from '@/lib/string';

import { CodeBlock } from '@/domains/integrations/components/code-block';

export default async function Integration({ params }: { params: { integration: string } }) {
  const integrationName = params.integration.toUpperCase() as keyof IntegrationMap;
  const integration = framework?.getIntegration(String(integrationName));

  if (!integration) {
    console.log(`Integration ${integrationName} not found`);
    return null;
  }

  const indexEntityType = Object.values(integration.entityTypes)[0];

  if (indexEntityType) {
    redirect(`/records/${String(integrationName).toLowerCase()}/${indexEntityType.toLowerCase()}`);
  }

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

  const snippet = `
    import { config } from '@arkw/config';
    import { createFramework } from '@arkw/core';

    export const ${integration?.name && capitalizeFirstLetter(integration.name)}ConnectButton: React.FC = () => {
      const framework = createFramework(config);
      const OAuthConnectionRoute = framework?.makeConnectURI({
        clientRedirectPath: '/',
        name: '${integration?.name}',
        referenceId: 'user-1',
      });

      return (
        <a href={OAuthConnectionRoute}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded inline-block"
        >
          Connect with ${integration?.name && capitalizeFirstLetter(integration.name)}
        </a>
      );
    };
    `;

  return (
    <section>
      <h1 className="text-sm  gradient h-fit capitalize border-b-[0.5px] py-2 border-primary-border p-4">
        {params.integration}
      </h1>
      <div className="">
        <h2 className="p-4">Add Connect button to your application</h2>
        <p className="p-4 pt-0 text-gray-400 text-sm">
          Copy the code below into a React component and add it to your application (replacing the clientRedirectPath
          and referenceId)
        </p>
        <CodeBlock snippet={snippet} />
      </div>
    </section>
  );
}
