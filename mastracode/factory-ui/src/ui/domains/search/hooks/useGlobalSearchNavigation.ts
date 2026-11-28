import { useSessionHost } from '@mastra/playground-ui/domains/factory/session/thread/chat/context/SessionHostContext';

export function useGlobalSearchNavigation(closeSearch: () => void) {
  const { navigate } = useSessionHost();

  const selectPath = (path: string, preserveOrigin: boolean) => {
    navigate(path, { returnHere: preserveOrigin });
    closeSearch();
  };

  return { selectPath };
}
