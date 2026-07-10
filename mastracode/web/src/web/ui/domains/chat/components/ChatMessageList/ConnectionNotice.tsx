import { Button } from '@mastra/playground-ui/components/Button';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { FolderOpen, RefreshCw } from 'lucide-react';
import { useState } from 'react';

import { getErrorMessage } from '../../../../../../shared/api/errors';
import {
  MASTRACODE_DESKTOP_PROJECT_ACCESS_ERROR_CODE,
  MASTRACODE_DESKTOP_PROJECT_ACCESS_ERROR_MESSAGE,
} from '../../../../../../shared/desktop-host';
import { useActiveProjectContext } from '../../../workspaces/context/ActiveProjectProvider';
import { useAddProjectMutation } from '../../../workspaces/hooks/useProjects';
import { useChatConnection } from '../../context/useChatConnection';

export function ConnectionNotice() {
  const { activeProject, selectProject } = useActiveProjectContext();
  const { status, error, retry } = useChatConnection();
  const addProject = useAddProjectMutation();
  const [actionError, setActionError] = useState<string>();
  const [recovering, setRecovering] = useState(false);

  if (status !== 'reconnecting' && status !== 'error') return null;

  if (status === 'reconnecting') {
    return (
      <div role="status" aria-live="polite" className="w-full px-3 pt-2">
        <Notice variant="warning">Connection lost. Retrying automatically...</Notice>
      </div>
    );
  }

  const desktopApi = window.mastracodeDesktop;
  const projectAccessRequired =
    (error?.code === MASTRACODE_DESKTOP_PROJECT_ACCESS_ERROR_CODE ||
      error?.message === MASTRACODE_DESKTOP_PROJECT_ACCESS_ERROR_MESSAGE) &&
    Boolean(desktopApi && activeProject?.path);

  const recover = async () => {
    setActionError(undefined);
    setRecovering(true);
    try {
      if (projectAccessRequired && desktopApi && activeProject?.path) {
        const selection = await desktopApi.selectProjectDirectory({ defaultPath: activeProject.path });
        if (selection.canceled || !selection.path) return;
        const selectedProject = await addProject.mutateAsync({
          name: selection.name ?? activeProject.name,
          path: selection.path,
        });
        await selectProject(selectedProject);
        if (selectedProject.id === activeProject.id) await retry();
        return;
      }
      await retry();
    } catch (recoveryError) {
      setActionError(getErrorMessage(recoveryError, 'The connection retry failed'));
    } finally {
      setRecovering(false);
    }
  };

  const actionLabel = recovering ? 'Retrying...' : projectAccessRequired ? 'Allow folder access' : 'Retry';

  return (
    <div role="status" aria-live="polite" className="w-full px-3 pt-2">
      <Notice variant="destructive" title={projectAccessRequired ? 'Project access required' : 'Connection error'}>
        <Notice.Message>{error?.message ?? 'The MastraCode session could not connect'}</Notice.Message>
        {projectAccessRequired && (
          <Notice.Message className="mt-2">
            Confirm the saved project folder in Finder to restore this desktop session.
          </Notice.Message>
        )}
        {actionError && <Notice.Message className="mt-2">Retry failed: {actionError}</Notice.Message>}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-3 self-start"
          disabled={recovering}
          onClick={() => void recover()}
        >
          {projectAccessRequired ? <FolderOpen size={15} /> : <RefreshCw size={15} />}
          <span>{actionLabel}</span>
        </Button>
      </Notice>
    </div>
  );
}
