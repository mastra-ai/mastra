import {
  Button,
  ButtonWithTooltip,
  useLinkComponent,
  useIsCmsAvailable,
  useStoredPromptBlocks,
  PromptsList,
  ListSearch,
  MainHeader,
  EntityListPageLayout,
} from '@mastra/playground-ui';
import { BookIcon, FileTextIcon, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

export default function PromptBlocks() {
  const { paths } = useLinkComponent();
  const { data, isLoading } = useStoredPromptBlocks();
  const { isCmsAvailable } = useIsCmsAvailable();
  const [search, setSearch] = useState('');

  const promptBlocks = data?.promptBlocks ?? [];

  return (
    <EntityListPageLayout>
      <EntityListPageLayout.Top>
        <MainHeader withMargins={false}>
          <MainHeader.Column>
            <MainHeader.Title isLoading={isLoading}>
              <FileTextIcon /> Prompts
            </MainHeader.Title>
          </MainHeader.Column>
          <MainHeader.Column className="flex justify-end gap-2">
            <ButtonWithTooltip
              as="a"
              href="https://mastra.ai/en/docs/agents/agent-instructions#prompt-blocks"
              target="_blank"
              rel="noopener noreferrer"
              tooltipContent="Go to Prompts documentation"
            >
              <BookIcon />
            </ButtonWithTooltip>
            {isCmsAvailable && (
              <Button as={Link} to={paths.cmsPromptBlockCreateLink()} variant="primary">
                <Plus />
                Create Prompt
              </Button>
            )}
          </MainHeader.Column>
        </MainHeader>
        <div className="max-w-120">
          <ListSearch onSearch={setSearch} label="Filter prompts" placeholder="Filter by name or description" />
        </div>
      </EntityListPageLayout.Top>

      <PromptsList promptBlocks={promptBlocks} isLoading={isLoading} search={search} onSearch={setSearch} />
    </EntityListPageLayout>
  );
}
