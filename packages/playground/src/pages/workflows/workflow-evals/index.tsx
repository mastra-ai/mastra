import { useParams } from 'react-router';
import ExperimentsPage from '@/pages/experiments';

function WorkflowEvals() {
  const { workflowId } = useParams();
  if (!workflowId) return null;
  return <ExperimentsPage key={workflowId} scopedTarget={{ targetType: 'workflow', targetId: workflowId }} />;
}

export default WorkflowEvals;
