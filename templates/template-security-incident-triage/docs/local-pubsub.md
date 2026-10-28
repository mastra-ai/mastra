# Local PubSub and customer driver contract

The default `InProcessDomainPubSub` implements Mastra's native `PubSub` interface in **push** mode. No Redis, local server or paid broker is required. Operational outbox and consumer/effect ledgers remain durable in LibSQL; the transport itself is single-process and in-memory.

## Delivery semantics

- `security.alert.received` is a required workflow-start command. With no local consumer, publication rejects and the dispatcher retains/retries the outbox row. Unused informational topics may complete without subscribers.
- Each ungrouped subscriber receives a copy. Within each named consumer group, one subscriber receives the event (local round-robin).
- A subscriber must explicitly `await ack()` **after committing its durable effect**. Returning without ACK rejects publication; this includes the worker's busy-lease path. An exception also rejects.
- NACK redelivers the same envelope, transport ID and creation timestamp with an incremented delivery attempt. First ACK/NACK wins. Default: three attempts and a 10 ms cooperative delay; constructor overrides accept 1–10 attempts and 1–1000 ms delay. Exhaustion rejects; durable retries/dead-letter remain the dispatcher's responsibility.
- A new outbox publication may receive a new transport ID. `data.eventId`, scoped by tenant and consumer group, remains the authoritative identity. Never deduplicate solely by transport ID.
- `publish()` drains all selected callbacks before returning an error, so a failed fanout member cannot leave untracked local writes. `flush()` waits for active publications and is best-effort, not proof of success.
- `close()` rejects new work, interrupts retry delays, and waits for active callbacks. It never invents an ACK. Shutdown is **cooperative**: callbacks must be bounded and cannot wait for their own transport to close; an endlessly blocked callback cannot be forcibly canceled by this driver.

Repeated publication can redeliver to subscribers that already ACKed a prior failed fanout. Consumers must therefore be idempotent. Transport retries and durable outbox retries have separate budgets; avoid large multiplicative retry configurations.

## Replacing the driver

Implement the installed `@mastra/core/events` `PubSub` contract and inject it through `startServerRuntime({ domainEventPubSub })`. Do not create another EventBus wrapper. Keep domain delivery separate from Mastra's internal orchestration transport. Runtime owns and closes an injected domain transport when it differs from `mastra.pubsub`; a driver can expose `close(): Promise<void>` for cleanup.

Customer responsibilities:

1. Preserve type, run ID, tenant/incident, durable event ID, schema version, correlation and causation IDs, occurrence time, and payload. Messages carry references and metadata, not raw evidence or secrets.
2. Provide at-least-once delivery with explicit ACK/NACK, consumer-group isolation, bounded retries, and a recovery/dead-letter policy. ACK only after durable acceptance/effect; network success alone is not domain completion.
3. Keep publication rejection meaningful. A **durable external broker** may accept a command before consumers exist because it retains it; the in-memory driver must reject that situation to avoid losing it. Do not impose the local no-consumer rule on a genuinely durable broker.
4. Retain LibSQL outbox, envelope binding, tenant-scoped consumer ledger, lease/fencing and containment idempotency. Broker delivery never authorizes containment.
5. Implement compatible shutdown/flush ownership and document multi-process retention, replay, connection, timeout and credential requirements. No production broker driver is bundled or externally validated here.

Reusable baseline: `tests/contract/domain-pubsub-contract.ts` exports `defineDomainPubSubContract(name, factory)` for a fresh isolated namespace. It verifies NACK identity, envelope preservation, fanout, groups and unsubscribe. Customer drivers additionally need their broker-specific durability/restart, lease, poison-message and network-failure tests. Local-only negative behavior is covered by `in-process-domain-pubsub.test.ts`; durable outbox/worker behavior by integration tests.

```bash
npm test -- tests/contract/local-domain-pubsub.test.ts tests/unit/in-process-domain-pubsub.test.ts tests/integration/local-pubsub-outbox.test.ts
```
