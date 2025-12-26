'use client';

import { useState, useEffect } from 'react';
import {
  GraduationCapIcon,
  PlusIcon,
  ArrowLeftIcon,
  BookOpenIcon,
  AlertTriangleIcon,
  ChevronRightIcon,
} from 'lucide-react';

import { MainContentLayout, MainContentContent } from '@/components/ui/containers';
import { Header, HeaderTitle, HeaderAction } from '@/ds/components/Header';
import { Button } from '@/ds/components/Button';
import { Icon } from '@/ds/icons/Icon';
import { EmptyState } from '@/ds/components/EmptyState';
import { AgentCoinIcon } from '@/ds/icons/AgentCoinIcon';
import { useLinkComponent } from '@/lib/framework';

import type { TrainingJob, TrainingConfig } from '../types';
import { useTrainingJobs } from '../hooks/use-training-jobs';
import { useTrainingDataCheck } from '../hooks/use-training-data-check';
import { TrainingJobsList } from './training-jobs-list';
import { TrainingConfigForm } from './training-config-form';
import { TrainingJobDetail } from './training-job-detail';

interface TrainingPageProps {
  baseUrl?: string;
  agents: Array<{ id: string; name: string }>;
  scorers: Array<{ id: string; name: string }>;
  /** Job ID from URL for direct linking */
  jobId?: string;
}

type View = 'list' | 'create' | 'detail';

export function TrainingPage({ baseUrl, agents, scorers, jobId: initialJobId }: TrainingPageProps) {
  const [view, setView] = useState<View>(initialJobId ? 'detail' : 'list');
  const [selectedAgent, setSelectedAgent] = useState<string | null>(agents.length > 0 ? agents[0]!.id : null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(initialJobId || null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { startJob, jobs, isLoading } = useTrainingJobs({ baseUrl });
  const { Link, navigate, paths } = useLinkComponent();

  // Sync view with URL-provided jobId
  useEffect(() => {
    if (initialJobId) {
      setSelectedJobId(initialJobId);
      setView('detail');
    } else {
      setSelectedJobId(null);
      setView('list');
    }
  }, [initialJobId]);

  const selectedAgentData = agents.find(a => a.id === selectedAgent);
  const {
    hasData: hasTrainingData,
    traceCount,
    message: trainingDataMessage,
    isLoading: isCheckingData,
  } = useTrainingDataCheck({
    baseUrl,
    agentId: selectedAgent || undefined,
    agentName: selectedAgentData?.name,
  });

  const handleSelectJob = (job: TrainingJob) => {
    // Navigate to the job URL for proper deep linking
    navigate(paths.trainingJobLink(job.id));
  };

  const handleBackToList = () => {
    navigate(paths.trainingLink());
  };

  const handleStartTraining = async (config: TrainingConfig) => {
    if (!selectedAgent) return;

    setIsSubmitting(true);
    try {
      const job = await startJob(selectedAgent, config);
      // Navigate to the new job's detail page
      navigate(paths.trainingJobLink(job.id));
    } catch (error) {
      console.error('Failed to start training:', error);
      alert(`Failed to start training: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasNoJobs = !isLoading && jobs.length === 0;

  // Find the selected job to show its ID in breadcrumbs
  const selectedJob = jobs.find(j => j.id === selectedJobId);

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>
          <Icon>
            <GraduationCapIcon />
          </Icon>
          {view === 'list' ? (
            'Training'
          ) : (
            <span className="flex items-center gap-1">
              <button onClick={handleBackToList} className="hover:text-icon6 transition-colors">
                Training
              </button>
              <Icon className="text-icon3">
                <ChevronRightIcon className="w-4 h-4" />
              </Icon>
              <span className="text-icon6">
                {view === 'create' ? (
                  'New Job'
                ) : (
                  <span className="font-mono text-ui-sm">
                    {selectedJobId ? selectedJobId.slice(0, 16) + '...' : 'Job Details'}
                  </span>
                )}
              </span>
            </span>
          )}
        </HeaderTitle>

        <HeaderAction>
          {view !== 'list' && (
            <Button onClick={handleBackToList}>
              <Icon>
                <ArrowLeftIcon />
              </Icon>
              Back to Jobs
            </Button>
          )}
          {view === 'list' && (
            <>
              <Button as={Link} to="https://mastra.ai/en/docs" target="_blank">
                <Icon>
                  <BookOpenIcon />
                </Icon>
                Documentation
              </Button>
              <Button variant="light" onClick={() => setView('create')}>
                <Icon>
                  <PlusIcon />
                </Icon>
                New Training Job
              </Button>
            </>
          )}
        </HeaderAction>
      </Header>

      <MainContentContent isCentered={hasNoJobs && view === 'list'}>
        {view === 'list' &&
          (hasNoJobs ? (
            <EmptyTrainingState onCreateJob={() => setView('create')} />
          ) : (
            <TrainingJobsList baseUrl={baseUrl} onSelectJob={handleSelectJob} />
          ))}

        {view === 'create' && (
          <div className="p-5">
            <div className="bg-surface2 border-sm border-border1 rounded-md p-5">
              <h2 className="text-icon6 text-ui-lg font-medium mb-5">Start New Training Job</h2>

              {/* Agent Selection */}
              <div className="mb-5">
                <label className="block text-icon3 text-ui-sm uppercase mb-2">Select Agent</label>
                {agents.length === 0 ? (
                  <div className="p-4 rounded-md bg-surface3 text-icon3 text-ui-sm">
                    No agents configured. Create an agent first to start training.
                  </div>
                ) : (
                  <select
                    value={selectedAgent || ''}
                    onChange={e => setSelectedAgent(e.target.value)}
                    className="w-full px-3 py-2 border-sm border-border1 rounded-md bg-surface1 text-icon6 text-ui-md focus:outline-none focus:border-accent1"
                  >
                    {agents.map(agent => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Training Data Warning */}
              {selectedAgentData && !isCheckingData && !hasTrainingData && (
                <div className="mb-5 p-4 rounded-md bg-yellow-500/10 border-sm border-yellow-500/30 flex items-start gap-3">
                  <Icon className="text-yellow-500 mt-0.5 shrink-0">
                    <AlertTriangleIcon />
                  </Icon>
                  <div>
                    <div className="text-icon6 font-medium mb-1">No Training Data Available</div>
                    <div className="text-icon3 text-ui-sm">
                      {trainingDataMessage ||
                        'No traces found for this agent. Run some agent conversations first to generate training data.'}
                    </div>
                  </div>
                </div>
              )}

              {/* Training Data Info */}
              {selectedAgentData && !isCheckingData && hasTrainingData && (
                <div className="mb-5 p-3 rounded-md bg-surface3 text-icon3 text-ui-sm">
                  Found <span className="text-icon6 font-medium">{traceCount}</span> trace{traceCount !== 1 ? 's' : ''}{' '}
                  available for training.
                </div>
              )}

              {selectedAgentData && (
                <TrainingConfigForm
                  agentId={selectedAgentData.id}
                  agentName={selectedAgentData.name}
                  scorers={scorers}
                  onSubmit={handleStartTraining}
                  isSubmitting={isSubmitting}
                  disabled={!hasTrainingData || isCheckingData}
                />
              )}
            </div>
          </div>
        )}

        {view === 'detail' && selectedJobId && (
          <div className="p-5">
            <TrainingJobDetail baseUrl={baseUrl} jobId={selectedJobId} onClose={() => setView('list')} />
          </div>
        )}
      </MainContentContent>
    </MainContentLayout>
  );
}

function EmptyTrainingState({ onCreateJob }: { onCreateJob: () => void }) {
  return (
    <EmptyState
      iconSlot={<AgentCoinIcon />}
      titleSlot="Train Your Agents"
      descriptionSlot="Fine-tune your agents using SFT or DPO methods. Start by creating a new training job."
      actionSlot={
        <Button size="lg" variant="light" onClick={onCreateJob}>
          <Icon>
            <PlusIcon />
          </Icon>
          New Training Job
        </Button>
      }
    />
  );
}
