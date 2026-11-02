import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { beforeEach, describe, expect, it } from 'vitest';

import { getElectroDbService } from '../../../entities';
import { WorkflowStorageDynamoDB } from './index';

interface SentCommand {
  name: string;
  input: Record<string, any>;
}

// Records every command sent through the document client and answers with an empty response,
// so the test sees the exact request parameters without a real DynamoDB.
function createRecordingStore() {
  const sent: SentCommand[] = [];
  const client = DynamoDBDocumentClient.from(
    new DynamoDBClient({ region: 'us-east-1', credentials: { accessKeyId: 'test', secretAccessKey: 'test' } }),
  );
  client.middlewareStack.add(
    (_next, context) => async args => {
      sent.push({ name: context.commandName!, input: args.input as Record<string, any> });
      return { output: { $metadata: {} } as any, response: {} };
    },
    { step: 'initialize', name: 'recordCommands' },
  );
  const store = new WorkflowStorageDynamoDB({ service: getElectroDbService(client, 'test-table') });
  return { store, sent };
}

describe('WorkflowStorageDynamoDB consistent snapshot reads', () => {
  let store: WorkflowStorageDynamoDB;
  let sent: SentCommand[];

  beforeEach(() => {
    ({ store, sent } = createRecordingStore());
  });

  const snapshotGets = () => sent.filter(c => c.name === 'GetItemCommand');

  it('loadWorkflowSnapshot reads the snapshot with ConsistentRead', async () => {
    await store.loadWorkflowSnapshot({ workflowName: 'wf', runId: 'run-1' });

    expect(snapshotGets()).toHaveLength(1);
    expect(snapshotGets()[0]!.input.ConsistentRead).toBe(true);
  });

  it('getWorkflowRunById with workflowName reads the snapshot with ConsistentRead', async () => {
    await store.getWorkflowRunById({ workflowName: 'wf', runId: 'run-1' });

    expect(snapshotGets()).toHaveLength(1);
    expect(snapshotGets()[0]!.input.ConsistentRead).toBe(true);
  });

  it('updateWorkflowState reads the current snapshot with ConsistentRead', async () => {
    await store.updateWorkflowState({ workflowName: 'wf', runId: 'run-1', opts: { status: 'running' } as any });

    expect(snapshotGets()).toHaveLength(1);
    expect(snapshotGets()[0]!.input.ConsistentRead).toBe(true);
  });

  it('updateWorkflowResults reads the current snapshot with ConsistentRead', async () => {
    await store.updateWorkflowResults({
      workflowName: 'wf',
      runId: 'run-1',
      stepId: 'step-1',
      result: { status: 'success', output: {} } as any,
      requestContext: {},
    });

    expect(snapshotGets()).toHaveLength(1);
    expect(snapshotGets()[0]!.input.ConsistentRead).toBe(true);
  });

  it('getWorkflowRunById without workflowName queries the GSI without ConsistentRead', async () => {
    await store.getWorkflowRunById({ runId: 'run-1' });

    const queries = sent.filter(c => c.name === 'QueryCommand');
    expect(queries).toHaveLength(1);
    expect(queries[0]!.input.IndexName).toBeDefined();
    // DynamoDB rejects ConsistentRead on global secondary indexes.
    expect(queries[0]!.input.ConsistentRead).toBeUndefined();
  });
});
