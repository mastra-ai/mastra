import { useIntegrationConnectSnippet } from '../hooks/use-integration';

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
  const { snippet } = useIntegrationConnectSnippet({
    name,
  });

  return <CodeBlock snippet={snippet} className={className} innerClassName={innerClassName} />;
};
