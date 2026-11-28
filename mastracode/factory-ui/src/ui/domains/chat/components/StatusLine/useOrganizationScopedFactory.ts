import { useSessionHost } from '../../context/SessionHostContext';
import { useChatModelScope } from '../../context/useChatModelScope';

/** Whether the picker's list is narrowed to the organization's credentials, leaving out personal ones. */
export function useOrganizationScopedFactory(): boolean {
  const authQuery = useSessionHost().data.useViewer();
  const { modelScope } = useChatModelScope();
  return authQuery.data?.authEnabled === true && modelScope === 'factory';
}
