const { writeFileSync } = require('fs');

const tmpl = `
enum PropertyType {
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

model Property {
  id           String      @id @default(cuid())
  name         String
  displayName  String
  visible      Boolean     @default(true)
  config       Json?
  description  String?
  type         PropertyType
  order        Int
  modifiable   Boolean     @default(true)
  parentId        String? @map("parentId")
  parent          Property?  @relation("PropertyToProperty", fields: [parentId], references: [id])
  compositeProperty Property[] @relation("PropertyToProperty")
  entity    Entity? @relation(fields: [entityId], references: [id])
  entityId  String?
  @@map("properties")
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
  entity    Entity? @relation(fields: [entityId], references: [id])
  entityId  String?
  status           RecordStatus           @default(ACTIVE)
  enrichmentStatus RecordEnrichmentStatus @default(UNAPPLIED)
  deletedAt   DateTime?
  createdAt   DateTime   @default(now())
  updatedAt   DateTime?  @default(now())
  
  @@index([externalId])
  @@map("records")
}

model Credential {
  id    String   @id @default(cuid())
  type  String
  value Json
  scope String[]
  connection   Connection @relation(fields: [connectionId], references: [id], onDelete: Cascade)
  connectionId String          @unique
  @@map("credentials")
}

model Connection {
  id     String   @id @default(cuid())
  name   String
  issues String[] @default([])
  syncConfig Json?
  referenceId String
  createdAt  DateTime  @default(now())
  updatedAt  DateTime? @updatedAt
  
  lastSyncAt DateTime?
  credential Credential?
  subscriptionId String?
  entities Entity[]
  @@unique([referenceId, name])
  @@index([subscriptionId])
  @@map("connections")
}

model Entity {
    id          String     @id @default(cuid())
    type        String
    properties  Property[]
    records     Record[]
    
    createdAt   DateTime   @default(now())
    updatedAt   DateTime?  @default(now())
    createdBy   String
   
    connection   Connection @relation(fields: [connectionId], references: [id])
    connectionId String
    lastSyncId         String?
    @@unique([connectionId, type])
    @@map("entity")
}
`;

function main() {
  const schema = `
        datasource db {
            provider = "postgresql"
            url       = env("DB_URL")
        }
        generator client {
            provider = "prisma-client-js"
            output = "../../node_modules/@prisma-app/client"
          }
        ${tmpl}
    `;

  writeFileSync(__dirname + '/schema.prisma', schema);
}

main();
