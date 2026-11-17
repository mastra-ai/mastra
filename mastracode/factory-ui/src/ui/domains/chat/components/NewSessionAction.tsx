import { Button } from '@mastra/playground-ui/components/Button';
import { useOpenNewUserSession } from '../../workspaces/hooks/useOpenNewUserSession';
import { useChatModelScope } from '../context/useChatModelScope';
import { IconArrowRight } from '@mastra/playground-ui/icons/central/IconArrowRight';

export function NewSessionAction() {
  const { factoryId } = useChatModelScope();
  const openNewUserSession = useOpenNewUserSession();
  if (!factoryId) return null;
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => openNewUserSession(factoryId)}
      iconEnd={<IconArrowRight aria-hidden="true" />}
    >
      New session
    </Button>
  );
}
