import { Button } from '@mastra/playground-ui/components/Button';
import { ArrowRight } from 'lucide-react';

import { useOpenNewUserSession } from '../../workspaces/hooks/useOpenNewUserSession';
import { useChatModelScope } from '../context/useChatModelScope';

export function NewSessionAction() {
  const { factoryId } = useChatModelScope();
  const openNewUserSession = useOpenNewUserSession();
  if (!factoryId) return null;
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => openNewUserSession(factoryId)}
      iconEnd={<ArrowRight aria-hidden="true" />}
    >
      New session
    </Button>
  );
}
