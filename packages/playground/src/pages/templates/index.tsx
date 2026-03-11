import { Button, DocsIcon, TemplatesList, PageContent, MainHeader } from '@mastra/playground-ui';
import { PackageIcon } from 'lucide-react';
import { Link } from 'react-router';

import { useMastraTemplates } from '@/hooks/use-templates';

export default function Templates() {
  const { data, isLoading } = useMastraTemplates();
  const { templates, tags, providers } = data ?? { templates: [], tags: [], providers: [] };

  return (
    <PageContent>
      <PageContent.TopBar>
        <Button as={Link} to="https://mastra.ai/en/docs/overview" target="_blank" rel="noopener noreferrer" variant="ghost" size="md">
          <DocsIcon />
          Templates documentation
        </Button>
      </PageContent.TopBar>
      <PageContent.Main>
        <div className="w-full max-w-[90rem] px-10 mx-auto grid h-full grid-rows-[auto_1fr] overflow-y-auto">
          <MainHeader>
            <MainHeader.Column>
              <MainHeader.Title isLoading={isLoading}>
                <PackageIcon /> Templates
              </MainHeader.Title>
            </MainHeader.Column>
          </MainHeader>

          <TemplatesList templates={templates} tags={tags ?? []} providers={providers ?? []} isLoading={isLoading} />
        </div>
      </PageContent.Main>
    </PageContent>
  );
}
