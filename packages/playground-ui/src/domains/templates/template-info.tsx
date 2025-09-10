import { GithubIcon } from '@/ds/icons';
import { cn } from '@/lib/utils';
import { Link, PackageIcon, GitBranchIcon, InfoIcon } from 'lucide-react';
import { KeyValueList, type KeyValueListItemData } from '@/components/ui/elements';

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
      <div className={cn('grid lg:grid-cols-[1fr_1fr] gap-x-[6rem] mt-[2rem] lg:min-h-[4rem] items-center ')}>
        <div
          className={cn(
            'text-[1.5rem] flex items-center gap-[0.75rem] ',
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
        <div
          className="w-full h-full bg-cover bg-center transition-scale duration-150 rounded-lg overflow-hidden min-h-[2rem] mt-[2rem] lg:mt-0"
          style={{
            backgroundImage: `url(${imageURL})`,
          }}
        />
      </div>
      <div className="grid lg:grid-cols-[1fr_1fr] gap-x-[6rem] mt-[2rem] ">
        <div className="grid">
          <p
            className={cn('mb-[1rem] text-[0.875rem] text-icon4 mt-[.5rem] leading-[1.75]', {
              'bg-surface4 rounded-lg ': isLoading,
            })}
          >
            {isLoading ? <>&nbsp;</> : description}
          </p>

          {/* Git Branch Notice */}
          {!isLoading && templateSlug && (
            <div
              className={cn(
                'bg-surface2 border border-surface4 rounded-lg p-[1rem] mb-[1rem]',
                'flex items-start gap-[0.75rem]',
              )}
            >
              <div className="flex-shrink-0 mt-[0.125rem]">
                <InfoIcon className="w-[1.1em] h-[1.1em] text-blue-500" />
              </div>
              <div className="flex-1 space-y-[0.5rem]">
                <div className="flex items-center gap-[0.5rem]">
                  <GitBranchIcon className="w-[1em] h-[1em] text-icon4" />
                  <span className="text-[0.875rem] font-medium text-icon5">A new Git branch will be created</span>
                </div>
                <div className="text-[0.8125rem] text-icon4 space-y-[0.25rem]">
                  <div>
                    <span className="font-medium">Branch name:</span>{' '}
                    <code className="bg-surface3 px-[0.375rem] py-[0.125rem] rounded text-[0.75rem] font-mono">
                      {branchName}
                    </code>
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
              className="flex items-center gap-[.5rem] mt-auto text-icon3 text-[0.875rem] hover:text-icon5"
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
