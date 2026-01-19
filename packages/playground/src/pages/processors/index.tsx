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
} from '@mastra/playground-ui';

import { Link } from 'react-router';

const ProcessorIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M12 2L2 7L12 12L22 7L12 2Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function Processors() {
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
          <Button as={Link} to="https://mastra.ai/en/docs/processors" target="_blank">
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
