import { MastraEngine } from '../engine';

export class WorkflowSnapshot {
  private engine: MastraEngine;
  constructor(engine: MastraEngine) {
    this.engine = engine;
  }

  async persist({
    entityName,
    connectionId,
    runId,
    snapshot,
  }: {
    entityName: string;
    connectionId: string;
    runId: string;
    snapshot: any;
  }) {
    await this.engine.syncRecords({
      name: entityName,
      connectionId,
      records: [
        {
          externalId: runId,
          data: { snapshot: JSON.stringify(snapshot) },
        },
      ],
    });
  }

  async load({ runId, connectionId, entityName }: { connectionId: string; entityName: string; runId: string }) {
    const state = await this.engine.getRecordsByEntityNameAndExternalId({
      entityName,
      connectionId,
      externalId: runId,
    });

    return state?.[0]?.data?.snapshot;
  }
}
