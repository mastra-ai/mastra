-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('LONG_TEXT', 'SINGLE_LINE_TEXT', 'SINGLE_SELECT', 'MULTI_SELECT', 'CHECKBOX', 'DATE', 'USER', 'BADGE_LIST', 'CURRENCY', 'URL', 'PHONE', 'CONTACT', 'COMPANY', 'PERSON', 'ENRICHMENT', 'COMPOSITE');

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "RecordEnrichmentStatus" AS ENUM ('PENDING', 'APPLIED', 'UNAPPLIED', 'FAILED');

-- CreateTable
CREATE TABLE "properties" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "description" TEXT,
    "type" "PropertyType" NOT NULL,
    "order" INTEGER NOT NULL,
    "modifiable" BOOLEAN NOT NULL DEFAULT true,
    "parentId" TEXT,
    "entityId" TEXT,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "records" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "enrichmentStatus" "RecordEnrichmentStatus" NOT NULL DEFAULT 'UNAPPLIED',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credentials" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "scope" TEXT[],
    "connectionId" TEXT NOT NULL,

    CONSTRAINT "credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connections" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issues" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "syncConfig" JSONB,
    "referenceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "subscriptionId" TEXT,

    CONSTRAINT "connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entity" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "lastSyncId" TEXT,

    CONSTRAINT "entity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "records_externalId_idx" ON "records"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "credentials_connectionId_key" ON "credentials"("connectionId");

-- CreateIndex
CREATE INDEX "connections_subscriptionId_idx" ON "connections"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "connections_referenceId_name_key" ON "connections"("referenceId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "entity_connectionId_type_key" ON "entity"("connectionId", "type");

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "properties"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "records" ADD CONSTRAINT "records_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "entity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity" ADD CONSTRAINT "entity_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
