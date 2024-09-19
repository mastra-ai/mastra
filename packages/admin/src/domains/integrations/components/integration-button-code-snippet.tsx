import { capitalizeFirstLetter } from '@/lib/string';

import { CodeBlock } from './code-block';

export const IntegrationButtonCodeSnippet = ({
  name,
  className,
  innerClassName,
}: {
  name: string;
  className?: HTMLDivElement['className'];
  innerClassName?: HTMLDivElement['className'];
}) => {
  const snippet = `
    import { config } from '@kpl/config';
    import { Framework } from '@kpl/core';

    export const ${name && capitalizeFirstLetter(name)}ConnectButton = () => {
      const framework = Framework.init(config);
      const OAuthConnectionRoute = framework?.makeConnectURI({
        clientRedirectPath: 'YOUR_REDIRECT_PATH',
        name: '${name}',
        referenceId: 'YOUR_REFERENCE_ID',
      });

      return (
        <a href={OAuthConnectionRoute}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded inline-block"
        >
          Connect with ${name && capitalizeFirstLetter(name)}
        </a>
      );
    };
    `;

  return <CodeBlock snippet={snippet} className={className} innerClassName={innerClassName} />;
};
