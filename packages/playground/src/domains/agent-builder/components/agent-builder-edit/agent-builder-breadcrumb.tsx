import { Breadcrumb, Crumb, Icon, Skeleton } from '@mastra/playground-ui';
import { MessageCircleIcon, SlidersHorizontalIcon } from 'lucide-react';
import type { ComponentProps } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Link } from 'react-router';
import type { AgentBuilderEditFormValues } from '../../schemas';
import type { WorkspaceMode } from './workspace-layout';

export interface AgentBuilderBreadcrumbProps {
  className?: string;
  isLoading?: boolean;
  mode?: WorkspaceMode;
  creating?: boolean;
}

const MODE_META: Record<WorkspaceMode, { label: string; Icon: typeof MessageCircleIcon; iconTestId: string }> = {
  build: {
    label: 'Edit agent capabilities',
    Icon: SlidersHorizontalIcon,
    iconTestId: 'agent-builder-mode-icon-build',
  },
  test: {
    label: 'Chat',
    Icon: MessageCircleIcon,
    iconTestId: 'agent-builder-mode-icon-test',
  },
};

const AgentsLink = (props: ComponentProps<typeof Link>) => <Link {...props} viewTransition />;

export const AgentBuilderBreadcrumb = ({
  className,
  isLoading = false,
  mode,
  creating = false,
}: AgentBuilderBreadcrumbProps) => {
  const { control } = useFormContext<AgentBuilderEditFormValues>();
  const name = useWatch({ control, name: 'name' });

  if (creating) {
    return (
      <div className={className} data-testid="agent-builder-breadcrumb">
        <span
          aria-current="page"
          className="block text-ui-md leading-ui-md text-white truncate"
          data-testid="agent-builder-create-title"
        >
          New agent
        </span>
      </div>
    );
  }

  const displayName = name && name.trim() ? name : 'Untitled';
  const modeMeta = mode ? MODE_META[mode] : null;

  return (
    <div className={className} data-testid="agent-builder-breadcrumb">
      <span
        aria-current="page"
        className="block lg:hidden text-ui-md leading-ui-md text-white truncate"
        data-testid="agent-builder-breadcrumb-mobile"
      >
        {isLoading ? (
          <Skeleton
            className="inline-block h-4 w-24 align-middle"
            data-testid="agent-builder-breadcrumb-mobile-skeleton"
          />
        ) : (
          displayName
        )}
      </span>
      <div className="hidden lg:block" data-testid="agent-builder-breadcrumb-desktop">
        <Breadcrumb label="Agent builder">
          <Crumb as={AgentsLink} to="/agent-builder/agents">
            Agents
          </Crumb>
          <Crumb as="span" isCurrent={!mode}>
            {isLoading ? (
              <Skeleton
                className="inline-block h-4 w-24 align-middle"
                data-testid="agent-builder-breadcrumb-skeleton"
              />
            ) : (
              displayName
            )}
          </Crumb>
          {modeMeta && (
            <Crumb as="span" isCurrent data-testid="agent-builder-mode-crumb">
              <Icon size="sm">
                <modeMeta.Icon aria-hidden="true" data-testid={modeMeta.iconTestId} />
              </Icon>

              <span className="font-semibold" data-testid="agent-builder-mode-label">
                {modeMeta.label}
              </span>
            </Crumb>
          )}
        </Breadcrumb>
      </div>
    </div>
  );
};
