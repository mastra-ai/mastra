import { ExternalLinkIcon, Link2Icon } from 'lucide-react';
import { dataKeysAndValuesValueStyles } from './shared';
import type { LinkComponent } from '@/ds/types/link-component';
import { cn } from '@/lib/utils';

export interface DataKeysAndValuesValueLinkProps {
  className?: string;
  children: React.ReactNode;
  href: string;
  LinkComponent: LinkComponent;
}

function isExternalUrl(href: string) {
  return /^https?:\/\//.test(href);
}

export function DataKeysAndValuesValueLink({
  className,
  children,
  href,
  LinkComponent: Link,
}: DataKeysAndValuesValueLinkProps) {
  const isExternal = isExternalUrl(href);

  const linkClassName = cn(
    'truncate flex items-center gap-2 hover:text-neutral4 transition-colors',
    '[&>svg]:w-4 [&>svg]:h-4 [&>svg]:shrink-0 [&>svg]:opacity-70 [&:hover>svg]:opacity-100',
  );

  if (isExternal) {
    return (
      <dd className={cn(dataKeysAndValuesValueStyles, className)}>
        <a href={href} target="_blank" rel="noopener noreferrer" className={linkClassName}>
          <span>{children}</span>
          <ExternalLinkIcon />
        </a>
      </dd>
    );
  }

  return (
    <dd className={cn(dataKeysAndValuesValueStyles, className)}>
      <Link href={href} className={linkClassName}>
        <span>{children}</span>
        <Link2Icon />
      </Link>
    </dd>
  );
}
