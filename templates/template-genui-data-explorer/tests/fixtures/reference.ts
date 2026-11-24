import { DatabaseSync } from "node:sqlite";
import { createMetadata } from "../../scripts/generate.ts";
import { createSchema } from "../../scripts/schema.ts";

// Hand-authored facts, unrelated to the demo generator or analytical SQL.
export function referenceFixture(path: string = ":memory:") {
  const metadata = createMetadata(new Date("2026-10-04T12:00:00Z"), 7);
  const db = new DatabaseSync(path);
  createSchema(db);
  db.prepare("INSERT INTO dataset_metadata VALUES (1, ?)").run(JSON.stringify(metadata));
  const month = db.prepare("INSERT INTO months VALUES (?, ?)");
  for (let index = 0; index < 24; index++) {
    const start = new Date(Date.UTC(2024, 9 + index, 1)).toISOString().slice(0, 10);
    const end = new Date(Date.UTC(2024, 10 + index, 1)).toISOString().slice(0, 10);
    month.run(start, end);
  }
  db.exec(`
    INSERT INTO representatives VALUES (1,'Alex'),(2,'Sam');
    INSERT INTO accounts VALUES (1,'A','Americas'),(2,'B','EMEA'),(3,'C','APAC'),(4,'D','EMEA');
    INSERT INTO opportunities VALUES (1,1,'2025-01-01'),(2,2,'2025-01-01'),(3,3,'2025-01-01'),
      (4,1,'2026-01-01'),(5,2,'2026-01-01');
    INSERT INTO opportunity_history VALUES
      (1,'2025-01-01','qualification',10000,'2025-03-01',1,'SMB'),
      (1,'2025-02-01','proposal',12000,'2025-03-15',1,'SMB'),
      (1,'2025-03-01','won',12000,'2025-03-15',1,'SMB'),
      (2,'2025-01-01','discovery',20000,'2025-03-10',1,'SMB'),
      (2,'2025-02-15','negotiation',30000,'2025-04-10',2,'Enterprise'),
      (2,'2025-03-15','lost',30000,'2025-04-10',2,'Enterprise'),
      (3,'2025-01-01','proposal',40000,'2025-03-20',2,'Enterprise'),
      (4,'2026-01-01','proposal',24000,'2026-03-20',1,'SMB'),
      (4,'2026-03-01','won',24000,'2026-03-20',1,'SMB'),
      (5,'2026-01-01','discovery',5000,'2026-03-20',2,'Enterprise');
    INSERT INTO subscriptions VALUES (1,1),(2,1),(3,2),(4,3),(5,4);
    INSERT INTO subscription_history VALUES
      (1,'2024-09-01',6000),(2,'2024-09-01',4000),(3,'2024-09-01',20000),
      (5,'2024-09-01',10000),
      (1,'2025-01-01',0),
      (5,'2025-01-03',15000),(5,'2025-01-04',3000),
      (2,'2025-01-05',0),(3,'2025-01-08',10000),
      (1,'2025-01-10',6000),(1,'2025-01-15',0),
      (4,'2025-01-02',50000),(4,'2025-01-20',0),
      (3,'2025-02-01',0);
  `);
  return { db, metadata };
}

/** Fixed subscription lifecycles for first-activation cohort expectations. */
export function cohortFixture(path: string = ":memory:") {
  const fixture = referenceFixture(path);
  fixture.db.exec(`
    DELETE FROM subscription_history;
    DELETE FROM subscriptions;
    INSERT INTO accounts VALUES (5,'E','Americas'),(6,'F','EMEA'),(7,'G','APAC'),(8,'H','EMEA');
    INSERT INTO subscriptions VALUES (1,1),(2,1),(3,2),(4,3),(5,4),(6,5),(7,6),(8,7),(9,8);
    INSERT INTO subscription_history VALUES
      (1,'2024-12-01',0),(1,'2025-01-10',6000),(2,'2025-01-10',4000),
      (1,'2025-02-01',0),(2,'2025-02-01',10000),
      (2,'2025-02-10',0),(1,'2025-02-15',7000),
      (3,'2025-01-20',5000),
      (4,'2025-01-02',50000),(4,'2025-01-20',0),(4,'2025-02-05',50000),
      (5,'2025-02-02',9000),(5,'2025-03-01',0),(5,'2025-03-20',9000),
      (6,'2025-03-01',10000),(6,'2025-04-01',0),
      (7,'2024-12-01',10000),(7,'2025-01-05',0),(7,'2025-02-01',10000),
      (8,'2025-01-05',0),(9,'2025-04-01',5000);
  `);
  return fixture;
}
