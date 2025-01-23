// secrets-manager.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { CloudflareSecretsManager } from './index.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('CloudflareSecretsManager', () => {
  let secretsManager: CloudflareSecretsManager;
  const mockAccountId = 'test-account-id';
  const mockApiToken = 'test-api-token';
  const mockWorkerId = 'test-worker';

  beforeEach(() => {
    secretsManager = new CloudflareSecretsManager({
      accountId: mockAccountId,
      apiToken: mockApiToken,
    });
    vi.resetAllMocks();
  });

  describe('createSecret', () => {
    it('should successfully create a secret', async () => {
      const mockResponse = {
        success: true,
        result: { name: 'TEST_SECRET_123', type: 'secret_text' },
      };

      mockFetch.mockReturnValueOnce(
        Promise.resolve({
          json: () => Promise.resolve(mockResponse),
        } as Response),
      );

      const result = await secretsManager.createSecret({
        workerId: mockWorkerId,
        secretName: 'TEST_SECRET_123',
        secretValue: 'test-value',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.cloudflare.com/client/v4/accounts/${mockAccountId}/workers/scripts/${mockWorkerId}/secrets`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${mockApiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'TEST_SECRET_123',
            text: 'test-value',
          }),
        },
      );

      expect(result).toEqual(mockResponse.result);
    });

    it('should handle API errors for invalid secret names', async () => {
      const mockError = {
        success: false,
        errors: [{ message: 'Invalid secret name' }],
      };

      mockFetch.mockReturnValueOnce(
        Promise.resolve({
          json: () => Promise.resolve(mockError),
        } as Response),
      );

      await expect(
        secretsManager.createSecret({
          workerId: mockWorkerId,
          secretName: 'invalid-name!', // Invalid secret name with special character
          secretValue: 'test-value',
        }),
      ).rejects.toThrowError('Invalid secret name');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        secretsManager.createSecret({
          workerId: mockWorkerId,
          secretName: 'VALID_SECRET_NAME',
          secretValue: 'test-value',
        }),
      ).rejects.toThrowError('Network error');
    });
  });

  describe('createProjectSecrets', () => {
    it('should create project-specific secrets', async () => {
      const mockResponse = {
        success: true,
        result: { name: 'PROJECT_ABC123', type: 'secret_text' },
      };

      mockFetch.mockReturnValueOnce(
        Promise.resolve({
          json: () => Promise.resolve(mockResponse),
        } as Response),
      );

      const envVars = {
        API_KEY: 'test_key',
        DATABASE_URL: 'test_url',
      };

      const result = await secretsManager.createProjectSecrets({
        workerId: mockWorkerId,
        customerId: 'ABC123',
        envVars,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({
            name: 'PROJECT_ABC123',
            text: JSON.stringify(envVars),
          }),
        }),
      );

      expect(result).toEqual(mockResponse.result);
    });
  });

  describe('deleteSecret', () => {
    it('should successfully delete a secret', async () => {
      const mockResponse = {
        success: true,
        result: { id: 'deleted-secret-id' },
      };

      mockFetch.mockReturnValueOnce(
        Promise.resolve({
          json: () => Promise.resolve(mockResponse),
        } as Response),
      );

      const result = await secretsManager.deleteSecret({
        workerId: mockWorkerId,
        secretName: 'TEST_SECRET_123',
      });

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.cloudflare.com/client/v4/accounts/${mockAccountId}/workers/scripts/${mockWorkerId}/secrets/TEST_SECRET_123`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${mockApiToken}`,
          },
        },
      );

      expect(result).toEqual(mockResponse.result);
    });

    it('should handle deletion errors', async () => {
      const mockError = {
        success: false,
        errors: [{ message: 'Secret not found' }],
      };

      mockFetch.mockReturnValueOnce(
        Promise.resolve({
          json: () => Promise.resolve(mockError),
        } as Response),
      );

      await expect(
        secretsManager.deleteSecret({
          workerId: mockWorkerId,
          secretName: 'NONEXISTENT_SECRET',
        }),
      ).rejects.toThrowError('Secret not found');
    });
  });

  describe('listSecrets', () => {
    it('should successfully list all secrets', async () => {
      const mockResponse = {
        success: true,
        result: [
          { name: 'PROJECT_ABC123', type: 'secret_text' },
          { name: 'PROJECT_DEF456', type: 'secret_text' },
        ],
      };

      mockFetch.mockReturnValueOnce(
        Promise.resolve({
          json: () => Promise.resolve(mockResponse),
        } as Response),
      );

      const result = await secretsManager.listSecrets(mockWorkerId);

      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.cloudflare.com/client/v4/accounts/${mockAccountId}/workers/scripts/${mockWorkerId}/secrets`,
        {
          headers: {
            Authorization: `Bearer ${mockApiToken}`,
          },
        },
      );

      expect(result).toEqual(mockResponse.result);
    });

    it('should handle listing errors', async () => {
      const mockError = {
        success: false,
        errors: [{ message: 'Invalid worker ID' }],
      };

      mockFetch.mockReturnValueOnce(
        Promise.resolve({
          json: () => Promise.resolve(mockError),
        } as Response),
      );

      await expect(secretsManager.listSecrets('invalid-worker')).rejects.toThrowError('Invalid worker ID');
    });
  });
});
