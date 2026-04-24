import { EmptyState, SideDialog } from '@mastra/playground-ui';
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
      <SideDialog.Content>
        <SideDialog.Header>
          <SideDialog.Heading>
            <GraduationCapIcon /> Skills
          </SideDialog.Heading>
        </SideDialog.Header>

        <EmptyState
          iconSlot={<GraduationCapIcon className="size-6 text-neutral3" />}
          titleSlot="No skills in this project yet"
          descriptionSlot="You can still shape your agent with instructions and tools."
        />
      </SideDialog.Content>
    </SideDialog>
  );
};
