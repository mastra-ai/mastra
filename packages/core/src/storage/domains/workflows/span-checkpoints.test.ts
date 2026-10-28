import { createWorkflowSpanCheckpointTests } from '../../../../../../stores/_test-utils/src/domains/workflows/span-checkpoints';
import { InMemoryStore } from '../../mock';

createWorkflowSpanCheckpointTests(async () => new InMemoryStore());
