import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { Service } from 'electrodb';
import { evalEntity } from './eval';
import { messageEntity } from './message';
import { threadEntity } from './thread';
import { traceEntity } from './trace';
import { workflowSnapshotEntity } from './workflow-snapshot';

export function getElectroDbService(client: DynamoDBDocumentClient, tableName: string) {
  return new Service(
    {
      thread: threadEntity,
      message: messageEntity,
      eval: evalEntity,
      trace: traceEntity,
      workflowSnapshot: workflowSnapshotEntity,
    },
    {
      client,
      table: tableName,
    },
  );
}
