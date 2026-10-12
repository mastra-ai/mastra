import { Combobox } from '@mastra/playground-ui/components/Combobox';
import type { ComboboxProps } from '@mastra/playground-ui/components/Combobox';
import { AgentIcon } from '@mastra/playground-ui/icons/AgentIcon';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { toast } from '@mastra/playground-ui/utils/toast';
import { useAgents } from '@mastra/react/hooks/agents';
import { isAuthenticated, useAuthCapabilities } from '@mastra/react/hooks/auth';
import { History, Pin } from 'lucide-react';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useAgentLinkInCurrentView } from '../hooks/use-agent-link-in-current-view';
import { useAgentPins } from '../hooks/use-agent-pins';
import { useStoredRecentAgentIds } from '../hooks/use-recent-agent-ids';

export interface AgentComboboxProps {
  value?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  variant?: ComboboxProps['variant'];
  size?: ComboboxProps['size'];
  'aria-label'?: string;
  align?: ComboboxProps['align'];
}

export function AgentCombobox({
  value,
  onValueChange,
  placeholder = 'Select an agent...',
  searchPlaceholder = 'Search agents...',
  emptyText = 'No agents found.',
  className,
  disabled = false,
  variant,
  size,
  'aria-label': ariaLabel,
  align,
}: AgentComboboxProps) {
  const { data: agents = {}, isLoading, isError, error } = useAgents();
  const { navigate } = useLinkComponent();
  const agentLink = useAgentLinkInCurrentView();
  const { pinnedAgentIds } = useAgentPins();
  const { data: auth } = useAuthCapabilities();
  const storedRecentIds = useStoredRecentAgentIds(auth && isAuthenticated(auth) ? auth.user.id : undefined);

  useEffect(() => {
    if (isError) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load agents';
      toast.error(`Error loading agents: ${errorMessage}`);
    }
  }, [isError, error]);

  const pinnedIds = pinnedAgentIds.filter(id => agents[id]);
  const recentIds = storedRecentIds.filter(id => agents[id] && !pinnedIds.includes(id));
  const otherIds = Object.keys(agents).filter(id => !pinnedIds.includes(id) && !recentIds.includes(id));
  const agentOption = (id: string, end?: ReactNode) => ({
    label: agents[id]?.name || id,
    value: id,
    start: <AgentIcon className="size-4 shrink-0" />,
    end,
  });
  const agentOptions = [
    ...pinnedIds.map(id => agentOption(id, <Pin aria-label="Pinned" className="size-3.5" />)),
    ...recentIds.map(id => agentOption(id, <History aria-label="Recent" className="size-3.5" />)),
    ...otherIds.map(id => agentOption(id)),
  ];

  const handleValueChange = (newAgentId: string) => {
    if (onValueChange) {
      onValueChange(newAgentId);
    } else if (newAgentId && newAgentId !== value) {
      navigate(agentLink(newAgentId));
    }
  };

  return (
    <Combobox
      options={agentOptions}
      value={value}
      onValueChange={handleValueChange}
      placeholder={isLoading ? 'Loading agents...' : placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyText={emptyText}
      className={className}
      disabled={disabled || isLoading || isError}
      variant={variant}
      size={size}
      aria-label={ariaLabel}
      align={align}
    />
  );
}
