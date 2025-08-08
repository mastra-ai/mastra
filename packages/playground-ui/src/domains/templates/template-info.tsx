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
      <div
        className={cn('grid grid-cols-[1fr_1fr] gap-x-[6rem] mt-[2rem]', {
          '[&>h2]:bg-surface': isLoading,
        })}
      >
        <h2
          className={cn(
            'text-[1.5rem] flex items-center gap-[0.75rem] py-[1rem]',
            '[&>svg]:w-[1.2em] [&_svg]:h-[1.2em] [&_svg]:opacity-50',
          )}
        >
          <PackageIcon />
          {title}
        </h2>
        <div
          className="w-full h-full bg-cover bg-center transition-scale duration-150 rounded-lg overflow-hidden"
          style={{
            backgroundImage: `url(${imageURL})`,
          }}
        />
      </div>
      <div className="grid grid-cols-[1fr_1fr]  gap-x-[6rem] mt-[2rem] ">
        <div className="grid">
          <p className="mb-[1rem] text-[0.875rem] text-icon4">{description}</p>
          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-[.5rem] mt-auto text-icon3 text-[0.875rem] hover:text-icon5"
          >
            <GithubIcon />
            {githubUrl?.split('/')?.pop()}
          </a>
        </div>

        {infoData && <KeyValueList data={infoData} LinkComponent={Link} labelsAreHidden={true} />}
      </div>
    </>
  );
}
