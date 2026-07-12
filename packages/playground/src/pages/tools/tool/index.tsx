import { useParams } from 'react-router';
import { ToolPanel } from '@/domains/tools/components/ToolPanel';

const Tool = () => {
  const { toolId } = useParams();

  return (
    <div className="size-full overflow-y-hidden">
      <ToolPanel toolId={toolId!} />
    </div>
  );
};

export default Tool;
