import { useSessionHost } from '../context/SessionHostContext';
import { useChatModelScope } from '../context/useChatModelScope';
import { Button } from '@/ds/components/Button';

import { IconArrowRight } from '@/ds/icons/central/IconArrowRight';

/** Observer and reflector models come from Memory settings, not the session model picker. */
export function ChangeMemoryModelAction() {
  const { LinkComponent, links } = useSessionHost();
  const { factoryId } = useChatModelScope();
  if (!factoryId) return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      render={<LinkComponent href={links.settings('memory')} returnHere />}
      iconEnd={<IconArrowRight aria-hidden="true" />}
    >
      Change memory model
    </Button>
  );
}
