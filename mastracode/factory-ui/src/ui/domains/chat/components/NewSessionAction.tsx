import { Button } from '@mastra/playground-ui/components/Button';
import { useMaybeSidebar } from '@mastra/playground-ui/components/Sidebar';
import { useSessionHost } from '../context/SessionHostContext';
import { useChatModelScope } from '../context/useChatModelScope';
import { IconArrowRight } from '@mastra/playground-ui/icons/central/IconArrowRight';

export function NewSessionAction() {
  const { factoryId } = useChatModelScope();
  const { navigate, links } = useSessionHost();
  const sidebar = useMaybeSidebar();
  if (!factoryId) return null;
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        navigate(links.newUserSession());
        sidebar?.setOpenMobile(false);
      }}
      iconEnd={<IconArrowRight aria-hidden="true" />}
    >
      New session
    </Button>
  );
}
