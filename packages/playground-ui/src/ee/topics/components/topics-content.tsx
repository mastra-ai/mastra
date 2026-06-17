import { ChevronRight, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/ds/components/Badge';
import { Button } from '@/ds/components/Button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/ds/components/Collapsible';
import { ScrollArea } from '@/ds/components/ScrollArea';
import { cn } from '@/lib/utils';
import { aggregateTopics } from '../utils';
import type { Topic, TopicSubtopicWithCounts, TopicTraceSummary, TopicWithCounts } from '../types';
import { TopicTraceSummaryList } from './topic-trace-summary-list';

function TraceCountText({ count }: { count: number }) {
  return <span className="shrink-0 font-mono text-ui-xs text-neutral2">{count} traces</span>;
}

export interface TopicsSidebarProps {
  topics: TopicWithCounts[];
  selectedSubtopicId?: string | null;
  onSubtopicSelect: (subtopic: TopicSubtopicWithCounts) => void;
}

export function TopicsSidebar({ topics, selectedSubtopicId, onSubtopicSelect }: TopicsSidebarProps) {
  return (
    <>
      <div className="border-b border-border1 p-4">
        <h1 className="text-icon-lg font-semibold text-neutral5">Topics</h1>
        <p className="mt-1 text-ui-sm text-neutral3">
          Group related traces into topics, inspect each subtopic's share of activity, and drill into the traces behind it.
        </p>
      </div>
      <ScrollArea className="h-full">
        <div className="space-y-2 p-3">
          {topics.length === 0 ? (
            <p className="p-4 text-ui-sm text-neutral3">No topics found.</p>
          ) : (
            topics.map(topic => (
              <Collapsible key={topic.id} defaultOpen>
                <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md p-2 text-left text-ui-md text-neutral4 hover:bg-surface3">
                  <ChevronRight className="h-4 w-4 shrink-0" />
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: topic.color }} />
                  <span className="min-w-0 flex-1 truncate font-medium">{topic.name}</span>
                  <TraceCountText count={topic.traceCount} />
                </CollapsibleTrigger>
                <CollapsibleContent className="ml-6 space-y-1 pb-2">
                  {topic.subtopics.map(subtopic => (
                    <button
                      key={subtopic.id}
                      type="button"
                      onClick={() => onSubtopicSelect(subtopic)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-ui-sm transition-colors hover:bg-surface3',
                        selectedSubtopicId === subtopic.id ? 'bg-surface4 text-neutral5' : 'text-neutral3',
                      )}
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: subtopic.color }} />
                      <span className="min-w-0 flex-1 truncate">{subtopic.name}</span>
                      <TraceCountText count={subtopic.traceCount} />
                    </button>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            ))
          )}
        </div>
      </ScrollArea>
    </>
  );
}

export interface TopicSubtopicPanelProps {
  subtopic: TopicSubtopicWithCounts;
  selectedTraceId?: string | null;
  onSubtopicClose: () => void;
  onTraceSelect: (trace: TopicTraceSummary) => void;
}

export function TopicSubtopicPanel({ subtopic, selectedTraceId, onSubtopicClose, onTraceSelect }: TopicSubtopicPanelProps) {
  return (
    <section className="flex h-full min-w-0 flex-col gap-4">
      <header className="rounded-xl border border-border1 bg-surface2 p-4">
        <div className="flex items-start gap-3">
          <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: subtopic.color }} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-icon-lg font-semibold text-neutral5">{subtopic.name}</h2>
              <Badge variant="default">{subtopic.traceCount} traces</Badge>
              <Badge variant="default">{subtopic.traceShare.percentage}% of topic traces</Badge>
            </div>
            {subtopic.description ? <p className="mt-2 text-ui-sm text-neutral3">{subtopic.description}</p> : null}
          </div>
          <Button variant="ghost" size="icon-xs" tooltip="Close subtopic" onClick={onSubtopicClose}>
            <X />
          </Button>
        </div>
      </header>
      <TopicTraceSummaryList traces={subtopic.traceSummaries} selectedTraceId={selectedTraceId} onTraceSelect={onTraceSelect} />
    </section>
  );
}

export interface TopicsContentProps {
  topics: Topic[];
  selectedSubtopicId?: string | null;
  selectedTraceId?: string | null;
  onSubtopicSelect?: (subtopic: TopicSubtopicWithCounts) => void;
  onSubtopicClose?: () => void;
  onTraceSelect?: (trace: TopicTraceSummary) => void;
}

export function TopicsContent({
  topics,
  selectedSubtopicId,
  selectedTraceId,
  onSubtopicSelect,
  onSubtopicClose,
  onTraceSelect,
}: TopicsContentProps) {
  const aggregatedTopics = useMemo(() => aggregateTopics(topics), [topics]);
  const [localSelectedSubtopicId, setLocalSelectedSubtopicId] = useState<string | null>(null);
  const [localSelectedTraceId, setLocalSelectedTraceId] = useState<string | null>(null);

  const activeSubtopicId = selectedSubtopicId ?? localSelectedSubtopicId;
  const activeTraceId = selectedTraceId ?? localSelectedTraceId;
  const activeSubtopic = aggregatedTopics.flatMap(topic => topic.subtopics).find(subtopic => subtopic.id === activeSubtopicId);

  const handleSubtopicSelect = (subtopic: TopicSubtopicWithCounts) => {
    setLocalSelectedSubtopicId(subtopic.id);
    setLocalSelectedTraceId(null);
    onSubtopicSelect?.(subtopic);
  };

  const handleSubtopicClose = () => {
    setLocalSelectedSubtopicId(null);
    setLocalSelectedTraceId(null);
    onSubtopicClose?.();
  };

  const handleTraceSelect = (trace: TopicTraceSummary) => {
    setLocalSelectedTraceId(trace.id);
    onTraceSelect?.(trace);
  };

  return (
    <>
      <TopicsSidebar topics={aggregatedTopics} selectedSubtopicId={activeSubtopicId} onSubtopicSelect={handleSubtopicSelect} />
      {activeSubtopic ? (
        <TopicSubtopicPanel
          subtopic={activeSubtopic}
          selectedTraceId={activeTraceId}
          onSubtopicClose={handleSubtopicClose}
          onTraceSelect={handleTraceSelect}
        />
      ) : null}
    </>
  );
}
