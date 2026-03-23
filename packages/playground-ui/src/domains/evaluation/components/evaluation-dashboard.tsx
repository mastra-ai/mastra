import { MetricsFlexGrid } from '@/ds/components/MetricsFlexGrid';
import { Tabs, TabList, Tab, TabContent } from '@/ds/components/Tabs';
import { EvaluationKpiCards } from './evaluation-kpi-cards';
import { ScoresOverTimeCard } from './scores-over-time-card';
import { ExperimentStatusCard } from './experiment-status-card';
import { DatasetHealthCard } from './dataset-health-card';
import { RecentExperimentsTable } from './recent-experiments-table';
import { ScorersTable } from '@/domains/scores/components/scorers-table/scorers-table';
import { EvaluationDatasetsTable } from './evaluation-datasets-table';
import { CreateDatasetDialog } from '@/domains/datasets/components/create-dataset-dialog';
import {
  useEvaluationScorers,
  useEvaluationDatasets,
  useEvaluationExperiments,
} from '../hooks/use-evaluation-dashboard';
import { useEvaluationScoreMetrics } from '../hooks/use-evaluation-score-metrics';
import { useState } from 'react';
import { useLinkComponent } from '@/lib/framework';

export type EvaluationTab = 'overview' | 'scorers' | 'datasets' | 'experiments';

interface EvaluationDashboardProps {
  defaultTab?: EvaluationTab;
  onTabChange?: (tab: EvaluationTab) => void;
  onDatasetCreated?: (datasetId: string) => void;
}

export function EvaluationDashboard({ defaultTab = 'overview', onTabChange, onDatasetCreated }: EvaluationDashboardProps) {
  const { data: scorers, isLoading: isLoadingScorers, error: errorScorers } = useEvaluationScorers();
  const { data: datasetsData, isLoading: isLoadingDatasets, error: errorDatasets } = useEvaluationDatasets();
  const { data: experimentsData, isLoading: isLoadingExperiments, error: errorExperiments } = useEvaluationExperiments();
  const { data: scoreMetrics, isLoading: isLoadingScores, isError: isErrorScores } = useEvaluationScoreMetrics();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { navigate, paths } = useLinkComponent();

  const datasets = datasetsData?.datasets;
  const experiments = experimentsData?.experiments;

  const handleDatasetCreated = (datasetId: string) => {
    setIsCreateDialogOpen(false);
    if (onDatasetCreated) {
      onDatasetCreated(datasetId);
    } else {
      navigate(paths.datasetLink(datasetId));
    }
  };

  return (
    <div className="flex flex-col gap-8 p-6">
      <Tabs defaultTab={defaultTab} onValueChange={tab => onTabChange?.(tab as EvaluationTab)}>
        <TabList>
          <Tab value="overview">Overview</Tab>
          <Tab value="scorers">Scorers</Tab>
          <Tab value="datasets">Datasets</Tab>
          <Tab value="experiments">Experiments</Tab>
        </TabList>

        <TabContent value="overview" className="pt-6">
          <div className="flex flex-col gap-6">
            <MetricsFlexGrid>
              <EvaluationKpiCards
                scorers={scorers}
                datasets={datasets}
                experiments={experiments}
                avgScore={scoreMetrics?.avgScore ?? null}
                prevAvgScore={scoreMetrics?.prevAvgScore ?? null}
                isLoadingScorers={isLoadingScorers}
                isLoadingDatasets={isLoadingDatasets}
                isLoadingExperiments={isLoadingExperiments}
                isLoadingScores={isLoadingScores}
              />
            </MetricsFlexGrid>
            <ScoresOverTimeCard
              summaryData={scoreMetrics?.summaryData ?? []}
              overTimeData={scoreMetrics?.overTimeData ?? []}
              scorerNames={scoreMetrics?.scorerNames ?? []}
              avgScore={scoreMetrics?.avgScore ?? null}
              isLoading={isLoadingScores}
              isError={isErrorScores}
            />
            <DatasetHealthCard
              experiments={experiments}
              isLoading={isLoadingExperiments}
              isError={!!errorExperiments}
            />
            <ExperimentStatusCard
              experiments={experiments}
              datasets={datasets}
              isLoading={isLoadingExperiments}
              isError={!!errorExperiments}
            />
          </div>
        </TabContent>

        <TabContent value="scorers" className="pt-6">
          <ScorersTable scorers={scorers ?? {}} isLoading={isLoadingScorers} error={errorScorers} />
        </TabContent>

        <TabContent value="datasets" className="pt-6">
          <EvaluationDatasetsTable
            datasets={datasets ?? []}
            experiments={experiments ?? []}
            isLoading={isLoadingDatasets || isLoadingExperiments}
            error={errorDatasets}
            onCreateClick={() => setIsCreateDialogOpen(true)}
          />
          <CreateDatasetDialog
            open={isCreateDialogOpen}
            onOpenChange={setIsCreateDialogOpen}
            onSuccess={handleDatasetCreated}
          />
        </TabContent>

        <TabContent value="experiments" className="pt-6">
          <RecentExperimentsTable
            experiments={experiments ?? []}
            datasets={datasets ?? []}
            isLoading={isLoadingExperiments}
          />
        </TabContent>
      </Tabs>
    </div>
  );
}
