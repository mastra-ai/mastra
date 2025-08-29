import { PackageOpenIcon } from 'lucide-react';
import { Container } from './shared';
import { cn } from '@/lib/utils';
import { type KeyValueListItemData, KeyValueList } from '@/components/ui/elements';

type TemplateSuccessProps = {
  name: string;
  entities?: string[];
  installedEntities?: KeyValueListItemData[];
  linkComponent: any;
};

export function TemplateSuccess({ name, installedEntities, linkComponent }: TemplateSuccessProps) {
  const LinkComponent = linkComponent || 'a';
  return (
    <Container
      className={cn(
        'grid items-center justify-items-center gap-[1rem] content-center',
        '[&>svg]:w-[2rem] [&>svg]:h-[2rem]',
      )}
    >
      <PackageOpenIcon />
      <h2 className="text-[1.25rem ]">Done!</h2>
      <p className="text-[0.875rem] text-center text-icon3 ">
        The <b className="text-icon4">{name}</b> template has been successfully installed.
        {installedEntities && installedEntities.length > 0 && (
          <>
            <br /> Installed entities are listed below.
          </>
        )}
      </p>
      {installedEntities && installedEntities.length > 0 && (
        <KeyValueList data={installedEntities} LinkComponent={LinkComponent} />
      )}
    </Container>
  );
}
