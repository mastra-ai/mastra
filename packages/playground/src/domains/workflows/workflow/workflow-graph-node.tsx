import {
  Badge,
  CheckIcon,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  CrossIcon,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Icon,
  ScrollArea,
  Txt,
  cn,
} from '@mastra/playground-ui';
import { WorkflowStepFactory } from '@mastra/react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { ChevronDown, CircleDashed, HourglassIcon, Loader2, PauseIcon, ShieldAlert } from 'lucide-react';
import { Highlight, themes } from 'prism-react-renderer';
import { Fragment, useState } from 'react';

import { useCurrentRun } from '../context/use-current-run';
import type { Step } from '../context/use-current-run';
import { useWorkflowStepDetail } from '../context/workflow-step-detail-context';
import type { Condition } from './utils';
import { Clock } from './workflow-clock';
import { BADGE_COLORS, BADGE_ICONS, getConditionIconAndColor, getNodeBadgeInfo } from './workflow-node-badges';
import { WorkflowStepActionBar } from './workflow-step-action-bar';
import type { WorkflowStepNode, WorkflowStepNodeData } from './workflow-step-node-utils';

export interface WorkflowGraphNodeProps {
  parentWorkflowName?: string;
  stepsFlow: Record<string, string[]>;
}

type DisplayStatus = Step['status'] | 'tripwire' | undefined;

const getDisplayStatus = (step?: Step): { displayStatus: DisplayStatus; isTripwire: boolean } => {
  const isTripwire = step?.status === 'failed' && step?.tripwire !== undefined;
  return {
    displayStatus: isTripwire ? 'tripwire' : step?.status,
    isTripwire,
  };
};

const StatusIcon = ({ displayStatus, hasStep }: { displayStatus: DisplayStatus; hasStep: boolean }) => (
  <Icon>
    {displayStatus === 'tripwire' && <ShieldAlert className="text-amber-400" />}
    {displayStatus === 'failed' && <CrossIcon className="text-accent2" />}
    {displayStatus === 'success' && <CheckIcon className="text-accent1" />}
    {displayStatus === 'suspended' && <PauseIcon className="text-accent3" />}
    {displayStatus === 'waiting' && <HourglassIcon className="text-accent5" />}
    {displayStatus === 'running' && <Loader2 className="text-accent6 animate-spin" />}
    {!hasStep && <CircleDashed className="text-neutral2" />}
  </Icon>
);

const WorkflowNodeBadges = ({
  data,
  stepGraph,
  mapConfig,
}: {
  data: WorkflowStepNodeData;
  stepGraph?: WorkflowStepNodeData['stepGraph'];
  mapConfig?: string;
}) => {
  const { isSleepNode, isForEachNode, isMapNode, isNestedWorkflow, hasSpecialBadge } = getNodeBadgeInfo({
    duration: data.duration,
    date: data.date,
    isForEach: data.isForEach,
    mapConfig,
    canSuspend: data.canSuspend,
    isParallel: data.isParallel,
    stepGraph,
  });

  if (!hasSpecialBadge) {
    return null;
  }

  return (
    <div className="px-3 pt-2 pb-1 flex gap-1.5 flex-wrap">
      {isSleepNode && (
        <Badge
          icon={
            data.date ? (
              <BADGE_ICONS.sleepUntil className="text-current" style={{ color: BADGE_COLORS.sleep }} />
            ) : (
              <BADGE_ICONS.sleep className="text-current" style={{ color: BADGE_COLORS.sleep }} />
            )
          }
        >
          {data.date ? 'SLEEP UNTIL' : 'SLEEP'}
        </Badge>
      )}
      {data.canSuspend && (
        <Badge icon={<BADGE_ICONS.suspend className="text-current" style={{ color: BADGE_COLORS.suspend }} />}>
          SUSPEND/RESUME
        </Badge>
      )}
      {data.isParallel && (
        <Badge icon={<BADGE_ICONS.parallel className="text-current" style={{ color: BADGE_COLORS.parallel }} />}>
          PARALLEL
        </Badge>
      )}
      {isNestedWorkflow && (
        <Badge icon={<BADGE_ICONS.workflow className="text-current" style={{ color: BADGE_COLORS.workflow }} />}>
          WORKFLOW
        </Badge>
      )}
      {isForEachNode && (
        <Badge icon={<BADGE_ICONS.forEach className="text-current" style={{ color: BADGE_COLORS.forEach }} />}>
          FOREACH
        </Badge>
      )}
      {isMapNode && (
        <Badge icon={<BADGE_ICONS.map className="text-current" style={{ color: BADGE_COLORS.map }} />}>MAP</Badge>
      )}
    </div>
  );
};

const ForEachProgress = ({ step }: { step?: Step }) => {
  if (!step?.foreachProgress) {
    return null;
  }

  return (
    <div className="px-3 pb-2 flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-surface1 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            step.foreachProgress.iterationStatus === 'failed' ? 'bg-accent2' : 'bg-accent1',
          )}
          style={{
            width: `${
              step.foreachProgress.totalCount > 0
                ? (step.foreachProgress.completedCount / step.foreachProgress.totalCount) * 100
                : 0
            }%`,
          }}
        />
      </div>
      <Txt variant="ui-xs" className="text-neutral3 whitespace-nowrap">
        {step.foreachProgress.completedCount} / {step.foreachProgress.totalCount}
      </Txt>
    </div>
  );
};

const SleepDetails = ({ data }: { data: WorkflowStepNodeData }) => (
  <>
    {data.duration && (
      <Txt variant="ui-sm" className="text-neutral3 px-3 pb-2">
        sleeps for <strong>{data.duration}ms</strong>
      </Txt>
    )}
    {data.date && (
      <Txt variant="ui-sm" className="text-neutral3 px-3 pb-2">
        sleeps until <strong>{new Date(data.date).toLocaleString()}</strong>
      </Txt>
    )}
  </>
);

const WorkflowStepCard = ({
  data,
  parentWorkflowName,
  stepsFlow,
}: {
  data: WorkflowStepNodeData;
  parentWorkflowName?: string;
  stepsFlow: Record<string, string[]>;
}) => {
  const { steps } = useCurrentRun();
  const { showNestedGraph } = useWorkflowStepDetail();
  const { label, stepId, description } = data;
  const mapConfig = data.mapConfig ?? data.workflowStep.step?.mapConfig;
  const stepGraph = data.stepGraph ?? data.workflowStep.step?.serializedStepFlow;
  const fullLabel = parentWorkflowName ? `${parentWorkflowName}.${label}` : label;
  const stepKey = parentWorkflowName ? `${parentWorkflowName}.${stepId || label}` : stepId || label;
  const step = steps[stepKey];
  const { displayStatus, isTripwire } = getDisplayStatus(step);

  return (
    <div
      data-workflow-node
      data-workflow-step-status={displayStatus ?? 'idle'}
      data-testid={data.workflowStep.kind === 'nested-workflow-step' ? 'workflow-nested-node' : 'workflow-default-node'}
      className={cn(
        'bg-surface3 rounded-lg w-[274px] border border-border1',
        getNodeBadgeInfo({
          duration: data.duration,
          date: data.date,
          isForEach: data.isForEach,
          mapConfig,
          canSuspend: data.canSuspend,
          isParallel: data.isParallel,
          stepGraph,
        }).hasSpecialBadge
          ? 'pt-0'
          : 'pt-2',
        displayStatus === 'success' && 'bg-accent1Darker',
        displayStatus === 'failed' && 'bg-accent2Darker',
        displayStatus === 'tripwire' && 'bg-amber-950/40 border-amber-500/30',
        displayStatus === 'suspended' && 'bg-accent3Darker',
        displayStatus === 'waiting' && 'bg-accent5Darker',
        displayStatus === 'running' && 'bg-accent6Darker',
      )}
    >
      <WorkflowNodeBadges data={data} stepGraph={stepGraph} mapConfig={mapConfig} />
      <div className={cn('flex items-center gap-2 px-3', !description && 'pb-2')}>
        <StatusIcon displayStatus={displayStatus} hasStep={Boolean(step)} />
        <Txt variant="ui-lg" className="text-neutral6 font-medium inline-flex items-center gap-1 justify-between w-full">
          {label} {step?.startedAt && <Clock startedAt={step.startedAt} endedAt={step.endedAt} />}
        </Txt>
      </div>

      {description && (
        <Txt variant="ui-sm" className="text-neutral3 px-3 pb-2">
          {description}
        </Txt>
      )}

      {data.isForEach && <ForEachProgress step={step} />}
      <SleepDetails data={data} />

      <WorkflowStepActionBar
        stepName={label}
        stepId={stepId}
        input={step?.input}
        resumeData={step?.resumeData}
        output={step?.output}
        suspendOutput={step?.suspendOutput}
        error={isTripwire ? undefined : step?.error}
        tripwire={isTripwire ? step?.tripwire : undefined}
        mapConfig={mapConfig}
        onShowNestedGraph={
          stepGraph ? () => showNestedGraph({ label, fullStep: fullLabel, stepGraph }) : undefined
        }
        status={displayStatus}
        stepKey={stepKey}
        stepsFlow={stepsFlow}
      />
    </div>
  );
};

const ConditionCode = ({
  condition,
  previousDisplayStatus,
  hasNextStep,
  onOpen,
}: {
  condition: Extract<Condition, { fnString: string }>;
  previousDisplayStatus: DisplayStatus;
  hasNextStep: boolean;
  onOpen: () => void;
}) => (
  <div className="px-3">
    <Highlight theme={themes.oneDark} code={String(condition.fnString).trim()} language="javascript">
      {({ className, style, tokens, getLineProps, getTokenProps }) => (
        <pre
          className={cn(
            'relative font-mono p-3 w-full cursor-pointer rounded-lg text-xs bg-surface4! whitespace-pre-wrap wrap-break-word',
            className,
            previousDisplayStatus === 'success' && hasNextStep && 'bg-accent1Dark!',
            previousDisplayStatus === 'failed' && hasNextStep && 'bg-accent2Dark!',
            previousDisplayStatus === 'tripwire' && hasNextStep && 'bg-amber-900/40!',
          )}
          onClick={onOpen}
          style={style}
        >
          {tokens.map((line, i) => (
            <div key={i} {...getLineProps({ line })}>
              <span className="inline-block mr-2 text-neutral3">{i + 1}</span>
              {line.map((token, key) => (
                <span key={key} {...getTokenProps({ token })} />
              ))}
            </div>
          ))}
        </pre>
      )}
    </Highlight>
  </div>
);

const ConditionDialog = ({
  open,
  onOpenChange,
  condition,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  condition?: Extract<Condition, { fnString: string }>;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-[30rem]">
      <DialogHeader>
        <DialogTitle className="sr-only">Condition Function</DialogTitle>
        <DialogDescription>View the condition function code</DialogDescription>
      </DialogHeader>
      <DialogBody>
        <ScrollArea className="w-full" maxHeight="400px">
          {condition && (
            <Highlight theme={themes.oneDark} code={String(condition.fnString).trim()} language="javascript">
              {({ className, style, tokens, getLineProps, getTokenProps }) => (
                <pre
                  className={`${className} relative font-mono text-sm overflow-x-auto p-3 w-full rounded-lg mt-2 dark:bg-zinc-800`}
                  style={{
                    ...style,
                    backgroundColor: '#121212',
                    padding: '0 0.75rem 0 0',
                  }}
                >
                  {tokens.map((line, i) => (
                    <div key={i} {...getLineProps({ line })}>
                      <span className="inline-block mr-2 text-neutral3">{i + 1}</span>
                      {line.map((token, key) => (
                        <span key={key} {...getTokenProps({ token })} />
                      ))}
                    </div>
                  ))}
                </pre>
              )}
            </Highlight>
          )}
        </ScrollArea>
      </DialogBody>
    </DialogContent>
  </Dialog>
);

const WorkflowConditionCard = ({ data }: { data: WorkflowStepNodeData }) => {
  const [open, setOpen] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogCondition, setDialogCondition] = useState<Extract<Condition, { fnString: string }> | undefined>();
  const { steps } = useCurrentRun();
  const conditions = data.conditions ?? [];
  const type = conditions[0]?.type;
  const isCollapsible = (conditions.some(condition => condition.fnString) || conditions.length > 1) && type !== 'else';
  const previousStep = data.previousStepId ? steps[data.previousStepId] : undefined;
  const nextStep = data.nextStepId ? steps[data.nextStepId] : undefined;
  const { displayStatus: previousDisplayStatus, isTripwire } = getDisplayStatus(previousStep);
  const { icon: IconComponent, color } = getConditionIconAndColor(type);

  return (
    <div
      data-workflow-node
      data-workflow-step-status={previousDisplayStatus ?? 'idle'}
      data-testid="workflow-condition-node"
      className={cn(
        'bg-surface3 rounded-lg w-dropdown-max-height border border-border1',
        previousDisplayStatus === 'success' && nextStep && 'bg-accent1Darker',
        previousDisplayStatus === 'failed' && nextStep && 'bg-accent2Darker',
        previousDisplayStatus === 'tripwire' && nextStep && 'bg-amber-950/40 border-amber-500/30',
        !previousStep && Boolean(nextStep?.status) && 'bg-accent1Darker',
      )}
    >
      <Collapsible
        open={!isCollapsible ? true : open}
        onOpenChange={(_open: boolean) => {
          if (isCollapsible) {
            setOpen(_open);
          }
        }}
      >
        <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2">
          <Badge
            icon={
              IconComponent ? <IconComponent className="text-current" {...(color ? { style: { color } } : {})} /> : null
            }
          >
            {type?.toUpperCase()}
          </Badge>
          {isCollapsible && (
            <Icon>
              <ChevronDown
                className={cn('transition-transform text-neutral3', {
                  'transform rotate-180': open,
                })}
              />
            </Icon>
          )}
        </CollapsibleTrigger>

        {type === 'else' ? null : (
          <CollapsibleContent className="flex flex-col gap-2 pb-2">
            {conditions.map((condition, index) => {
              const conjType = condition.conj || type;
              const { icon: ConjIconComponent, color: conjColor } = getConditionIconAndColor(conjType);
              const conjBadge =
                index === 0 ? null : (
                  <Badge
                    icon={
                      ConjIconComponent ? (
                        <ConjIconComponent
                          className="text-current"
                          {...(conjColor ? { style: { color: conjColor } } : {})}
                        />
                      ) : null
                    }
                  >
                    {condition.conj?.toLocaleUpperCase() || 'WHEN'}
                  </Badge>
                );

              return condition.fnString ? (
                <ConditionCode
                  key={`${condition.fnString}-${index}`}
                  condition={condition}
                  previousDisplayStatus={previousDisplayStatus}
                  hasNextStep={Boolean(nextStep)}
                  onOpen={() => {
                    setDialogCondition(condition);
                    setOpenDialog(true);
                  }}
                />
              ) : (
                <Fragment key={`${condition.ref?.path}-${index}`}>
                  {condition.ref?.step ? (
                    <div className="flex items-center gap-1">
                      {conjBadge}
                      <Txt variant="ui-xs" className=" text-neutral3 flex-1">
                        {typeof condition.ref.step === 'string' ? condition.ref.step : condition.ref.step.id}'s{' '}
                        {condition.ref.path}{' '}
                        {Object.entries(condition.query).map(([key, value]) => `${key} ${String(value)}`)}
                      </Txt>
                    </div>
                  ) : null}
                </Fragment>
              );
            })}
          </CollapsibleContent>
        )}
      </Collapsible>

      <ConditionDialog open={openDialog} onOpenChange={setOpenDialog} condition={dialogCondition} />

      <WorkflowStepActionBar
        stepName={data.nextStepId ?? data.label}
        input={previousStep?.output}
        mapConfig={data.mapConfig}
        tripwire={isTripwire ? previousStep?.tripwire : undefined}
        status={nextStep ? previousDisplayStatus : undefined}
      />
    </div>
  );
};

export function WorkflowGraphNode({
  data,
  parentWorkflowName,
  stepsFlow,
}: NodeProps<WorkflowStepNode> & WorkflowGraphNodeProps) {
  return (
    <>
      {!data.withoutTopHandle && <Handle type="target" position={Position.Top} style={{ visibility: 'hidden' }} />}
      <WorkflowStepFactory
        step={data.workflowStep}
        Step={() => <WorkflowStepCard data={data} parentWorkflowName={parentWorkflowName} stepsFlow={stepsFlow} />}
        MapStep={() => <WorkflowStepCard data={data} parentWorkflowName={parentWorkflowName} stepsFlow={stepsFlow} />}
        ForEachStep={() => <WorkflowStepCard data={data} parentWorkflowName={parentWorkflowName} stepsFlow={stepsFlow} />}
        ParallelStep={() => <WorkflowStepCard data={data} parentWorkflowName={parentWorkflowName} stepsFlow={stepsFlow} />}
        Conditional={() => <WorkflowConditionCard data={data} />}
        LoopStep={() => <WorkflowStepCard data={data} parentWorkflowName={parentWorkflowName} stepsFlow={stepsFlow} />}
        SleepStep={() => <WorkflowStepCard data={data} parentWorkflowName={parentWorkflowName} stepsFlow={stepsFlow} />}
        SleepUntilStep={() => <WorkflowStepCard data={data} parentWorkflowName={parentWorkflowName} stepsFlow={stepsFlow} />}
        NestedWorkflowStep={() => (
          <WorkflowStepCard data={data} parentWorkflowName={parentWorkflowName} stepsFlow={stepsFlow} />
        )}
        UnknownStep={() => <WorkflowStepCard data={data} parentWorkflowName={parentWorkflowName} stepsFlow={stepsFlow} />}
      />
      {!data.withoutBottomHandle && <Handle type="source" position={Position.Bottom} style={{ visibility: 'hidden' }} />}
    </>
  );
}
