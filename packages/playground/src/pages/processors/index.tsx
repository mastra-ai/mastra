import {
  MainContentLayout,
  Header,
  HeaderTitle,
  MainContentContent,
  Icon,
  HeaderAction,
  DocsIcon,
  Button,
  ProcessorIcon,
} from '@mastra/playground-ui';
import { ProcessorTable, useProcessors } from '@mastra/playground-ui/processors';

import { Link } from 'react-router';

export function Processors() {
  const { data: processors = {}, isLoading, error } = useProcessors();

  const isEmpty = !isLoading && Object.keys(processors).length === 0;

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>
          <Icon>
            <ProcessorIcon />
          </Icon>
          Processors
        </HeaderTitle>

        <HeaderAction>
          <Button
            as={Link}
            to="https://mastra.ai/docs/agents/processors"
            target="_blank"
            rel="noopener noreferrer"
            variant="ghost"
            size="md"
          >
            <DocsIcon />
            Processors documentation
          </Button>
        </HeaderAction>
      </Header>

      <MainContentContent isCentered={isEmpty}>
        <ProcessorTable processors={processors} isLoading={isLoading} error={error} />
      </MainContentContent>
    </MainContentLayout>
  );
}
