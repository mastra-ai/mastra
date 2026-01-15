import { GithubIcon } from '@/ds/icons';
import { cn } from '@/lib/utils';
import { Link, PackageIcon, GitBranchIcon, InfoIcon } from 'lucide-react';
import { KeyValueList, type KeyValueListItemData } from '@/ds/components/KeyValueList';

type TemplateInfoProps = {
  title?: string;
  description?: string;
  imageURL?: string;
  githubUrl?: string;
  infoData?: KeyValueListItemData[];
  isLoading?: boolean;
  templateSlug?: string;
};

export function TemplateInfo({
  title,
  description,
  imageURL,
  githubUrl,
  isLoading,
  infoData,
  templateSlug,
}: TemplateInfoProps) {
  // Generate branch name that will be created
  const branchName = templateSlug ? `feat/install-template-${templateSlug}` : 'feat/install-template-[slug]';

  return (
    <>
      <div className={cn('grid mt-8 items-center')}>
        <div
          className={cn(
            'text-header-lg flex items-center gap-3',
            '[&>svg]:w-[1.2em] [&>svg]:h-[1.2em] [&>svg]:opacity-50',
            {
              '[&>svg]:opacity-20': isLoading,
            },
          )}
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
      <div className="grid lg:grid-cols-[1fr_1fr] gap-x-24">
        <div className="grid">
          <p
            className={cn('mb-4 text-ui-md text-neutral4 mt-2 leading-7', {
              'bg-surface4 rounded-lg ': isLoading,
            })}
          >
            {isLoading ? <>&nbsp;</> : description}
          </p>

          {/* Git Branch Notice */}
          {!isLoading && templateSlug && (
            <div className={cn('bg-surface2 border border-surface4 rounded-lg p-4 mb-4', 'flex items-start gap-3')}>
              <div className="flex-shrink-0 mt-0.5">
                <InfoIcon className="w-[1.1em] h-[1.1em] text-blue-500" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <GitBranchIcon className="w-[1em] h-[1em] text-neutral4" />
                  <span className="text-ui-md font-medium text-neutral5">A new Git branch will be created</span>
                </div>
                <div className="text-ui-sm text-neutral4 space-y-1">
                  <div>
                    <span className="font-medium">Branch name:</span>{' '}
                    <code className="bg-surface3 px-1.5 py-0.5 rounded text-ui-sm font-mono">{branchName}</code>
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
              className="flex items-center gap-2 mt-auto text-neutral3 text-ui-md hover:text-neutral5"
            >
              <GithubIcon />
              {githubUrl?.split('/')?.pop()}
            </a>
          )}
        </div>

        {infoData && <KeyValueList data={infoData} LinkComponent={Link} labelsAreHidden={true} isLoading={isLoading} />}
      </div>
    </>
  );
}
