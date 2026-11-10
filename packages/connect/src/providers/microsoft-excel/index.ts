// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import type { ProviderRegistration } from '../../registry.js';
import { createMicrosoftExcelTools } from './tools.js';

export const microsoftExcelProvider: ProviderRegistration = {
  integrationId: 'microsoft-excel',
  envVar: 'MASTRA_MICROSOFT_EXCEL_CONNECTION_ID',
  createTools: createMicrosoftExcelTools,
};

export { createMicrosoftExcelTools };
