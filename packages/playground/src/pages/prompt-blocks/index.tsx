import {
  Button,
  useLinkComponent,
  useIsCmsAvailable,
  useStoredPromptBlocks,
  PromptBlockList,
  PageContent,
  MainHeader,
} from '@mastra/playground-ui';
import { ExternalLinkIcon, FileTextIcon, Plus } from 'lucide-react';
import { Link } from 'react-router';

export default function PromptBlocks() {
  const { Link: FrameworkLink, paths } = useLinkComponent();
  const { data, isLoading } = useStoredPromptBlocks();
  const { isCmsAvailable } = useIsCmsAvailable();

  const promptBlocks = data?.promptBlocks ?? [];

  return (
    <PageContent>
      <PageContent.TopBar>
        <Button
          as={Link}
          to="https://mastra.ai/en/docs/agents/agent-instructions#prompt-blocks"
          target="_blank"
          variant="ghost"
          size="md"
        >
          Prompts documentation
          <ExternalLinkIcon />
        </Button>
      </PageContent.TopBar>
      <PageContent.Main>
        <div className="w-full max-w-[80rem] px-10 mx-auto grid h-full grid-rows-[auto_1fr] overflow-y-auto">
          <MainHeader>
            <MainHeader.Column>
              <MainHeader.Title isLoading={isLoading}>
                <FileTextIcon /> Prompts
              </MainHeader.Title>
            </MainHeader.Column>
            {isCmsAvailable && (
              <MainHeader.Column>
                <Button variant="primary" as={FrameworkLink} to={paths.cmsPromptBlockCreateLink()}>
                  <Plus />
                  Create Prompt Block
                </Button>
              </MainHeader.Column>
            )}
          </MainHeader>

          <PromptBlockList promptBlocks={promptBlocks} isLoading={isLoading} />
        </div>
      </PageContent.Main>
    </PageContent>
  );
}
