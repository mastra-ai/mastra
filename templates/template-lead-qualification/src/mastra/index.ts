import { Mastra } from '@mastra/core/mastra';
import { createApplicationRuntime } from './application';

const application = await createApplicationRuntime();
export const mastra = new Mastra(application.mastraConfig);

// The standard Mastra server owns HTTP serving; this module owns the embedded stores.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void application.close(mastra).then(
      () => process.exit(0),
      () => {
        console.error('Lead intake shutdown failed. Accepted work remains recoverable on restart.');
        process.exit(1);
      },
    );
  });
}
