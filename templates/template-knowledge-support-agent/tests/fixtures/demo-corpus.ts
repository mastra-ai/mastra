/** Retrieval expectations are independent of the scripted model's answer selection. */
export const demoCorpus = {
  version: '2026-11-20.1',
  queries: [
    { query: 'Wi-Fi intended network adjacent device', expected: 'docs:retailops#guides/network' },
    { query: 'payment entry diagnostic report', expected: 'docs:retailops#guides/payments' },
    { query: 'printer USB Bluetooth Ethernet', expected: 'docs:retailops#guides/printer' },
    { query: 'pending payments factory reset', expected: 'tenant:retailops#policies/safe-changes' },
  ],
  alternate: { query: '401 WWW-Authenticate challenge', expected: 'docs:software#guides/request-check' },
  sources: [
    'https://squareup.com/help/us/en/article/8350-troubleshoot-network-connection-on-square-terminal',
    'https://squareup.com/help/us/en/article/8351-troubleshoot-payment-errors-on-square-terminal',
    'https://squareup.com/help/us/en/article/5515-printer-troubleshooting',
    'https://www.rfc-editor.org/rfc/rfc9110.html#name-401-unauthorized',
  ],
} as const;
