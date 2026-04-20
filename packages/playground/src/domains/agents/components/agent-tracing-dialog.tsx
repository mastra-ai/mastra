import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  IconButton,
} from '@mastra/playground-ui';
import { Waypoints } from 'lucide-react';
import { TracingRunOptions } from '@/domains/observability/components/tracing-run-options';

export const AgentTracingDialog = () => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <IconButton variant="light" size="md" type="button" tooltip="Tracing options" className="rounded-full">
          <Waypoints className="h-6 w-6 text-neutral3 hover:text-neutral6" />
        </IconButton>
      </DialogTrigger>
      <DialogContent className="w-[48rem] max-w-[calc(100vw-2rem)]">
        <DialogHeader>
          <DialogTitle>Tracing options</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <TracingRunOptions hideTitle />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};
