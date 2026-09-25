/** Public, non-customer inputs approved for hermetic integration adapter tests. */
export const integrationPublicIps = Object.freeze({
  googleDns: '8.8.8.8',
  ipv4: '31.251.149.240',
  ipv6: '2001:1900:2100:280e::f0',
  bogon: '235.167.17.62',
});

export const integrationApprovalContext = Object.freeze({
  approvalId: 'approval_1',
  fenceToken: 'fence_1',
  deadline: '2030-08-29T00:00:00.000Z',
});

export const stagingIpinfoEnvironment = Object.freeze({
  IPINFO_PROVIDER_ENABLED: 'true',
  IPINFO_TOKEN: 'fake-ipinfo-token',
  GEOIP_CACHE_HMAC_KEY: 'base64:AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=',
  GEOIP_CACHE_HMAC_KEY_VERSION: 'hmac-sha256-v1',
});
