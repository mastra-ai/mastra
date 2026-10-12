import { Button } from '@mastra/playground-ui/components/Button';
import { CopyButton } from '@mastra/playground-ui/components/CopyButton';
import { WorkflowCombobox } from '@mastra/playground-ui/domains/workflows/components/workflow-combobox';
import { useLinkComponent } from '@mastra/playground-ui/lib/framework';
import { LayoutList } from 'lucide-react';
import { useParams } from 'react-router';
import { ContextualSidebarHeader } from '@/components/ui/contextual-sidebar-header';
import { ContextualSidebarLayout } from '@/components/ui/contextual-sidebar-layout';
import { SidebarSlot } from '@/components/ui/sidebar-slot';

export function WorkflowNavigation() {
  const { workflowId = '' } = useParams();
  const { Link } = useLinkComponent();

  return (
    <ContextualSidebarLayout
      label="Workflow navigation"
      header={
        <ContextualSidebarHeader>
          <WorkflowCombobox
            value={workflowId}
            variant="ghost"
            size="sm"
            className="w-full min-w-0"
            aria-label="Switch workflow"
          />
          <CopyButton
            content={workflowId}
            tooltip="Copy workflow ID"
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
          />
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
            aria-label="All workflows"
            tooltip="All workflows"
            render={<Link href="/workflows" />}
          >
            <LayoutList />
          </Button>
        </ContextualSidebarHeader>
      }
    >
      <SidebarSlot />
    </ContextualSidebarLayout>
  );
}
