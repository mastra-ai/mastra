import { Service } from 'electrodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { threadEntity } from './thread';
import { messageEntity } from './message';
import { evalEntity } from './eval';
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
