import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  IconButton,
} from '@mastra/playground-ui';
import { SlidersHorizontal } from 'lucide-react';
import { AgentSettings } from './agent-settings';

export interface AgentSettingsDialogProps {
  agentId: string;
}

export const AgentSettingsDialog = ({ agentId }: AgentSettingsDialogProps) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <IconButton variant="light" size="md" type="button" tooltip="Model settings" className="rounded-full">
          <SlidersHorizontal className="h-6 w-6 text-neutral3 hover:text-neutral6" />
        </IconButton>
      </DialogTrigger>
      <DialogContent className="w-[48rem] max-w-[calc(100vw-2rem)]">
        <DialogHeader>
          <DialogTitle>Model settings</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <AgentSettings agentId={agentId} />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};
