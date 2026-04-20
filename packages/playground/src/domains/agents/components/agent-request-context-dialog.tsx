import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  IconButton,
} from '@mastra/playground-ui';
import { Braces } from 'lucide-react';
import { RequestContextSchemaForm } from '@/domains/request-context';
import { useAgent } from '../hooks/use-agent';

export interface AgentRequestContextDialogProps {
  agentId: string;
}

export const AgentRequestContextDialog = ({ agentId }: AgentRequestContextDialogProps) => {
  const { data: agent } = useAgent(agentId);

  if (!agent?.requestContextSchema) {
    return null;
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <IconButton variant="light" size="md" type="button" tooltip="Request context" className="rounded-full">
          <Braces className="h-6 w-6 text-neutral3 hover:text-neutral6" />
        </IconButton>
      </DialogTrigger>
      <DialogContent className="w-[48rem] max-w-[calc(100vw-2rem)]">
        <DialogHeader>
          <DialogTitle>Request context</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <RequestContextSchemaForm requestContextSchema={agent.requestContextSchema} />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};
