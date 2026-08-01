import { KeyValueList } from '@mastra/playground-ui/components/KeyValueList';
import type { KeyValueListItemData } from '@mastra/playground-ui/components/KeyValueList';
import { cn } from '@mastra/playground-ui/utils/cn';
import { PackageOpenIcon } from 'lucide-react';
import type { ComponentType } from 'react';
import { Container } from './shared';

type TemplateSuccessProps = {
  name: string;
  entities?: string[];
  installedEntities?: KeyValueListItemData[];
  linkComponent?: ComponentType<any>;
};

export function TemplateSuccess({ name, installedEntities }: TemplateSuccessProps) {
  return (
    <Container className={cn('grid items-center justify-items-center gap-4 content-center', '[&>svg]:w-8 [&>svg]:h-8')}>
      <PackageOpenIcon />
      <h2 className="text-header-md">Done!</h2>
      <p className="text-ui-md text-neutral3 text-center">
        The <b className="text-neutral4">{name}</b> template has been successfully installed.
        {installedEntities && installedEntities.length > 0 && (
          <>
            <br /> Installed entities are listed below.
          </>
        )}
      </p>
      {installedEntities && installedEntities.length > 0 && <KeyValueList data={installedEntities} />}
    </Container>
  );
}
