import type {
  Schedule,
  ScheduleFilter,
  ScheduleStatus,
  ScheduleTarget,
  ScheduleTrigger,
  ScheduleTriggerListOptions,
  ScheduleUpdate,
} from '@mastra/core/storage';
import { SchedulesStorage, TABLE_SCHEDULES, TABLE_SCHEDULE_TRIGGERS } from '@mastra/core/storage';
import type { MongoDBConnector } from '../../connectors/MongoDBConnector';
import { resolveMongoDBConfig } from '../../db';
import type { MongoDBDomainConfig, MongoDBIndexConfig } from '../../types';

function scheduleToDoc(schedule: Schedule): Record<string, any> {
  return {
    id: schedule.id,
    target: schedule.target,
    cron: schedule.cron,
    timezone: schedule.timezone ?? null,
    status: schedule.status,
    next_fire_at: schedule.nextFireAt,
    last_fire_at: schedule.lastFireAt ?? null,
    last_run_id: schedule.lastRunId ?? null,
    created_at: schedule.createdAt,
    updated_at: schedule.updatedAt,
    metadata: schedule.metadata ?? null,
  };
}

function docToSchedule(doc: Record<string, any>): Schedule {
  const target = doc.target as ScheduleTarget | undefined;
  if (!target) {
    throw new Error(`Schedule ${doc.id} has invalid target`);
  }
  const schedule: Schedule = {
    id: String(doc.id),
    target,
    cron: String(doc.cron),
    status: String(doc.status) as ScheduleStatus,
    nextFireAt: Number(doc.next_fire_at),
    createdAt: Number(doc.created_at),
    updatedAt: Number(doc.updated_at),
  };
  if (doc.timezone != null) schedule.timezone = String(doc.timezone);
  if (doc.last_fire_at != null) schedule.lastFireAt = Number(doc.last_fire_at);
  if (doc.last_run_id != null) schedule.lastRunId = String(doc.last_run_id);
  if (doc.metadata != null) schedule.metadata = doc.metadata as Record<string, unknown>;
  return schedule;
}

function triggerToDoc(trigger: ScheduleTrigger): Record<string, any> {
  return {
    schedule_id: trigger.scheduleId,
    run_id: trigger.runId,
    scheduled_fire_at: trigger.scheduledFireAt,
    actual_fire_at: trigger.actualFireAt,
    status: trigger.status,
    error: trigger.error ?? null,
  };
}

function docToTrigger(doc: Record<string, any>): ScheduleTrigger {
  const trigger: ScheduleTrigger = {
    scheduleId: String(doc.schedule_id),
    runId: String(doc.run_id),
    scheduledFireAt: Number(doc.scheduled_fire_at),
    actualFireAt: Number(doc.actual_fire_at),
    status: String(doc.status) as ScheduleTrigger['status'],
  };
  if (doc.error != null) trigger.error = String(doc.error);
  return trigger;
}

export class SchedulesMongoDB extends SchedulesStorage {
  #connector: MongoDBConnector;
  #skipDefaultIndexes?: boolean;
  #indexes?: MongoDBIndexConfig[];

  static readonly MANAGED_COLLECTIONS = [TABLE_SCHEDULES, TABLE_SCHEDULE_TRIGGERS] as const;

  constructor(config: MongoDBDomainConfig) {
    super();
    this.#connector = resolveMongoDBConfig(config);
    this.#skipDefaultIndexes = config.skipDefaultIndexes;
    this.#indexes = config.indexes?.filter(idx =>
      (SchedulesMongoDB.MANAGED_COLLECTIONS as readonly string[]).includes(idx.collection),
    );
  }

  private getSchedulesCollection() {
    return this.#connector.getCollection(TABLE_SCHEDULES);
  }

  private getTriggersCollection() {
    return this.#connector.getCollection(TABLE_SCHEDULE_TRIGGERS);
  }

  getDefaultIndexDefinitions(): MongoDBIndexConfig[] {
    return [
      { collection: TABLE_SCHEDULES, keys: { id: 1 }, options: { unique: true } },
      { collection: TABLE_SCHEDULES, keys: { status: 1, next_fire_at: 1 } },
      { collection: TABLE_SCHEDULES, keys: { 'target.workflowId': 1 } },
      { collection: TABLE_SCHEDULE_TRIGGERS, keys: { schedule_id: 1, actual_fire_at: -1 } },
      { collection: TABLE_SCHEDULE_TRIGGERS, keys: { run_id: 1 }, options: { unique: true } },
    ];
  }

  async createDefaultIndexes(): Promise<void> {
    if (this.#skipDefaultIndexes) return;
    for (const indexDef of this.getDefaultIndexDefinitions()) {
      try {
        const collection = await this.#connector.getCollection(indexDef.collection);
        await collection.createIndex(indexDef.keys, indexDef.options);
      } catch (error) {
        this.logger?.warn?.(`Failed to create index on ${indexDef.collection}:`, error);
      }
    }
  }

  async createCustomIndexes(): Promise<void> {
    if (!this.#indexes || this.#indexes.length === 0) return;
    for (const indexDef of this.#indexes) {
      try {
        const collection = await this.#connector.getCollection(indexDef.collection);
        await collection.createIndex(indexDef.keys, indexDef.options);
      } catch (error) {
        this.logger?.warn?.(`Failed to create custom index on ${indexDef.collection}:`, error);
      }
    }
  }

  async init(): Promise<void> {
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  async dangerouslyClearAll(): Promise<void> {
    const triggers = await this.getTriggersCollection();
    await triggers.deleteMany({});
    const schedules = await this.getSchedulesCollection();
    await schedules.deleteMany({});
  }

  async createSchedule(schedule: Schedule): Promise<Schedule> {
    const collection = await this.getSchedulesCollection();
    const existing = await collection.findOne({ id: schedule.id });
    if (existing) {
      throw new Error(`Schedule with id "${schedule.id}" already exists`);
    }
    await collection.insertOne(scheduleToDoc(schedule));
    return schedule;
  }

  async getSchedule(id: string): Promise<Schedule | null> {
    const collection = await this.getSchedulesCollection();
    const doc = await collection.findOne({ id });
    return doc ? docToSchedule(doc) : null;
  }

  async listSchedules(filter?: ScheduleFilter): Promise<Schedule[]> {
    const query: Record<string, any> = {};
    if (filter?.status) query.status = filter.status;
    if (filter?.workflowId) query['target.workflowId'] = filter.workflowId;

    const collection = await this.getSchedulesCollection();
    const docs = await collection.find(query).sort({ created_at: 1 }).toArray();
    return docs.map(docToSchedule);
  }

  async listDueSchedules(now: number, limit?: number): Promise<Schedule[]> {
    const cap = limit ?? 100;
    const collection = await this.getSchedulesCollection();
    const docs = await collection
      .find({ status: 'active', next_fire_at: { $lte: now } })
      .sort({ next_fire_at: 1 })
      .limit(cap)
      .toArray();
    return docs.map(docToSchedule);
  }

  async updateSchedule(id: string, patch: ScheduleUpdate): Promise<Schedule> {
    const $set: Record<string, any> = {};

    if ('cron' in patch && patch.cron !== undefined) $set.cron = patch.cron;
    if ('timezone' in patch) $set.timezone = patch.timezone ?? null;
    if ('status' in patch && patch.status !== undefined) $set.status = patch.status;
    if ('nextFireAt' in patch && patch.nextFireAt !== undefined) $set.next_fire_at = patch.nextFireAt;
    if ('target' in patch && patch.target !== undefined) $set.target = patch.target;
    if ('metadata' in patch) $set.metadata = patch.metadata ?? null;

    $set.updated_at = Date.now();

    const collection = await this.getSchedulesCollection();
    const result = await collection.findOneAndUpdate({ id }, { $set }, { returnDocument: 'after' });
    if (!result) throw new Error(`Schedule ${id} not found`);
    return docToSchedule(result);
  }

  async updateScheduleNextFire(
    id: string,
    expectedNextFireAt: number,
    newNextFireAt: number,
    lastFireAt: number,
    lastRunId: string,
  ): Promise<boolean> {
    const collection = await this.getSchedulesCollection();
    const result = await collection.updateOne(
      { id, next_fire_at: expectedNextFireAt, status: 'active' },
      {
        $set: {
          next_fire_at: newNextFireAt,
          last_fire_at: lastFireAt,
          last_run_id: lastRunId,
          updated_at: Date.now(),
        },
      },
    );
    return result.matchedCount > 0;
  }

  async deleteSchedule(id: string): Promise<void> {
    const triggers = await this.getTriggersCollection();
    await triggers.deleteMany({ schedule_id: id });
    const schedules = await this.getSchedulesCollection();
    await schedules.deleteOne({ id });
  }

  async recordTrigger(trigger: ScheduleTrigger): Promise<void> {
    const collection = await this.getTriggersCollection();
    await collection.insertOne(triggerToDoc(trigger));
  }

  async listTriggers(scheduleId: string, opts?: ScheduleTriggerListOptions): Promise<ScheduleTrigger[]> {
    const query: Record<string, any> = { schedule_id: scheduleId };

    if (opts?.fromActualFireAt != null || opts?.toActualFireAt != null) {
      const range: Record<string, number> = {};
      if (opts?.fromActualFireAt != null) range.$gte = opts.fromActualFireAt;
      if (opts?.toActualFireAt != null) range.$lt = opts.toActualFireAt;
      query.actual_fire_at = range;
    }

    const collection = await this.getTriggersCollection();
    let cursor = collection.find(query).sort({ actual_fire_at: -1 });
    if (opts?.limit != null) {
      cursor = cursor.limit(Math.floor(opts.limit));
    }
    const docs = await cursor.toArray();
    return docs.map(docToTrigger);
  }
}
