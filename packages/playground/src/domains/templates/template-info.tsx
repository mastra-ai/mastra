import { KeyValueList } from '@mastra/playground-ui/components/KeyValueList';
import type { KeyValueListItemData } from '@mastra/playground-ui/components/KeyValueList';
import { GithubIcon } from '@mastra/playground-ui/icons/GithubIcon';
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
      <div className={cn('mt-8 grid items-center')}>
        <div
          className={cn('flex items-center gap-3 text-header-lg', '[&>svg]:size-[1.2em] [&>svg]:opacity-50', {
            '[&>svg]:opacity-20': isLoading,
          })}
        >
          <PackageIcon />
          <h2
            className={cn({
              'bg-surface4 flex rounded-lg min-w-[50%]': isLoading,
            })}
          >
            {isLoading ? <>&nbsp;</> : title}
          </h2>
        </div>
      </div>
      <div className="grid gap-x-24 lg:grid-cols-[1fr_1fr]">
        <div className="grid">
          <p
            className={cn('mt-2 mb-4 text-ui-md leading-7 text-neutral4', {
              'bg-surface4 rounded-lg ': isLoading,
            })}
          >
            {isLoading ? <>&nbsp;</> : description}
          </p>

          {/* Git Branch Notice */}
          {!isLoading && templateSlug && (
            <div className={cn('mb-4 rounded-lg border border-surface4 bg-surface2 p-4', 'flex items-start gap-3')}>
              <div className="mt-0.5 shrink-0">
                <InfoIcon className="size-[1.1em] text-blue-500" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <GitBranchIcon className="size-[1em] text-neutral4" />
                  <span className="text-ui-md font-medium text-neutral5">A new Git branch will be created</span>
                </div>
                <div className="space-y-1 text-ui-sm text-neutral4">
                  <div>
                    <span className="font-medium">Branch name:</span>{' '}
                    <code className="rounded bg-surface3 px-1.5 py-0.5 font-mono text-ui-sm">{branchName}</code>
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
              className="mt-auto flex items-center gap-2 text-ui-md text-neutral3 hover:text-neutral5"
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
