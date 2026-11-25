import { BrowserSection } from './browser-section';
import { ChannelsSection } from './channels-section';
import { InfrastructureLoading } from './infrastructure-loading';
import { InfrastructureMessage } from './infrastructure-message';
import { RegistriesSection } from './registries-section';
import { WorkspaceSection } from './workspace-section';
import { useInfrastructureStatus } from '@/domains/agent-builder/hooks/use-infrastructure-status';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';

export const InfrastructureOverview = () => {
  const { hasPermission, isLoading: isLoadingPermissions } = usePermissions();
  const canViewInfrastructure = !isLoadingPermissions && hasPermission('infrastructure:read');
  const { data, isLoading, error } = useInfrastructureStatus({ enabled: canViewInfrastructure });

  if (isLoadingPermissions) return <InfrastructureLoading />;
  if (!canViewInfrastructure) {
    return <InfrastructureMessage message="You do not have permission to view Agent Builder infrastructure." />;
  }
  if (isLoading) return <InfrastructureLoading />;
  if (error || !data) return <InfrastructureMessage message="Infrastructure configuration unavailable." />;

  return (
    <>
      <ChannelsSection providers={data.channels.providers} />
      <BrowserSection browser={data.browser} />
      <RegistriesSection registries={data.registries} />
      <WorkspaceSection workspace={data.workspace} />
    </>
  );
};
