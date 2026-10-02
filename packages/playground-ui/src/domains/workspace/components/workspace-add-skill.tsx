import { Wand2 } from 'lucide-react';
import { useState } from 'react';
import { useWorkspaceContext } from './use-workspace-context';
import { WorkspaceAddSkillDialog } from './workspace-add-skill-dialog';
import type { AddSkillDialogProps } from './workspace-add-skill-dialog';
import { Button } from '@/ds/components/Button';

export type WorkspaceSkillInstallParams = Parameters<AddSkillDialogProps['onInstall']>[0];

export interface WorkspaceAddSkillOptions extends Omit<
  AddSkillDialogProps,
  'open' | 'onOpenChange' | 'workspaceId' | 'onInstall' | 'isInstalling'
> {
  /** Installs the picked skill. The dialog closes when it resolves and stays open when it rejects. */
  onInstall: (params: WorkspaceSkillInstallParams) => Promise<void>;
}

/** "Add skill" button that opens the skills.sh dialog. Renders nothing without `addSkill` options. */
export function WorkspaceAddSkill({ labeled = false }: { labeled?: boolean }) {
  const { workspaceId, addSkill } = useWorkspaceContext();
  const [open, setOpen] = useState(false);
  const [isInstalling, setInstalling] = useState(false);

  if (!addSkill) return null;
  const { onInstall, ...dialogProps } = addSkill;

  const handleInstall = async (params: WorkspaceSkillInstallParams) => {
    setInstalling(true);
    try {
      await onInstall(params);
      setOpen(false);
    } catch {
      // The caller reports the failure; keep the dialog open so the user can retry.
    } finally {
      setInstalling(false);
    }
  };

  return (
    <>
      {labeled ? (
        <Button variant="ghost" onClick={() => setOpen(true)}>
          <Wand2 />
          Add skill
        </Button>
      ) : (
        <Button variant="ghost" size="icon-sm" aria-label="Add skill" tooltip="Add skill" onClick={() => setOpen(true)}>
          <Wand2 />
        </Button>
      )}
      <WorkspaceAddSkillDialog
        {...dialogProps}
        open={open}
        onOpenChange={setOpen}
        workspaceId={workspaceId}
        onInstall={params => void handleInstall(params)}
        isInstalling={isInstalling}
      />
    </>
  );
}
