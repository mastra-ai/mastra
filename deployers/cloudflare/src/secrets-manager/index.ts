export class CloudflareSecretsManager {
  accountId: string;
  apiToken: string;
  baseUrl: string;

  constructor({ accountId, apiToken }: { accountId: string; apiToken: string }) {
    this.accountId = accountId;
    this.apiToken = apiToken;
    this.baseUrl = 'https://api.cloudflare.com/client/v4';
  }

  async createSecret({
    workerId,
    secretName,
    secretValue,
  }: {
    workerId: string;
    secretName: string;
    secretValue: string;
  }) {
    const url = `${this.baseUrl}/accounts/${this.accountId}/workers/scripts/${workerId}/secrets`;

    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: secretName,
          text: secretValue,
        }),
      });

      const data = (await response.json()) as { success: boolean; result: any; errors: any[] };

      if (!data.success) {
        throw new Error(data.errors[0].message);
      }

      return data.result;
    } catch (error) {
      console.error('Failed to create secret:', error);
      throw error;
    }
  }

  async createProjectSecrets({
    workerId,
    customerId,
    envVars,
  }: {
    workerId: string;
    customerId: string;
    envVars: Record<string, string>;
  }) {
    const secretName = `PROJECT_${customerId.toUpperCase()}`;
    const secretValue = JSON.stringify(envVars);

    return this.createSecret({ workerId, secretName, secretValue });
  }

  async deleteSecret({ workerId, secretName }: { workerId: string; secretName: string }) {
    const url = `${this.baseUrl}/accounts/${this.accountId}/workers/scripts/${workerId}/secrets/${secretName}`;

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
        },
      });

      const data = (await response.json()) as { success: boolean; result: any; errors: any[] };

      if (!data.success) {
        throw new Error(data.errors[0].message);
      }

      return data.result;
    } catch (error) {
      console.error('Failed to delete secret:', error);
      throw error;
    }
  }

  async listSecrets(workerId: string) {
    const url = `${this.baseUrl}/accounts/${this.accountId}/workers/scripts/${workerId}/secrets`;

    try {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
        },
      });

      const data = (await response.json()) as { success: boolean; result: any; errors: any[] };

      if (!data.success) {
        throw new Error(data.errors[0].message);
      }

      return data.result;
    } catch (error) {
      console.error('Failed to list secrets:', error);
      throw error;
    }
  }
}
