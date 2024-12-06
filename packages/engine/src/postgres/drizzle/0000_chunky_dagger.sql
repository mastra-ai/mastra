CREATE SCHEMA "mastra";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mastra"."entity" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now(),
	"connectionId" text NOT NULL,
	"lastSyncId" text,
	CONSTRAINT "entities_connection_id_unique" UNIQUE("connectionId","name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mastra"."records" (
	"id" text PRIMARY KEY NOT NULL,
	"externalId" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"entityType" varchar NOT NULL,
	"entityId" text NOT NULL,
	"deletedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mastra"."records" ADD CONSTRAINT "records_entityId_entity_id_fk" FOREIGN KEY ("entityId") REFERENCES "mastra"."entity"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "records_external_id_idx" ON "mastra"."records" USING btree ("externalId");