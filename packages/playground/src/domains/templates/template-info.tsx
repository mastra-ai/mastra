import { InlineCode } from '@mastra/playground-ui/components/InlineCode';
import { KeyValueList } from '@mastra/playground-ui/components/KeyValueList';
import type { KeyValueListItemData } from '@mastra/playground-ui/components/KeyValueList';
import { Txt } from '@mastra/playground-ui/components/Txt';
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
        <Txt
          as="div"
          variant="title"
          className={cn('flex items-center gap-3', '[&>svg]:h-[1.2em] [&>svg]:w-[1.2em] [&>svg]:opacity-50', {
            '[&>svg]:opacity-20': isLoading,
          })}
        >
          <PackageIcon />
          <h2
            className={cn({
              'flex min-w-[50%] rounded-lg bg-muted': isLoading,
            })}
          >
            {isLoading ? <>&nbsp;</> : title}
          </h2>
        </Txt>
      </div>
      <div className="grid gap-x-24 lg:grid-cols-[1fr_1fr]">
        <div className="grid">
          <Txt
            tone="muted"
            className={cn('mt-2 mb-4', {
              'rounded-lg bg-muted': isLoading,
            })}
          >
            {isLoading ? <>&nbsp;</> : description}
          </Txt>

          {/* Git Branch Notice */}
          {!isLoading && templateSlug && (
            <div className={cn('mb-4 rounded-lg border border-border bg-background p-4', 'flex items-start gap-3')}>
              <div className="mt-0.5 shrink-0">
                <InfoIcon className="h-[1.1em] w-[1.1em] text-info-indicator" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <GitBranchIcon className="h-[1em] w-[1em] text-muted-foreground" />
                  <Txt as="span" variant="subheading" tone="ink">
                    A new Git branch will be created
                  </Txt>
                </div>
                <Txt as="div" variant="caption" tone="muted" className="space-y-1">
                  <div>
                    <Txt as="span" variant="column">
                      Branch name:
                    </Txt>{' '}
                    <InlineCode>{branchName}</InlineCode>
                  </div>
                  <div>
                    This ensures safe installation with easy rollback if needed. Your main branch remains unchanged.
                  </div>
                </Txt>
              </div>
            </div>
          )}

          {githubUrl && (
            <Txt
              as="a"
              variant="body"
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(quietTextHover, 'mt-auto flex items-center gap-2')}
            >
              <GithubIcon />
              {githubUrl?.split('/')?.pop()}
            </Txt>
          )}
        </div>

        {infoData && <KeyValueList data={infoData} labelsAreHidden={true} isLoading={isLoading} />}
      </div>
    </>
  );
}
