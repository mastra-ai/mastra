import { EmptyState, IconButton, Txt } from '@mastra/playground-ui';
import { GraduationCapIcon, XIcon } from 'lucide-react';

interface SkillsDetailProps {
  onClose: () => void;
}

export const SkillsDetail = ({ onClose }: SkillsDetailProps) => {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-border1">
        <div className="flex items-center gap-2 min-w-0">
          <GraduationCapIcon className="h-4 w-4 shrink-0 text-neutral3" />
          <Txt variant="ui-md" className="font-medium text-neutral6 truncate">
            Skills
          </Txt>
        </div>
        <IconButton tooltip="Close" className="rounded-full" onClick={onClose} data-testid="skills-detail-close">
          <XIcon />
        </IconButton>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
        <EmptyState
          iconSlot={<GraduationCapIcon className="size-6 text-neutral3" />}
          titleSlot="No skills in this project yet"
          descriptionSlot="You can still shape your agent with instructions and tools."
        />
      </div>
    </div>
  );
};
