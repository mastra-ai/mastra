import type { McpServerTask } from '@mastra/client-js';
import { Button } from '@mastra/playground-ui/components/Button';
import { CodeEditor } from '@mastra/playground-ui/components/CodeEditor';
import { DataKeysAndValues } from '@mastra/playground-ui/components/DataKeysAndValues';
import { DataPanel } from '@mastra/playground-ui/components/DataPanel';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { RelativeTimestamp } from '@mastra/playground-ui/components/RelativeTimestamp';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { DynamicForm } from '@mastra/playground-ui/lib/form/dynamic-form';
import { ListChecksIcon } from 'lucide-react';
import { z } from 'zod';
import { eventRequestErrorMessage } from '../../hooks/use-mcp-server-events';
import {
  isTerminalTask,
  useAnswerMcpServerTask,
  useCancelMcpServerTask,
  useMcpServerTask,
} from '../../hooks/use-mcp-server-tasks';
import { shortTaskKey, useTaskDrawerParam } from '../../hooks/use-task-drawer-param';
import { McpTaskStatusBadge } from './mcp-task-status-badge';
import { usePermissions } from '@/domains/auth/hooks/use-permissions';
import { toZodInputSchema } from '@/domains/tools/utils/to-zod-input-schema';

/** The side drawer a task opens in, driven by `?task=`. */
export function McpTaskDrawer({ serverId }: { serverId: string }) {
  const { taskKey, close } = useTaskDrawerParam();
  const { data: task, isSuccess } = useMcpServerTask(serverId, taskKey);

  return (
    <DataPanel open={taskKey !== undefined} onClose={close} title={task?.surface ?? 'Task'}>
      <DataPanel.Header>
        <DataPanel.Heading>
          <Icon size="sm" className="text-muted-foreground">
            <ListChecksIcon />
          </Icon>
          <span className="truncate">{task ? `${task.surface} task` : 'Task'}</span>
        </DataPanel.Heading>
        <DataPanel.HeaderActions>
          <DataPanel.CloseButton icon="x" tooltip="Close task" onClick={close} />
        </DataPanel.HeaderActions>
      </DataPanel.Header>
      <DataPanel.Content className="flex flex-col gap-4 px-3">
        {task ? (
          <McpTaskDrawerBody key={task.taskKey} serverId={serverId} task={task} />
        ) : (
          isSuccess && <Txt tone="muted">This task is no longer listed.</Txt>
        )}
      </DataPanel.Content>
    </DataPanel>
  );
}

function McpTaskDrawerBody({ serverId, task }: { serverId: string; task: McpServerTask }) {
  const cancel = useCancelMcpServerTask(serverId);
  // Cancelling and answering act on another client's task, so they need mcp:write, like the routes.
  // Until permissions load, show neither the actions nor the note, so neither flashes.
  const { canEdit, isLoading: permissionsLoading } = usePermissions();
  const canAct = !permissionsLoading && canEdit('mcp');
  const inputRequests = Object.entries(task.inputRequests ?? {});

  return (
    <>
      <DataKeysAndValues>
        <DataKeysAndValues.Key>Status</DataKeysAndValues.Key>
        <DataKeysAndValues.Value>
          <McpTaskStatusBadge status={task.status} />
        </DataKeysAndValues.Value>
        {task.statusMessage && (
          <>
            <DataKeysAndValues.Key>Message</DataKeysAndValues.Key>
            <DataKeysAndValues.Value>{task.statusMessage}</DataKeysAndValues.Value>
          </>
        )}
        <DataKeysAndValues.Key>Created</DataKeysAndValues.Key>
        <DataKeysAndValues.Value>
          <RelativeTimestamp value={task.createdAt} />
        </DataKeysAndValues.Value>
        <DataKeysAndValues.Key>Updated</DataKeysAndValues.Key>
        <DataKeysAndValues.Value>
          <RelativeTimestamp value={task.lastUpdatedAt} />
        </DataKeysAndValues.Value>
        <DataKeysAndValues.Key>Expires</DataKeysAndValues.Key>
        <DataKeysAndValues.Value>
          {task.expiresAt ? <RelativeTimestamp value={task.expiresAt} /> : 'never'}
        </DataKeysAndValues.Value>
        <DataKeysAndValues.Key>Task key</DataKeysAndValues.Key>
        <DataKeysAndValues.ValueWithCopyBtn copyValue={task.taskKey} copyTooltip="Copy task key">
          {shortTaskKey(task.taskKey)}
        </DataKeysAndValues.ValueWithCopyBtn>
        {task.clientLabel && (
          <>
            <DataKeysAndValues.Key>Client</DataKeysAndValues.Key>
            <DataKeysAndValues.ValueWithCopyBtn copyValue={task.clientLabel} copyTooltip="Copy client">
              {task.clientLabel}
            </DataKeysAndValues.ValueWithCopyBtn>
          </>
        )}
        <DataKeysAndValues.Key>Client key</DataKeysAndValues.Key>
        <DataKeysAndValues.ValueWithCopyBtn copyValue={task.principalKey} copyTooltip="Copy client key">
          {shortTaskKey(task.principalKey)}
        </DataKeysAndValues.ValueWithCopyBtn>
      </DataKeysAndValues>

      <Txt tone="muted" variant="caption">
        Keys are hashes: the task id and the client's credentials stay with the client that started the task.
      </Txt>

      {inputRequests.map(([key, request]) => (
        <McpTaskInputRequest
          key={key}
          serverId={serverId}
          taskKey={task.taskKey}
          inputKey={key}
          request={request}
          canAnswer={canAct}
        />
      ))}

      {!isTerminalTask(task) && !permissionsLoading && !canAct && (
        <Txt tone="muted" variant="caption">
          Cancelling or answering a task needs the mcp:write permission.
        </Txt>
      )}

      {!isTerminalTask(task) && canAct && (
        <div className="flex flex-col gap-2">
          <Button
            variant="destructive-ghost"
            className="self-start"
            disabled={cancel.isPending}
            onClick={() => cancel.mutate(task.taskKey)}
          >
            Cancel task
          </Button>
          {cancel.error && <Notice variant="destructive">{taskRequestErrorMessage(cancel.error)}</Notice>}
        </div>
      )}

      {task.result && <JsonSection label="Result" value={task.result} />}
      {task.error && <JsonSection label="Error" value={task.error} />}
    </>
  );
}

const elicitationSchema = z.object({
  message: z.string().optional(),
  requestedSchema: z.record(z.string(), z.unknown()),
});

function McpTaskInputRequest({
  serverId,
  taskKey,
  inputKey,
  request,
  canAnswer,
}: {
  serverId: string;
  taskKey: string;
  inputKey: string;
  request: NonNullable<McpServerTask['inputRequests']>[string];
  canAnswer: boolean;
}) {
  const answer = useAnswerMcpServerTask(serverId);
  const elicitation = request.method === 'elicitation/create' ? elicitationSchema.safeParse(request.params) : undefined;
  const respond = (response: Record<string, unknown>) =>
    answer.mutate({ taskKey, inputResponses: { [inputKey]: response } });

  return (
    <section aria-label={`Input request ${inputKey}`} className="flex flex-col gap-3">
      <Txt as="h3" variant="subheading">
        Input requested
      </Txt>
      {elicitation?.success && !canAnswer ? (
        <>
          {elicitation.data.message && <Txt>{elicitation.data.message}</Txt>}
          <JsonSection label="Request" value={request} />
        </>
      ) : elicitation?.success ? (
        <>
          {elicitation.data.message && <Txt>{elicitation.data.message}</Txt>}
          <DynamicForm
            schema={toZodInputSchema(elicitation.data.requestedSchema)}
            onSubmit={values => respond({ action: 'accept', content: values ?? {} })}
            isSubmitLoading={answer.isPending}
            submitButtonLabel="Accept"
            submitButtonVariant="primary"
            submitActions={
              <Button type="button" disabled={answer.isPending} onClick={() => respond({ action: 'decline' })}>
                Decline
              </Button>
            }
          />
        </>
      ) : (
        <>
          <Txt tone="muted">
            Studio can't answer a {request.method} request; the client that started the task has to.
          </Txt>
          <JsonSection label="Request" value={request} />
        </>
      )}
      {answer.error && <Notice variant="destructive">{taskRequestErrorMessage(answer.error)}</Notice>}
    </section>
  );
}

function JsonSection({ label, value }: { label: string; value: unknown }) {
  return (
    <section className="flex flex-col gap-2">
      <Txt as="h3" variant="subheading">
        {label}
      </Txt>
      <CodeEditor
        value={JSON.stringify(value, null, 2)}
        language="json"
        editable={false}
        lineNumbers={false}
        aria-label={`Task ${label.toLowerCase()}`}
      />
    </section>
  );
}

/** A 404 means the task moved on (finished, answered or expired) before the request landed. */
function taskRequestErrorMessage(error: unknown): string {
  const message = eventRequestErrorMessage(error);
  return message === 'Task not found'
    ? 'The task is no longer waiting for this; the list has been refreshed.'
    : message;
}
