import {
  useLinkComponent,
  MainContentLayout,
  Header,
  HeaderTitle,
  Icon,
} from '@mastra/playground-ui';
import { PromptBlockCreateContent } from '@mastra/playground-ui/prompt-blocks';
import { BookIcon } from 'lucide-react';

function CmsPromptBlocksCreatePage() {
  const { navigate, paths } = useLinkComponent();

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>
          <Icon>
            <BookIcon />
          </Icon>
          Create a prompt block
        </HeaderTitle>
      </Header>
      <PromptBlockCreateContent onSuccess={block => navigate(paths.cmsPromptBlockEditLink(block.id))} />
    </MainContentLayout>
  );
}

export { CmsPromptBlocksCreatePage };

export default CmsPromptBlocksCreatePage;
