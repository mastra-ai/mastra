import { useParams } from 'react-router';

import { EvaluatorHeader } from './evaluator-header';

export const EvaluatorLayout = ({ children }: { children: React.ReactNode }) => {
  const { evaluatorId } = useParams();
  if (!evaluatorId) {
    return null;
  }
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <EvaluatorHeader evaluatorId={evaluatorId} />
      {children}
    </div>
  );
};
