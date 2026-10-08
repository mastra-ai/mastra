import { Button } from '@mastra/playground-ui/components/Button';
import { Sidebar } from '@mastra/playground-ui/components/Sidebar';
import { Pin, PinOff } from 'lucide-react';
import { useLocation } from 'react-router';
import { buildResourceCatalog } from '../utils/build-resource-catalog';
import type { BuildResource } from '../utils/build-resource-history';

export function BuildResourceShortcut({
  resource,
  pinned,
  onTogglePin,
}: {
  resource: BuildResource;
  pinned: boolean;
  onTogglePin: () => void;
}) {
  const { pathname, hash } = useLocation();
  const { Icon, label } = buildResourceCatalog[resource.kind];
  const actionLabel = pinned ? `Unpin ${resource.name}` : `Pin ${resource.name}`;
  return (
    <Sidebar.NavLink
      state="default"
      link={{ name: resource.name, url: resource.path, icon: <Icon />, tooltipMsg: `${label} · ${resource.name}` }}
      isActive={`${pathname}${hash}` === resource.path}
      action={
        <Button variant="ghost" size="icon-sm" aria-label={actionLabel} title={actionLabel} onClick={onTogglePin}>
          {pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
        </Button>
      }
    />
  );
}
