import { Button } from '@mastra/playground-ui/components/Button';
import { Menu } from 'lucide-react';

import { useOverlays } from '../../../lib/overlays/overlays';

/** Mobile-only chat header: exposes the sidebar toggle. Hidden on desktop. */
export function ChatHeader() {
  const overlays = useOverlays();

  return (
    <header className="flex items-center gap-2 border-b border-border1 px-3 py-2 md:hidden">
      <Button variant="ghost" size="icon-sm" onClick={() => overlays.toggle('sidebar')} aria-label="Toggle sidebar">
        <Menu />
      </Button>
    </header>
  );
}
