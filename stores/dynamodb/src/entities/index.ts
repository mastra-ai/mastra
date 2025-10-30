import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { Service } from 'electrodb';
import { evalEntity } from './eval';
import { messageEntity } from './message';
import { resourceEntity } from './resource';
import { scoreEntity } from './score';
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
      workflow_snapshot: workflowSnapshotEntity,
      resource: resourceEntity,
      score: scoreEntity,
    },
    {
      client,
      table: tableName,
    },
  );
}
