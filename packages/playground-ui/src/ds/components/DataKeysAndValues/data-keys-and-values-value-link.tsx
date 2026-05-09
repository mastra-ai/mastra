import { ExternalLinkIcon, Link2Icon } from 'lucide-react';
import { dataKeysAndValuesValueStyles } from './shared';
import { cn } from '@/lib/utils';

export interface DataKeysAndValuesValueLinkProps {
  className?: string;
  children: React.ReactNode;
  href: string;
  as?: React.ElementType;
}

function isExternalUrl(href: string) {
  return /^https?:\/\//.test(href);
}

export function DataKeysAndValuesValueLink({ className, children, href, as }: DataKeysAndValuesValueLinkProps) {
  const isExternal = isExternalUrl(href);
  const Component = as || 'a';
  // Pass `to` only for custom components so React-Router's `Link` (which reads `to`) works
  // while native anchors don't get an unknown `to` attribute warning.
  const navigationProps = as ? { href, to: href } : { href };

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
      <Component {...navigationProps} className={linkClassName}>
        <span>{children}</span>
        <Link2Icon />
      </Component>
    </dd>
  );
}
