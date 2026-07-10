import { useTheme } from '@mastra/playground-ui/components/ThemeProvider';

import { useApiConfig } from '../../../../../shared/api/config';
import { getErrorMessage } from '../../../../../shared/api/errors';
import { useOverlays } from '../../../lib/overlays';
import { useToast } from '../../../ui';
import { SettingsPanel, useDensityPreference } from '../../settings';
import { ProjectsModal, useActiveProjectContext } from '../../workspaces';
import { useChatCommands } from '../context/ChatCommandsProvider';
import { useChatSession } from '../context/ChatSessionProvider';
import { useAgentControllerModels } from '../hooks/useAgentControllerModels';
import { useSetPermissionForCategoryMutation } from '../hooks/useAgentControllerPermissionMutations';
import { useAgentControllerPermissions } from '../hooks/useAgentControllerPermissions';
import { useAgentControllerSettings } from '../hooks/useAgentControllerSettings';
import {
  useSetAgentControllerStateMutation,
  useSwitchAgentControllerModelMutation,
} from '../hooks/useAgentControllerStateMutations';
import { AGENT_CONTROLLER_ID } from '../services/constants';
import { CommandPalette } from './CommandPalette';
import { ShortcutsOverlay } from './ShortcutsOverlay';

export function ChatOverlays() {
  const { baseUrl } = useApiConfig();
  const overlays = useOverlays();
  const { projects, activeProject, resourceId, sessionEnabled, selectProject } = useActiveProjectContext();
  const { transcript } = useChatSession();
  const { runPaletteCommand } = useChatCommands();
  const { theme, setTheme } = useTheme();
  const { density, changeDensity } = useDensityPreference();
  const { toast } = useToast();
  const hookArgs = { agentControllerId: AGENT_CONTROLLER_ID, resourceId, baseUrl, enabled: sessionEnabled };
  const modelsQuery = useAgentControllerModels(hookArgs);
  const settingsQuery = useAgentControllerSettings(hookArgs);
  const permissionsQuery = useAgentControllerPermissions(hookArgs);
  const switchModelMutation = useSwitchAgentControllerModelMutation(hookArgs);
  const setStateMutation = useSetAgentControllerStateMutation(hookArgs);
  const setPermissionForCategoryMutation = useSetPermissionForCategoryMutation(hookArgs);

  const projectsOpen = overlays.isOpen('projects') || projects.length === 0;
  const providerSettingsOpen = overlays.isOpen('provider-settings');
  const modelSettingsOpen = overlays.isOpen('model-settings');
  const settingsOpen = overlays.isOpen('settings') || modelSettingsOpen || providerSettingsOpen;
  const modelError = modelsQuery.error ?? switchModelMutation.error;

  return (
    <>
      {overlays.isOpen('palette') && activeProject && (
        <CommandPalette onRun={runPaletteCommand} onClose={() => overlays.close('palette')} />
      )}

      {settingsOpen && (
        <SettingsPanel
          theme={theme}
          density={density}
          models={modelsQuery.data ?? []}
          currentModelId={transcript.modelId ?? null}
          modelError={modelError ? getErrorMessage(modelError, 'The model catalog could not be loaded') : null}
          settings={settingsQuery.data ?? null}
          resourceId={sessionEnabled ? resourceId : undefined}
          onThemeChange={setTheme}
          onDensityChange={changeDensity}
          onModelChange={modelId => {
            void switchModelMutation
              .mutateAsync(modelId)
              .then(() => toast('Model updated', 'success'))
              .catch(error => toast(getErrorMessage(error, 'The model could not be updated'), 'error'));
          }}
          onBehaviorChange={updates => {
            void setStateMutation.mutateAsync(updates).then(() => toast('Settings updated', 'success'));
          }}
          permissions={permissionsQuery.data ?? null}
          pendingPermissionCategory={setPermissionForCategoryMutation.variables?.category ?? null}
          setPermissionForCategory={(category, policy) =>
            setPermissionForCategoryMutation.mutateAsync({ category, policy })
          }
          initialTab={providerSettingsOpen ? 'providers' : modelSettingsOpen ? 'model' : 'general'}
          onClose={() => {
            overlays.close('settings');
            overlays.close('model-settings');
            overlays.close('provider-settings');
          }}
        />
      )}

      {overlays.isOpen('shortcuts') && <ShortcutsOverlay onClose={() => overlays.close('shortcuts')} />}

      {projectsOpen && (
        <ProjectsModal
          projects={projects}
          activeProjectId={activeProject?.id ?? null}
          onSelectProject={project => void selectProject(project)}
          onClose={() => overlays.close('projects')}
        />
      )}
    </>
  );
}
