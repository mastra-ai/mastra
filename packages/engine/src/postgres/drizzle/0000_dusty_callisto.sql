CREATE TYPE "public"."PropertyType" AS ENUM('LONG_TEXT', 'SINGLE_LINE_TEXT', 'SINGLE_SELECT', 'MULTI_SELECT', 'CHECKBOX', 'DATE', 'USER', 'BADGE_LIST', 'CURRENCY', 'URL', 'PHONE', 'CONTACT', 'COMPANY', 'PERSON', 'ENRICHMENT', 'COMPOSITE', 'BOOLEAN', 'NUMBER', 'FLOAT', 'JSON_OBJECT', 'JSON_ARRAY');--> statement-breakpoint
CREATE TYPE "public"."RecordStatus" AS ENUM('ACTIVE', 'ARCHIVED');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "connections" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"issues" text[] DEFAULT '{}'::text[] NOT NULL,
	"syncConfig" jsonb DEFAULT '{}'::jsonb,
	"connectionId" varchar NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp,
	"lastSyncAt" timestamp,
	"subscriptionId" text,
	CONSTRAINT "connectionNameUnique" UNIQUE("connectionId","name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credentials" (
	"id" text PRIMARY KEY NOT NULL,
	"type" varchar NOT NULL,
	"value" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"scope" text[] DEFAULT '{}'::text[] NOT NULL,
	"kId" text,
	CONSTRAINT "credentials_kId_unique" UNIQUE("kId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "entity" (
	"id" text PRIMARY KEY NOT NULL,
	"type" varchar NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now(),
	"createdBy" varchar NOT NULL,
	"kId" text,
	"lastSyncId" text,
	CONSTRAINT "entities_k_id_unique" UNIQUE("kId","type")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "properties" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"displayName" varchar NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb,
	"description" text,
	"type" "PropertyType" NOT NULL,
	"order" integer NOT NULL,
	"modifiable" boolean DEFAULT true NOT NULL,
	"parentId" text,
	"entityId" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "records" (
	"id" text PRIMARY KEY NOT NULL,
	"externalId" text,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"source" varchar DEFAULT 'MANUAL' NOT NULL,
	"entityType" varchar NOT NULL,
	"entityId" text,
	"status" "RecordStatus" DEFAULT 'ACTIVE' NOT NULL,
	"deletedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credentials" ADD CONSTRAINT "credentials_kId_connections_id_fk" FOREIGN KEY ("kId") REFERENCES "public"."connections"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "entity" ADD CONSTRAINT "entity_kId_connections_id_fk" FOREIGN KEY ("kId") REFERENCES "public"."connections"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "properties" ADD CONSTRAINT "properties_parentId_properties_id_fk" FOREIGN KEY ("parentId") REFERENCES "public"."properties"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "properties" ADD CONSTRAINT "properties_entityId_entity_id_fk" FOREIGN KEY ("entityId") REFERENCES "public"."entity"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "records" ADD CONSTRAINT "records_entityId_entity_id_fk" FOREIGN KEY ("entityId") REFERENCES "public"."entity"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "subscriptionIdIdx" ON "connections" USING btree ("subscriptionId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "records_external_id_idx" ON "records" USING btree ("externalId");