// AUTO-GENERATED from arctic-char/integration-templates @ a1e633120274 — do not edit by hand.
import type { ProviderRegistration } from '../../registry.js';
import { createGoogleDriveTools } from './tools.js';

export const googleDriveProvider: ProviderRegistration = {
  integrationId: 'google-drive',
  envVar: 'MASTRA_GOOGLE_DRIVE_CONNECTION_ID',
  createTools: createGoogleDriveTools,
};

export { createGoogleDriveTools };
