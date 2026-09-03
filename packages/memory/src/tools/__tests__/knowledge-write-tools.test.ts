import { describe, expect, it } from 'vitest';

import * as subconscious from '../../processors/observational-memory/subconscious';

describe('legacy subconscious knowledge write tools', () => {
  it('does not expose the pre-v2 raw-storage tool factory', () => {
    expect(subconscious).not.toHaveProperty('createKnowledgeWriteTools');
  });

  it('does not expose legacy write-capable tool names through the v2 learner', () => {
    const legacyToolNames = [
      'knowledge_create',
      'knowledge_append',
      'knowledge_remove',
      'knowledge_update_node',
      'knowledge_rename_node',
      'knowledge_set_node_kind',
      'knowledge_write_node_content',
      'knowledge_write_node_description',
      'knowledge_record_skill',
    ];

    for (const name of legacyToolNames) expect(subconscious).not.toHaveProperty(name);
  });
});
