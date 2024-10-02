# DB Storage

Mastra stores synced records in your Postgres database.

In order to allow you to continue to control migrations on your database, while letting Mastra use it to sync data into, Mastra uses the Postgres concept of [schemas](https://www.postgresql.org/docs/current/ddl-schemas.html).

For more details, look at `/src/prisma/schema.prisma` in the core package.

## Records

Records represent individual data entries in the system. Each record has the following fields:

| Field            | Type                   | Description                                                                  |
| ---------------- | ---------------------- | ---------------------------------------------------------------------------- |
| id               | String                 | Unique identifier for the record, automatically generated using CUID         |
| externalId       | String (optional)      | An optional external identifier for the record                               |
| data             | Json                   | JSON object storing the record's data, defaults to an empty object           |
| source           | String                 | The source of the record, defaults to "MANUAL"                               |
| entityType       | String                 | The type of entity associated with this record                               |
| entity           | Entity (optional)      | Relation to an Entity object                                                 |
| entityId         | String (optional)      | The ID of the related Entity                                                 |
| status           | RecordStatus           | The current status of the record, defaults to ACTIVE                         |
| enrichmentStatus | RecordEnrichmentStatus | The enrichment status of the record, defaults to UNAPPLIED                   |
| deletedAt        | DateTime (optional)    | Timestamp when the record was deleted (null if not deleted)                  |
| createdAt        | DateTime               | Timestamp when the record was created, automatically set to the current time |
| updatedAt        | DateTime               | Timestamp when the record was last updated, defaults to the creation time    |

<!-- Note: The `RecordStatus` and `RecordEnrichmentStatus` are enum types defined elsewhere in the schema. -->

## Connections

Connections represent one user in one external system.

| Field          | Type                  | Description                                                                     |
| -------------- | --------------------- | ------------------------------------------------------------------------------- |
| id             | String                | Unique identifier for the entity, automatically generated using CUID            |
| name           | String                | The name of the entity                                                          |
| issues         | String[]              | An array of issues associated with the entity, defaults to an empty array       |
| syncConfig     | Json (optional)       | JSON object storing synchronization configuration for the entity                |
| connectionId   | String                | A reference identifier for the entity                                           |
| createdAt      | DateTime              | Timestamp when the entity was created, automatically set to the current time    |
| updatedAt      | DateTime (optional)   | Timestamp when the entity was last updated                                      |
| lastSyncAt     | DateTime (optional)   | Timestamp of the last synchronization for this entity                           |
| credential     | Credential (optional) | Relation to a Credential object                                                 |
| subscriptionId | String (optional)     | The ID of the subscription associated with this entity                          |
| entities       | Entity[]              | Relation to other Entity objects (likely representing a hierarchical structure) |
