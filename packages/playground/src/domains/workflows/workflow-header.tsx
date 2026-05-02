import {
  Crumb,
  Header,
  HeaderGroup,
  Button,
  Breadcrumb,
  HeaderAction,
  Icon,
  ApiIcon,
  WorkflowIcon,
  DocsIcon,
  Truncate,
} from '@mastra/playground-ui';
import { CalendarClockIcon, EyeIcon } from 'lucide-react';
import { Link } from 'react-router';
import { WorkflowCombobox } from './components/workflow-combobox';
import { useSchedules } from '@/domains/schedules/hooks/use-schedules';

export function WorkflowHeader({
  workflowName,
  workflowId,
  runId,
}: {
  workflowName: string;
  workflowId: string;
  runId?: string;
}) {
  const { data: schedules } = useSchedules({ workflowId });
  const scheduleCount = schedules?.length ?? 0;
  const schedulesHref =
    scheduleCount === 1
      ? `/workflows/schedules/${encodeURIComponent(schedules![0].id)}`
      : `/workflows/schedules?workflowId=${encodeURIComponent(workflowId)}`;
  const isLeafCombobox = !runId;

  return (
    <div className="shrink-0">
      <Header>
        <Breadcrumb>
          <Crumb as={Link} to={`/workflows`}>
            <Icon>
              <WorkflowIcon />
            </Icon>
            Workflows
          </Crumb>
          <Crumb as="span" to="" isCurrent={isLeafCombobox}>
            <WorkflowCombobox value={workflowId} variant="ghost" />
          </Crumb>
          {runId && (
            <Crumb as={Link} to={`/workflows/${workflowId}/graph/${runId}`} isCurrent>
              <Truncate untilChar="-" copy>
                {runId}
              </Truncate>
            </Crumb>
          )}
        </Breadcrumb>

        <HeaderGroup>
          {scheduleCount > 0 && (
            <Button as={Link} to={schedulesHref}>
              <Icon>
                <CalendarClockIcon />
              </Icon>
              Schedules ({scheduleCount})
            </Button>
          )}
          <Button as={Link} to={`/observability?entity=${workflowName}`}>
            <Icon>
              <EyeIcon />
            </Icon>
            Traces
          </Button>
        </HeaderGroup>

        <HeaderAction>
          <Button as="a" target="_blank" href="/swagger-ui" variant="ghost" size="md">
            <ApiIcon />
            API endpoints
          </Button>

          <Button as={Link} to="https://mastra.ai/en/docs/workflows/overview" target="_blank" variant="ghost" size="md">
            <DocsIcon />
            Workflows documentation
          </Button>
        </HeaderAction>
      </Header>
    </div>
  );
}
