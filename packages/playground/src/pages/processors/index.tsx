import { Button, ProcessorList, useProcessors, ProcessorIcon, PageContent, MainHeader } from '@mastra/playground-ui';
import { ExternalLinkIcon } from 'lucide-react';
import { Link } from 'react-router';

export function Processors() {
  const { data: processors = {}, isLoading, error } = useProcessors();

  return (
    <PageContent>
      <PageContent.TopBar>
        <Button
          as={Link}
          to="https://mastra.ai/docs/agents/processors"
          target="_blank"
          rel="noopener noreferrer"
          variant="ghost"
          size="md"
        >
          Processors documentation
          <ExternalLinkIcon />
        </Button>
      </PageContent.TopBar>
      <PageContent.Main>
        <div className="w-full max-w-[80rem] px-10 mx-auto grid h-full grid-rows-[auto_1fr] overflow-y-auto">
          <MainHeader>
            <MainHeader.Column>
              <MainHeader.Title isLoading={isLoading}>
                <ProcessorIcon /> Processors
              </MainHeader.Title>
            </MainHeader.Column>
          </MainHeader>

          <ProcessorList processors={processors} isLoading={isLoading} error={error} />
        </div>
      </PageContent.Main>
    </PageContent>
  );
}
