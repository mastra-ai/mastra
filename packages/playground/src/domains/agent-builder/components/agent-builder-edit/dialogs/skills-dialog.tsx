import { SideDialog, Txt } from '@mastra/playground-ui';
import { GraduationCapIcon } from 'lucide-react';

interface SkillsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editable?: boolean;
}

export const SkillsDialog = ({ open, onOpenChange }: SkillsDialogProps) => {
  return (
    <SideDialog
      isOpen={open}
      onClose={() => onOpenChange(false)}
      dialogTitle="Skills"
      dialogDescription="Turn on the skills your agent should specialize in."
      level={2}
    >
      <SideDialog.Top>
        <GraduationCapIcon className="size-4" /> Skills
      </SideDialog.Top>
      <SideDialog.Content>
        <SideDialog.Header>
          <SideDialog.Heading>
            <GraduationCapIcon /> Skills
          </SideDialog.Heading>
        </SideDialog.Header>

        <Txt variant="ui-sm" className="text-neutral3">
          No skills available yet.
        </Txt>
      </SideDialog.Content>
    </SideDialog>
  );
};
