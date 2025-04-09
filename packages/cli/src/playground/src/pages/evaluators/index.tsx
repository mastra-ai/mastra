import { Header } from '@/components/ui/header';
import { ScrollArea } from '@/components/ui/scroll-area';

import { EvaluatorsTable } from '@mastra/playground-ui';
import { useEvaluators } from '@/hooks/use-evaluators';
import { Metric, Evaluator } from '@mastra/core';
import { useNavigate } from 'react-router';

function isEvaluator(evaluator: Metric | Evaluator): evaluator is Evaluator {
  return 'name' in evaluator;
}

function Evaluators() {
  const { evaluators, isLoading } = useEvaluators();
  const navigate = useNavigate();

  const evaluatorList = Object.entries(evaluators)
    .filter(([_, evaluator]) => isEvaluator(evaluator))
    .map(([key, evaluator]) => ({
      id: key,
      name: key,
      type: (evaluator as Evaluator).name,
    }));
  ``;
  return (
    <div className="relative flex flex-col h-full overflow-hidden">
      <section className="relative flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <EvaluatorsTable
            title={<Header title="Evaluators" className="border-0" />}
            isLoading={isLoading}
            evaluatorsList={evaluatorList}
            columns={[
              {
                id: 'name',
                header: 'Name',
                cell: ({ row }) => (
                  <button
                    className="flex justify-start w-full h-full py-4"
                    onClick={() => {
                      console.log('clicked', row.original.id);
                      navigate(`/evaluators/${row.original.id}/overview`);
                    }}
                  >
                    <span
                      onClick={() => {
                        navigate(`/evaluators/${row.original.id}/overview`);
                      }}
                      className="text-sm truncate text-mastra-el-5"
                    >
                      {row.original.name}
                    </span>
                  </button>
                ),
              },
              {
                id: 'type',
                header: 'Type',
                cell: ({ row }) => (
                  <button
                    className="flex justify-start w-full h-full py-4"
                    onClick={() => {
                      console.log('clicked', row.original.id);
                      navigate(`/evaluators/${row.original.id}/overview`);
                    }}
                  >
                    <span
                      onClick={() => {
                        navigate(`/evaluators/${row.original.id}/overview`);
                      }}
                      className="text-sm truncate text-mastra-el-5"
                    >
                      {row.original.type}
                    </span>
                  </button>
                ),
              },
            ]}
          />
        </ScrollArea>
      </section>
    </div>
  );
}

export default Evaluators;
