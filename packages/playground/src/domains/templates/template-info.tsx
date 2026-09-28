import { InlineCode } from '@mastra/playground-ui/components/InlineCode';
import { KeyValueList } from '@mastra/playground-ui/components/KeyValueList';
import type { KeyValueListItemData } from '@mastra/playground-ui/components/KeyValueList';
import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';
import { quietTextHover } from '@mastra/playground-ui/primitives/typography';
import { cn } from '@mastra/playground-ui/utils/cn';
import { PackageIcon, GitBranchIcon, InfoIcon } from 'lucide-react';

type TemplateInfoProps = {
  title?: string;
  description?: string;
  imageURL?: string;
  githubUrl?: string;
  infoData?: KeyValueListItemData[];
  isLoading?: boolean;
  templateSlug?: string;
};

export function TemplateInfo({ title, description, githubUrl, isLoading, infoData, templateSlug }: TemplateInfoProps) {
  // Generate branch name that will be created
  const branchName = templateSlug ? `feat/install-template-${templateSlug}` : 'feat/install-template-[slug]';

  return (
    <>
      <div className={cn('mt-5 grid items-center')}>
        <div
          className={cn(
            'flex items-center gap-3 text-title',
            '[&>svg]:h-[1.2em] [&>svg]:w-[1.2em] [&>svg]:opacity-50',
            {
              '[&>svg]:opacity-20': isLoading,
            },
          )}
        >
          <PackageIcon />
          <h2
            className={cn({
              'flex min-w-[50%] rounded-lg bg-muted': isLoading,
            })}
          >
            {isLoading ? <>&nbsp;</> : title}
          </h2>
        </div>
      </div>
      <div className="grid gap-x-24 lg:grid-cols-[1fr_1fr]">
        <div className="grid">
          <p
            className={cn('mt-2 mb-4 text-body text-muted-foreground', {
              'rounded-lg bg-muted': isLoading,
            })}
          >
            {isLoading ? <>&nbsp;</> : description}
          </p>

          {/* Git Branch Notice */}
          {!isLoading && templateSlug && (
            <div className={cn('mb-4 rounded-lg border border-border bg-background p-4', 'flex items-start gap-3')}>
              <div className="mt-0.5 shrink-0">
                <InfoIcon className="h-[1.1em] w-[1.1em] text-blue-500" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <GitBranchIcon className="h-[1em] w-[1em] text-muted-foreground" />
                  <span className="text-subheading text-foreground">A new Git branch will be created</span>
                </div>
                <div className="space-y-1 text-caption text-muted-foreground">
                  <div>
                    <span className="font-medium">Branch name:</span> <InlineCode>{branchName}</InlineCode>
                  </div>
                  <div>
                    This ensures safe installation with easy rollback if needed. Your main branch remains unchanged.
                  </div>
                </div>
              </div>
            </div>
          )}

          {githubUrl && (
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(quietTextHover, 'mt-auto flex items-center gap-2 text-body')}
            >
              <GithubIcon />
              {githubUrl?.split('/')?.pop()}
            </a>
          )}
        </div>

        {infoData && <KeyValueList data={infoData} labelsAreHidden={true} isLoading={isLoading} />}
      </div>
    </>
  );
}
