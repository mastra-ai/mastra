import { useParams } from 'react-router';

import { EvaluatorOverview } from '@/domains/evaluators/evaluator-overview';
import { useEvaluator } from '@/hooks/use-evaluators';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MastraResizablePanel } from '@mastra/playground-ui';
import { EvaluatorSidebar } from '@/domains/evaluators/evaluator-sidebar';

function Evaluator() {
  const { evaluatorId } = useParams();
  const { evaluator, isLoading: isLoadingEvaluator } = useEvaluator(evaluatorId!);

  if (isLoadingEvaluator) {
    return <div>Loading...</div>;
  }

  if (!evaluator) {
    return <div>Evaluator not found</div>;
  }

  return (
    <main className="relative flex flex-1 w-full h-full">
      <ScrollArea className="min-w-[325px] grow h-full">
        <div className="min-w-[325px] grow">
          <EvaluatorOverview evaluator={evaluator} id={evaluatorId!} />
        </div>
      </ScrollArea>
      <MastraResizablePanel
        defaultWidth={20}
        minimumWidth={20}
        maximumWidth={60}
        className="flex flex-col min-w-[325px] right-0 top-0 h-full z-20 bg-[#121212] [&>div:first-child]:-left-[1px] [&>div:first-child]:-right-[1px] [&>div:first-child]:w-[1px] [&>div:first-child]:bg-[#424242] [&>div:first-child]:hover:w-[2px] [&>div:first-child]:active:w-[2px]"
      >
        <EvaluatorSidebar evaluator={evaluator} />
      </MastraResizablePanel>
    </main>
  );
}

export default Evaluator;
