import { describe, expect, it } from 'vitest';
import { createEditorScenarioMastra } from './editor-scenario-utils';

describe('Editor E2E scenario: favorites persistence', () => {
  it('persists favorite state and returns the exact favorited IDs used by Studio filtered lists', async () => {
    // USER STORY: A Studio user stars agents and then filters the library to just starred agents.
    // ARRANGE: Create two stored agents and favorite only one for a specific user.
    const { editor } = createEditorScenarioMastra();
    await editor.agent.create({
      id: 'favorite-agent',
      name: 'Favorite Agent',
      instructions: 'Favorite me.',
      model: { provider: 'mock', name: 'editor-scenario' },
    });
    await editor.agent.create({
      id: 'plain-agent',
      name: 'Plain Agent',
      instructions: 'Do not favorite me.',
      model: { provider: 'mock', name: 'editor-scenario' },
    });

    // ACT: Star one entity, then read back single, batch, and list favorite state.
    await editor.favorites.favorite({ userId: 'user-1', entityType: 'agent', entityId: 'favorite-agent' });
    const favorite = await editor.favorites.isFavorited({
      userId: 'user-1',
      entityType: 'agent',
      entityId: 'favorite-agent',
    });
    const batch = await editor.favorites.isFavoritedBatch({
      userId: 'user-1',
      entityType: 'agent',
      entityIds: ['favorite-agent', 'plain-agent'],
    });
    const favoritedIds = await editor.favorites.listFavoritedIds({ userId: 'user-1', entityType: 'agent' });

    // ASSERT: All favorite read paths agree on the persisted state.
    expect(favorite).toBe(true);
    expect(batch).toEqual(new Set(['favorite-agent']));
    expect(favoritedIds).toEqual(['favorite-agent']);
  });
});
