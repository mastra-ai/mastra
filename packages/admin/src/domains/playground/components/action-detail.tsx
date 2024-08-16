import { useActionPlaygroundContext } from '../providers/action-playground-provider';

function ActionDetail() {
  const { selectedAction } = useActionPlaygroundContext();
  return <div>{selectedAction?.label || 'no action selected'}</div>;
}

export default ActionDetail;
