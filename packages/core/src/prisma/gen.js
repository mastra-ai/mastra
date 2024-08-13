const { writeFileSync } = require('fs');

const tmpl = `
enum FieldTypes {
  LONG_TEXT
  SINGLE_LINE_TEXT
  SINGLE_SELECT
  MULTI_SELECT
  CHECKBOX
  DATE
  USER
  BADGE_LIST
  CURRENCY
  URL
  PHONE
  CONTACT
  COMPANY
  PERSON
  ENRICHMENT
  COMPOSITE
}

model Field {
  id           String      @id @default(cuid())
  name         String
  displayName  String
  visible      Boolean     @default(true)
  recordType   String
  config       Json?
  description  String?
  type         FieldTypes
  order        Int
  modifiable   Boolean     @default(true)

  parentId        String? @map("parentId")
  parent          Field?  @relation("FieldToField", fields: [parentId], references: [id])
  compositeFields Field[] @relation("FieldToField")

  syncTable    SyncTable? @relation(fields: [syncTableId], references: [id])
  syncTableId  String?

  @@map("fields")
}

enum RecordStatus {
  ACTIVE
  ARCHIVED
}

enum RecordEnrichmentStatus {
  PENDING
  APPLIED
  UNAPPLIED
  FAILED
}

model Record {
  id         String  @id @default(cuid())
  externalId String?
  data          Json      @default("{}")
  source        String    @default("MANUAL")
  recordType   String
  syncTable    SyncTable? @relation(fields: [syncTableId], references: [id])
  syncTableId  String?

  status           RecordStatus           @default(ACTIVE)
  enrichmentStatus RecordEnrichmentStatus @default(UNAPPLIED)

  deletedAt   DateTime?
  createdAt   DateTime   @default(now())
  updatedAt   DateTime?  @default(now())
  
  @@index([externalId])
  @@map("records")
}

model DataIntegrationCredential {
  id    String   @id @default(cuid())
  type  String
  value Json
  scope String[]

  dataIntegration   DataIntegration @relation(fields: [dataIntegrationId], references: [id], onDelete: Cascade)
  dataIntegrationId String          @unique

  @@map("data_integration_credentials")
}

model DataIntegration {
  id     String   @id @default(cuid())
  name   String
  issues String[] @default([])

  syncConfig Json?

  connectionId String

  createdAt  DateTime  @default(now())
  updatedAt  DateTime? @updatedAt
  
  lastSyncAt DateTime?

  credential DataIntegrationCredential?

  subscriptionId String?

  syncTables SyncTable[]

  @@unique([connectionId, name])

  @@index([subscriptionId])
  @@map("data_integrations")

}

model SyncTable {
    id          String     @id @default(cuid())
    name        String

    fields      Field[]
    records     Record[]
    
    createdAt   DateTime   @default(now())
    updatedAt   DateTime?  @default(now())
    createdBy   String

   
    dataIntegration DataIntegration @relation(fields: [dataIntegrationId], references: [id])
    dataIntegrationId String

    @@map("syncTable")
}

`;

function main() {
  const schema = `
        datasource db {
            provider = "postgresql"
            url      = "yo"
        }
        generator client {
            provider = "prisma-client-js"
          }
        ${tmpl}
    `;

  writeFileSync(__dirname + '/schema.prisma', schema);
}

main();
