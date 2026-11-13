import { describe, expect, it } from 'vitest';
import type { FactoryIntegration } from './base.js';
import { describeIntegrations } from './startup-summary.js';

function integration(id: string, connected?: boolean | Error): FactoryIntegration {
  if (connected === undefined) return { id };
  return {
    id,
    hasActiveConnections: async () => {
      if (connected instanceof Error) throw connected;
      return connected;
    },
  };
}

describe('describeIntegrations', () => {
  it('separates connected providers from ones that are only available', async () => {
    await expect(
      describeIntegrations([
        integration('github', true),
        integration('jira', false),
        integration('linear', false),
        integration('incidentio', false),
      ]),
    ).resolves.toBe('Integrations: GitHub connected · Jira, Linear, incident.io available');
  });

  it('says none are connected on a fresh project', async () => {
    await expect(describeIntegrations([integration('github', false), integration('gitlab', false)])).resolves.toBe(
      'Integrations: none connected · GitHub, GitLab available',
    );
  });

  it('reports a failed check as unknown instead of failing', async () => {
    await expect(
      describeIntegrations([integration('github', true), integration('linear', new Error('timeout'))]),
    ).resolves.toBe('Integrations: GitHub connected · Linear status unknown');
  });

  it('prints nothing when no integration can report connections', async () => {
    await expect(describeIntegrations([integration('custom')])).resolves.toBeUndefined();
  });
});
