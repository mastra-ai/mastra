import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle, Tabs, Tab, TabContent, TabList } from '@mastra/playground-ui';
import { AgentSettings } from './agent-settings';
import { useAgent } from '../hooks/use-agent';
import { TracingRunOptions } from '@/domains/observability/components/tracing-run-options';
import { RequestContextSchemaForm } from '@/domains/request-context';

interface AgentChatSettingsDialogProps {
  agentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AgentChatSettingsDialog = ({ agentId, open, onOpenChange }: AgentChatSettingsDialogProps) => {
  const { data: agent } = useAgent(agentId);
  const requestContextSchema = agent?.requestContextSchema;
  const hasRequestContext = Boolean(requestContextSchema);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[720px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Chat Settings</DialogTitle>
        </DialogHeader>
        <DialogBody className="p-0">
          <Tabs defaultTab="model-settings">
            <TabList>
              <Tab value="model-settings">Model Settings</Tab>
              <Tab value="tracing-options">Tracing Options</Tab>
              {hasRequestContext && <Tab value="request-context">Request Context</Tab>}
            </TabList>
            <TabContent value="model-settings">
              <AgentSettings agentId={agentId} />
            </TabContent>
            <TabContent value="tracing-options">
              <TracingRunOptions />
            </TabContent>
            {requestContextSchema && (
              <TabContent value="request-context">
                <div className="p-5">
                  <RequestContextSchemaForm requestContextSchema={requestContextSchema} />
                </div>
              </TabContent>
            )}
          </Tabs>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};
