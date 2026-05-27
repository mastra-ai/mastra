import { describe, expect, beforeEach, it, vi } from 'vitest';
import { MastraClient } from '../client';

// Mock fetch globally
global.fetch = vi.fn();

describe('StoredSkill Resource', () => {
  let client: MastraClient;
  const clientOptions = {
    baseUrl: 'http://localhost:4111',
    headers: {
      Authorization: 'Bearer test-key',
      'x-mastra-client-type': 'js',
    },
  };

  // Helper to mock successful API responses
  const mockFetchResponse = (data: any) => {
    const response = new Response(undefined, {
      status: 200,
      statusText: 'OK',
      headers: new Headers({
        'Content-Type': 'application/json',
      }),
    });
    response.json = () => Promise.resolve(data);
    (global.fetch as any).mockResolvedValueOnce(response);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    client = new MastraClient(clientOptions);
  });

  describe('Favorites', () => {
    const storedSkillId = 'skill-1';

    it('should favorite the skill via PUT /favorite', async () => {
      const mockResponse = { favorited: true, favoriteCount: 3 };
      mockFetchResponse(mockResponse);

      const storedSkill = client.getStoredSkill(storedSkillId);
      const result = await storedSkill.favorite();
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/stored/skills/${storedSkillId}/favorite`,
        expect.objectContaining({
          method: 'PUT',
        }),
      );
    });

    it('should unfavorite the skill via DELETE /favorite', async () => {
      const mockResponse = { favorited: false, favoriteCount: 2 };
      mockFetchResponse(mockResponse);

      const storedSkill = client.getStoredSkill(storedSkillId);
      const result = await storedSkill.unfavorite();
      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/stored/skills/${storedSkillId}/favorite`,
        expect.objectContaining({
          method: 'DELETE',
        }),
      );
    });

    it('should encode special characters in skill id when favoriting', async () => {
      const specialId = 'skill/with/slashes';
      const encodedId = encodeURIComponent(specialId);
      mockFetchResponse({ favorited: true, favoriteCount: 1 });

      await client.getStoredSkill(specialId).favorite();
      expect(global.fetch).toHaveBeenCalledWith(
        `${clientOptions.baseUrl}/api/stored/skills/${encodedId}/favorite`,
        expect.objectContaining({ method: 'PUT' }),
      );
    });
  });
});
