import {
  Button,
  ButtonsGroup,
  CreateDatasetDialog,
  EntityListPageLayout,
  EvaluationDashboard,
  EVALUATION_DATASET_EXPERIMENT_OPTIONS,
  EVALUATION_DATASET_TARGET_OPTIONS,
  EVALUATION_EXPERIMENT_STATUS_OPTIONS,
  EVALUATION_SCORER_SOURCE_OPTIONS,
  getEvaluationDatasetTagOptions,
  getEvaluationExperimentDatasetOptions,
  ListSearch,
  MainHeader,
  SelectFieldBlock,
  useEvaluationDatasets,
} from '@mastra/playground-ui';
import type { EvaluationTab } from '@mastra/playground-ui';
import { BeakerIcon, DatabaseIcon, FlaskConicalIcon, Plus, TestTubeDiagonalIcon, XIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

const TAB_PARAM = 'tab';
const VALID_TABS: EvaluationTab[] = ['overview', 'scorers', 'datasets', 'experiments'];

export default function Evaluation() {
  const [searchParams] = useSearchParams();
  const urlTab = searchParams.get(TAB_PARAM) as EvaluationTab | null;
  const activeTab: EvaluationTab = urlTab && VALID_TABS.includes(urlTab) ? urlTab : 'overview';

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [scorersSearch, setScorersSearch] = useState('');
  const [scorersSourceFilter, setScorersSourceFilter] = useState('all');
  const [datasetsSearch, setDatasetsSearch] = useState('');
  const [datasetsTargetFilter, setDatasetsTargetFilter] = useState('all');
  const [datasetsExperimentFilter, setDatasetsExperimentFilter] = useState('all');
  const [datasetsTagFilter, setDatasetsTagFilter] = useState('all');
  const [experimentsSearch, setExperimentsSearch] = useState('');
  const [experimentsStatusFilter, setExperimentsStatusFilter] = useState('all');
  const [experimentsDatasetFilter, setExperimentsDatasetFilter] = useState('all');

  const { data: datasetsData } = useEvaluationDatasets();
  const datasets = useMemo(() => datasetsData?.datasets ?? [], [datasetsData?.datasets]);

  const datasetTagOptions = useMemo(() => getEvaluationDatasetTagOptions(datasets), [datasets]);
  const experimentDatasetOptions = useMemo(() => getEvaluationExperimentDatasetOptions(datasets), [datasets]);

  const resetScorerFilters = () => {
    setScorersSearch('');
    setScorersSourceFilter('all');
  };

  const resetDatasetFilters = () => {
    setDatasetsSearch('');
    setDatasetsTargetFilter('all');
    setDatasetsExperimentFilter('all');
    setDatasetsTagFilter('all');
  };

  const resetExperimentFilters = () => {
    setExperimentsSearch('');
    setExperimentsStatusFilter('all');
    setExperimentsDatasetFilter('all');
  };

  const hasScorerFilters = scorersSourceFilter !== 'all' || scorersSearch !== '';
  const hasDatasetFilters =
    datasetsTargetFilter !== 'all' ||
    datasetsExperimentFilter !== 'all' ||
    datasetsTagFilter !== 'all' ||
    datasetsSearch !== '';
  const hasExperimentFilters =
    experimentsStatusFilter !== 'all' || experimentsDatasetFilter !== 'all' || experimentsSearch !== '';

  const tabConfig: Record<EvaluationTab, { icon: React.ReactNode; label: string }> = {
    overview: { icon: <FlaskConicalIcon />, label: 'Evaluation' },
    scorers: { icon: <BeakerIcon />, label: 'Scorers' },
    datasets: { icon: <DatabaseIcon />, label: 'Datasets' },
    experiments: { icon: <TestTubeDiagonalIcon />, label: 'Experiments' },
  };

  const { icon: headerIcon, label: headerLabel } = tabConfig[activeTab];

  return (
    <EntityListPageLayout>
      <EntityListPageLayout.Top>
        <MainHeader withMargins={false}>
          <MainHeader.Column>
            <MainHeader.Title>
              {headerIcon} {headerLabel}
            </MainHeader.Title>
          </MainHeader.Column>
        </MainHeader>

        {activeTab === 'scorers' && (
          <div className="flex flex-wrap items-center gap-2">
            <ListSearch label="Search scorers" placeholder="Filter by scorer name" onSearch={setScorersSearch} />
            <ButtonsGroup>
              <SelectFieldBlock
                label="Source"
                labelIsHidden
                name="filter-source"
                options={[...EVALUATION_SCORER_SOURCE_OPTIONS]}
                value={scorersSourceFilter}
                onValueChange={setScorersSourceFilter}
                className="whitespace-nowrap"
              />
              {hasScorerFilters && (
                <Button onClick={resetScorerFilters} size="sm" variant="light">
                  <XIcon className="size-3" /> Reset
                </Button>
              )}
            </ButtonsGroup>
          </div>
        )}

        {activeTab === 'datasets' && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <ListSearch label="Search datasets" placeholder="Filter by dataset name" onSearch={setDatasetsSearch} />
              <ButtonsGroup>
                <SelectFieldBlock
                  label="Target"
                  labelIsHidden
                  name="filter-target"
                  options={[...EVALUATION_DATASET_TARGET_OPTIONS]}
                  value={datasetsTargetFilter}
                  onValueChange={setDatasetsTargetFilter}
                  className="whitespace-nowrap"
                />
                <SelectFieldBlock
                  label="Experiments"
                  labelIsHidden
                  name="filter-experiments"
                  options={[...EVALUATION_DATASET_EXPERIMENT_OPTIONS]}
                  value={datasetsExperimentFilter}
                  onValueChange={setDatasetsExperimentFilter}
                  className="whitespace-nowrap"
                />
                {datasetTagOptions.length > 1 && (
                  <SelectFieldBlock
                    label="Tags"
                    labelIsHidden
                    name="filter-tags"
                    options={datasetTagOptions}
                    value={datasetsTagFilter}
                    onValueChange={setDatasetsTagFilter}
                    className="whitespace-nowrap"
                  />
                )}
                {hasDatasetFilters && (
                  <Button onClick={resetDatasetFilters} size="sm" variant="light">
                    <XIcon className="size-3" /> Reset
                  </Button>
                )}
              </ButtonsGroup>
            </div>
            <Button variant="primary" size="sm" onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="size-4" /> Create Dataset
            </Button>
          </div>
        )}

        {activeTab === 'experiments' && (
          <div className="flex flex-wrap items-center gap-2">
            <ListSearch
              label="Search experiments"
              placeholder="Filter by experiment, dataset, or target"
              onSearch={setExperimentsSearch}
            />
            <ButtonsGroup>
              <SelectFieldBlock
                label="Status"
                labelIsHidden
                name="filter-status"
                options={[...EVALUATION_EXPERIMENT_STATUS_OPTIONS]}
                value={experimentsStatusFilter}
                onValueChange={setExperimentsStatusFilter}
                className="whitespace-nowrap"
              />
              <SelectFieldBlock
                label="Dataset"
                labelIsHidden
                name="filter-dataset"
                options={experimentDatasetOptions}
                value={experimentsDatasetFilter}
                onValueChange={setExperimentsDatasetFilter}
                className="whitespace-nowrap"
              />
              {hasExperimentFilters && (
                <Button onClick={resetExperimentFilters} size="sm" variant="light">
                  <XIcon className="size-3" /> Reset
                </Button>
              )}
            </ButtonsGroup>
          </div>
        )}
      </EntityListPageLayout.Top>

      <div className="overflow-y-auto px-4 pt-2">
        <EvaluationDashboard
          activeTab={activeTab}
          scorerSearch={scorersSearch}
          scorerSourceFilter={scorersSourceFilter}
          datasetSearch={datasetsSearch}
          datasetTargetFilter={datasetsTargetFilter}
          datasetExperimentFilter={datasetsExperimentFilter}
          datasetTagFilter={datasetsTagFilter}
          experimentSearch={experimentsSearch}
          experimentStatusFilter={experimentsStatusFilter}
          experimentDatasetFilter={experimentsDatasetFilter}
        />
      </div>

      <CreateDatasetDialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen} />
    </EntityListPageLayout>
  );
}
