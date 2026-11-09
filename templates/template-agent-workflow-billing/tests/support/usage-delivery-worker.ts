import { PolarBillingProvider } from '../../src/billing/providers/polar.js';

const options = JSON.parse(process.argv[2]);
const provider = await PolarBillingProvider.open({
  ...options,
  token: 'loopback-test-token',
  contact: async () => ({ email: 'trusted@example.test' }),
});
try {
  if (options.kind === 'checkout') await provider.createCheckout(options.request);
  else await provider.reportUsage(options.event);
} finally {
  provider.close();
}
