import { Link } from 'react-router';

import { Header, Breadcrumb, Crumb, HeaderGroup, Button, DividerIcon, HeaderAction } from '@mastra/playground-ui';
import { DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Dialog } from '@/components/ui/dialog';
import { ApiEndpoints } from './api-endpoints';
import { useState } from 'react';

export function AgentHeader({ agentName, agentId }: { agentName: string; agentId: string }) {
  const [showDialog, setShowDialog] = useState(false);

  return (
    <>
      <Header>
        <Breadcrumb>
          <Crumb as={Link} to={`/agents`}>
            Agents
          </Crumb>
          <Crumb as={Link} to={`/agents/${agentId}`} isCurrent>
            {agentName}
          </Crumb>
        </Breadcrumb>

        <HeaderGroup>
          <Button as={Link} to={`/agents/${agentId}/chat`}>
            Chat
          </Button>

          <DividerIcon />

          <Button as={Link} to={`/agents/${agentId}/traces`}>
            Traces
          </Button>
          <Button as={Link} to={`/agents/${agentId}/evals`}>
            Evals
          </Button>
        </HeaderGroup>
        <HeaderAction>
          <Button onClick={() => setShowDialog(true)}>Agents API</Button>
        </HeaderAction>
      </Header>
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-4xl	w-full px-0 bg-surface2">
          <DialogHeader className="border-b border-border1 pb-4 px-5 flex flex-row gap-4 items-end">
            <div>
              <DialogTitle>Agents API</DialogTitle>
              <DialogDescription>View the agents API endpoints.</DialogDescription>
            </div>

            <Button as="a" href={`/swagger-ui`} target="_blank">
              Open Swagger
            </Button>
          </DialogHeader>

          <div className="px-5 -mt-4 -mb-6 h-full">
            <ApiEndpoints agentId={agentId} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
