import {
  MainContentLayout,
  Header,
  HeaderTitle,
  MainContentContent,
  Icon,
  HeaderAction,
  DocsIcon,
  Button,
  ProcessorTable,
  useProcessors,
  ProcessorIcon,
} from '@mastra/playground-ui';

import { Link } from 'react-router';

export function Processors() {
  const { data: processors = {}, isLoading } = useProcessors();

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
          <Button as={Link} to="https://mastra.ai/docs/agents/processors" target="_blank" rel="noopener noreferrer">
            <Icon>
              <DocsIcon />
            </Icon>
            Processors documentation
          </Button>
        </HeaderAction>
      </Header>

      <MainContentContent isCentered={isEmpty}>
        <ProcessorTable processors={processors} isLoading={isLoading} />
      </MainContentContent>
    </MainContentLayout>
  );
}
