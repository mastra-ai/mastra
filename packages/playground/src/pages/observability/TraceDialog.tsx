import { cn } from '@/lib/utils';
import {
  SideDialog,
  SideDialogTop,
  SideDialogCodeSection,
  KeyValueList,
  UISpan,
  TextAndIcon,
  getShortId,
  SideDialogHeader,
  SideDialogHeading,
} from '@mastra/playground-ui';
import { format } from 'date-fns/format';
import {
  PanelLeftIcon,
  PanelTopIcon,
  SquareSplitVerticalIcon,
  ListTreeIcon,
  ChevronsLeftRightEllipsisIcon,
  CoinsIcon,
  ArrowRightIcon,
  ArrowRightToLineIcon,
  HashIcon,
  EyeIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { TraceTree } from './trace-tree';
import { trace } from 'console';

type TraceDialogProps = {
  traceSpans?: any[];
  traceId?: string;
  traceDetails?: any;
  isOpen: boolean;
  onClose?: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
};

export function TraceDialog({
  traceId,
  traceSpans = [],
  traceDetails,
  isOpen,
  onClose,
  onNext,
  onPrevious,
}: TraceDialogProps) {
  const [dialogIsOpen, setDialogIsOpen] = useState<boolean>(false);
  const [selectedSpanId, setSelectedSpanId] = useState<string | undefined>(undefined);
  const [combinedView, setCombinedView] = useState<boolean>(false);
  const [combinedViewProportion, setCombinedViewProportion] = useState<'1/1' | '1/2' | '1/3'>('1/1');

  const selectedSpan = traceSpans.find(span => span.spanId === selectedSpanId) ?? traceSpans[0];

  console.log({ selectedSpan, traceDetails });

  // Handler to toggle combined view proportion
  const toggleCombinedViewProportion = () => {
    setCombinedViewProportion(prev => {
      switch (prev) {
        case '1/3':
          return '1/2';
        case '1/2':
          return '1/1';
        case '1/1':
          return '1/3';
        default:
          return '1/3';
      }
    });
  };

  const handleSpanClick = (span: UISpan) => {
    setSelectedSpanId(span.id);
    setDialogIsOpen(true);
  };

  const toNextSpan = () => {
    const currentIndex = traceSpans.findIndex(span => span.spanId === selectedSpanId);
    const nextSpan = traceSpans[currentIndex + 1];

    if (nextSpan) {
      setSelectedSpanId(nextSpan.spanId);
    }
  };

  const toPreviousSpan = () => {
    const currentIndex = traceSpans.findIndex(span => span.spanId === selectedSpanId);
    const prevSpan = traceSpans[currentIndex - 1];

    if (prevSpan) {
      setSelectedSpanId(prevSpan.spanId);
    }
  };

  const traceInfo = [
    {
      key: 'entityId',
      label: 'Entity Id',
      value: [
        {
          id: traceDetails?.metadata?.resourceId,
          name: traceDetails?.attributes?.agentId || traceDetails?.attributes?.workflowId || 'N/A',
          path: traceDetails?.attributes?.agentId
            ? `/agents/${traceDetails?.metadata?.resourceId}`
            : traceDetails?.attributes?.workflowId
              ? `/workflows/${traceDetails?.metadata?.resourceId}`
              : undefined,
        },
      ],
    },
    {
      key: 'entityType',
      label: 'Entity Type',
      value: [
        {
          id: '',
          name: traceDetails?.attributes?.agentId ? 'Agent' : traceDetails?.attributes?.workflowId ? 'Workflow' : 'N/A',
          path: traceDetails?.attributes?.agentId
            ? `/agents`
            : traceDetails?.attributes?.workflowId
              ? `/workflows`
              : undefined,
        },
      ],
    },
    {
      key: 'status',
      label: 'Status',
      value: traceDetails?.attributes?.status || 'N/A',
    },
    {
      key: 'createdAt',
      label: 'Created at',
      value: traceDetails?.createdAt ? format(new Date(traceDetails?.createdAt), 'PPpp') : 'N/A',
    },
  ];

  const selectedSpanInfo = [
    {
      key: 'id',
      label: 'Trace Id',
      value: selectedSpan?.traceId,
    },
    {
      key: 'spanType',
      label: 'Span Type',
      value: selectedSpan?.spanType,
    },
    {
      key: 'createdAt',
      label: 'Created at',
      value: selectedSpan?.createdAt ? format(new Date(selectedSpan.createdAt), 'MMM dd, HH:mm:ss.SSS') : 'N/A',
    },
    {
      key: 'startedAt',
      label: 'Started At',
      value: selectedSpan?.startedAt ? format(new Date(selectedSpan.startedAt), 'MMM dd, HH:mm:ss.SSS') : 'N/A',
    },
    {
      key: 'endedAt',
      label: 'Ended At',
      value: selectedSpan?.endedAt ? format(new Date(selectedSpan.endedAt), 'MMM dd, HH:mm:ss.SSS') : 'N/A',
    },
  ];

  return (
    <>
      <SideDialog
        dialogTitle="Observability Trace"
        isOpen={isOpen}
        onClose={onClose}
        hasCloseButton={!dialogIsOpen}
        className={cn('w-[calc(100vw-20rem)] max-w-[75%]', '3xl:max-w-[60rem]', '4xl:max-w-[60%]')}
      >
        <SideDialogTop onNext={onNext} onPrevious={onPrevious} showInnerNav={true}>
          <TextAndIcon>
            <EyeIcon /> {getShortId(traceId)}
          </TextAndIcon>
        </SideDialogTop>

        <div
          className={cn('p-[1.5rem] pl-[2.5rem] pr-0 overflow-y-auto grid', {
            'grid-rows-[auto_1fr_1fr]': combinedView && combinedViewProportion === '1/1',
            'grid-rows-[auto_1fr_2fr]': combinedView && combinedViewProportion === '1/2',
            'grid-rows-[auto_1fr_3fr]': combinedView && combinedViewProportion === '1/3',
            'grid-rows-[auto_1fr]': !combinedView,
          })}
        >
          <SideDialogHeader className="flex  gap-[1rem] items-baseline pr-[2.5rem]">
            <SideDialogHeading>
              <EyeIcon /> {traceDetails?.name}
            </SideDialogHeading>

            <TextAndIcon>
              <HashIcon /> {traceId}
            </TextAndIcon>
          </SideDialogHeader>

          <div className="overflow-y-auto pr-[1rem]">
            {traceDetails?.metadata?.usage && (
              <Usage traceUsage={traceDetails?.metadata?.usage} traceSpans={traceSpans} className="mt-[3rem]" />
            )}
            <KeyValueList data={traceInfo} LinkComponent={Link} className="mt-[3rem]" />
            <TraceTree spans={traceSpans} onSpanClick={handleSpanClick} selectedSpanId={selectedSpanId} />
          </div>

          {combinedView && (
            <div className="overflow-y-auto border-t-2 border-gray-500 grid grid-rows-[auto_1fr]">
              <div className="flex items-center justify-between py-[.5rem] border-b border-border1 pr-[1rem]">
                <SideDialogTop onNext={toNextSpan} onPrevious={toPreviousSpan} showInnerNav={true}>
                  <div className="flex items-center gap-[0.5rem] text-icon4 text-[0.875rem]">{selectedSpanId}</div>
                </SideDialogTop>
                <div className="flex items-center gap-[1rem]">
                  <button onClick={toggleCombinedViewProportion}>
                    <SquareSplitVerticalIcon />
                  </button>
                  <button className="flex items-center gap-1" onClick={() => setCombinedView(false)}>
                    {combinedView ? <PanelLeftIcon /> : <PanelTopIcon />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-[20rem_1fr] p-[1.5rem] overflow-y-auto">
                <div className="overflow-y-auto">
                  <KeyValueList data={selectedSpanInfo} LinkComponent={Link} />
                </div>
                <div className="overflow-y-auto">
                  <SpanDetails span={selectedSpan} />
                </div>
              </div>
            </div>
          )}
        </div>
      </SideDialog>

      <SideDialog
        dialogTitle="Observability Span"
        isOpen={Boolean(dialogIsOpen && selectedSpanId && !combinedView)}
        onClose={() => setDialogIsOpen(false)}
        hasCloseButton={true}
        className={cn('w-[calc(100vw-20rem)] max-w-[60%]', '3xl:max-w-[50rem]', '4xl:max-w-[40%]')}
      >
        <div className="flex items-center justify-between pr-[1.5rem]">
          <SideDialogTop onNext={toNextSpan} onPrevious={toPreviousSpan} showInnerNav={true}>
            <div className="flex items-center gap-[1rem] text-icon4 text-[0.875rem]">
              <TextAndIcon>
                <EyeIcon /> {selectedSpan?.traceId?.slice(0, 6)}
              </TextAndIcon>
              ›
              <TextAndIcon>
                <ChevronsLeftRightEllipsisIcon />
                {selectedSpanId?.slice(0, 6)}
              </TextAndIcon>
            </div>
          </SideDialogTop>
          <button className="flex items-center gap-1" onClick={() => setCombinedView(true)}>
            {combinedView ? <PanelLeftIcon /> : <PanelTopIcon />}
          </button>
        </div>

        <div className="p-[1.5rem] px-[2.5rem] overflow-y-auto grid gap-[1.5rem]">
          <SideDialogHeader className="flex  gap-[1rem] items-baseline pr-[2.5rem]">
            <SideDialogHeading>
              <ChevronsLeftRightEllipsisIcon /> {selectedSpan?.name}
            </SideDialogHeading>
            <TextAndIcon>
              <HashIcon /> {selectedSpan?.spanId}
            </TextAndIcon>
          </SideDialogHeader>
          {selectedSpan?.attributes?.usage && (
            <Usage spanUsage={selectedSpan.attributes.usage} className="mt-[1.5rem]" />
          )}
          <KeyValueList data={selectedSpanInfo} LinkComponent={Link} className="mt-[1.5rem]" />
          <SpanDetails span={selectedSpan} />
        </div>
      </SideDialog>
    </>
  );
}

function SpanDetails({ span }: { span: any }) {
  return (
    <div className="grid gap-[1.5rem] mb-[2rem]">
      <SideDialogCodeSection title="Input" codeStr={JSON.stringify(span.input || null, null, 2)} />
      <SideDialogCodeSection title="Output" codeStr={JSON.stringify(span.output || null, null, 2)} />
      <SideDialogCodeSection title="Metadata" codeStr={JSON.stringify(span.metadata || null, null, 2)} />
      <SideDialogCodeSection title="Attributes" codeStr={JSON.stringify(span.attributes || null, null, 2)} />
    </div>
  );
}

type UsageProps = {
  traceUsage?: { [key: string]: any };
  traceSpans?: any[];
  className?: string;
  spanUsage?: { [key: string]: any };
};

function Usage({ traceUsage, traceSpans = [], spanUsage, className }: UsageProps) {
  if (!traceUsage && !spanUsage) {
    console.warn('No usage data available');
    return null;
  }

  if (traceUsage && spanUsage) {
    console.warn('Only one of traceUsage or spanUsage should be provided');
    return null;
  }

  const generationSpans = traceSpans.filter(span => span.spanType === 'llm_generation');
  const tokensByProvider = generationSpans.reduce(
    (acc, span) => {
      const spanUsage = span.attributes?.usage || {};
      const spanProvider = `${span.attributes?.provider ? span.attributes?.provider : ''}${span.attributes?.provider && span.attributes?.model ? ' / ' : ''}${span.attributes?.model ? span.attributes?.model : ''}`;

      if (!acc?.[spanProvider]) {
        acc[spanProvider] = { promptTokens: 0, completionTokens: 0 };
      }

      acc[spanProvider].promptTokens += spanUsage.promptTokens || 0;
      acc[spanProvider].completionTokens += spanUsage.completionTokens || 0;

      return acc;
    },
    {} as Record<string, { promptTokens: number; completionTokens: number }>,
  );

  Object.keys(tokensByProvider).forEach(provider => {
    const { promptTokens, completionTokens } = tokensByProvider[provider];
    tokensByProvider[provider] = { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens };
  });

  const traceTokensBasedOnSpans = Object.keys(tokensByProvider).reduce(
    (acc, provider) => {
      const { promptTokens, completionTokens, totalTokens } = tokensByProvider[provider];
      acc.promptTokens += promptTokens;
      acc.completionTokens += completionTokens;
      acc.totalTokens += totalTokens;
      return acc;
    },
    { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
  );

  const tokensByProviderValid = JSON.stringify(traceUsage) === JSON.stringify(traceTokensBasedOnSpans);

  const tokenPresentations: Record<string, { label: string; icon: React.ReactNode }> = {
    totalTokens: {
      label: 'Total LLM Tokens',
      icon: <CoinsIcon />,
    },
    promptTokens: {
      label: 'Prompt Tokens',
      icon: <ArrowRightIcon />,
    },
    completionTokens: {
      label: 'Completion Tokens',
      icon: <ArrowRightToLineIcon />,
    },
  };

  const usageKeyOrder = ['totalTokens', 'promptTokens', 'completionTokens'];

  const usageAsArray = Object.entries(traceUsage || spanUsage || {})
    .map(([key, value]) => ({ key, value }))
    .sort((a, b) => usageKeyOrder.indexOf(a.key) - usageKeyOrder.indexOf(b.key));

  return (
    <div
      className={cn(
        'grid gap-[1.5rem] pr-[1.5rem]',
        {
          'xl:grid-cols-3': usageAsArray.length === 3,
          'xl:grid-cols-2': usageAsArray.length === 2,
        },
        className,
      )}
    >
      {usageAsArray.map(({ key, value }) => (
        <div
          className={cn('bg-white/5 p-[1rem] px-[1.25rem] rounded-lg text-[0.875rem]', {
            'min-h-[5.5rem]': tokensByProviderValid,
          })}
          key={key}
        >
          <div
            className={cn(
              'grid grid-cols-[1.5rem_1fr_auto] gap-[.5rem] items-center',
              '[&>svg]:w-[1.5em] [&>svg]:h-[1.5em] [&>svg]:opacity-70',
            )}
          >
            {tokenPresentations?.[key]?.icon}
            <span className="text-[0.875rem]">{tokenPresentations?.[key]?.label}</span>
            <b className="text-[1rem]">{value}</b>
          </div>
          {tokensByProviderValid && (
            <div className="text-[0.875rem] mt-[0.5rem] pl-[2rem] ">
              {Object.entries(tokensByProvider).map(([provider, providerTokens]) => (
                <dl
                  key={provider}
                  className="grid grid-cols-[1fr_auto] gap-x-[1rem] gap-y-[.25rem]  justify-between text-icon3"
                >
                  <dt>{provider}</dt>
                  <dd>{providerTokens?.[key]}</dd>
                </dl>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
