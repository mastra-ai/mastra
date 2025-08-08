import { GithubIcon } from '@/ds/icons';
import { cn } from '@/lib/utils';
import { Link, PackageIcon } from 'lucide-react';
import { KeyValueList, type KeyValueListItemData } from '@/components/ui/elements';

type TemplateInfoProps = {
  title?: string;
  description?: string;
  imageURL?: string;
  githubUrl?: string;
  infoData?: KeyValueListItemData[];
  isLoading?: boolean;
};

export function TemplateInfo({ title, description, imageURL, githubUrl, isLoading, infoData }: TemplateInfoProps) {
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
