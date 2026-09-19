import { MastraStorageExporter, Observability, SensitiveDataFilter } from '@mastra/observability';

import { KycDomainPiiSanitizer } from './pii-sanitizer.js';

export const kycObservabilityConfigName = 'kyc-local';

export const createKycObservability = (): Observability =>
  new Observability({
    configs: {
      [kycObservabilityConfigName]: {
        serviceName: 'mastra-kyc',
        exporters: [
          new MastraStorageExporter({
            maxBatchSize: 50,
            maxBufferSize: 500,
            maxBatchWaitMs: 250,
          }),
        ],
        spanOutputProcessors: [new KycDomainPiiSanitizer(), new SensitiveDataFilter()],
        includeInternalSpans: false,
        requestContextKeys: [],
        serializationOptions: {
          maxStringLength: 512,
          maxDepth: 8,
          maxArrayLength: 50,
          maxObjectKeys: 50,
        },
        cardinality: {
          blockedLabels: ['tenantId', 'caseId', 'personId', 'documentId', 'workflowRunId', 'traceId', 'spanId'],
          blockUUIDs: true,
        },
        logging: { enabled: true, level: 'warn' },
      },
    },
    sensitiveDataFilter: false,
  });
