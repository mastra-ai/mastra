export interface BaseEntity {
  id: string;
  connectionId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date | null;
  lastSyncId: string | null;
}
export interface BaseRecord {
  id: string;
  entityId: string;
  data: Record<string, any>;
  createdAt: Date;
  updatedAt: Date | null;
  externalId: string;
  entityType: string;
}
