import type { DatabaseSync } from "node:sqlite";

export function createSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE dataset_metadata (id INTEGER PRIMARY KEY CHECK(id = 1), json TEXT NOT NULL) STRICT;
    CREATE TABLE months (start TEXT PRIMARY KEY, end TEXT NOT NULL CHECK(start < end)) STRICT;
    CREATE TABLE representatives (id INTEGER PRIMARY KEY, name TEXT NOT NULL) STRICT;
    CREATE TABLE accounts (id INTEGER PRIMARY KEY, name TEXT NOT NULL, region TEXT NOT NULL) STRICT;
    CREATE TABLE opportunities (
      id INTEGER PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES accounts(id), created_at TEXT NOT NULL
    ) STRICT;
    CREATE TABLE opportunity_history (
      opportunity_id INTEGER NOT NULL REFERENCES opportunities(id), effective_at TEXT NOT NULL,
      stage TEXT NOT NULL CHECK(stage IN ('qualification','discovery','proposal','negotiation','won','lost')),
      value_cents INTEGER NOT NULL CHECK(value_cents BETWEEN 0 AND 9007199254740991), expected_close TEXT NOT NULL,
      owner_id INTEGER NOT NULL REFERENCES representatives(id), segment TEXT NOT NULL,
      PRIMARY KEY(opportunity_id, effective_at)
    ) STRICT;
    CREATE TABLE subscriptions (id INTEGER PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES accounts(id)) STRICT;
    CREATE TABLE subscription_history (
      subscription_id INTEGER NOT NULL REFERENCES subscriptions(id), effective_at TEXT NOT NULL,
      mrr_cents INTEGER NOT NULL CHECK(mrr_cents BETWEEN 0 AND 9007199254740991), PRIMARY KEY(subscription_id, effective_at)
    ) STRICT;
    CREATE INDEX opportunity_history_date ON opportunity_history(effective_at);
    CREATE INDEX subscription_history_date ON subscription_history(effective_at);
    CREATE TRIGGER opportunity_chronology BEFORE INSERT ON opportunity_history
    WHEN NEW.effective_at < (SELECT created_at FROM opportunities WHERE id=NEW.opportunity_id)
    BEGIN SELECT RAISE(ABORT, 'History precedes opportunity creation'); END;
    CREATE TRIGGER opportunity_terminal BEFORE INSERT ON opportunity_history
    WHEN EXISTS (SELECT 1 FROM opportunity_history WHERE opportunity_id=NEW.opportunity_id
      AND stage IN ('won','lost'))
    BEGIN SELECT RAISE(ABORT, 'Closed opportunities cannot transition again'); END;
  `);
}
