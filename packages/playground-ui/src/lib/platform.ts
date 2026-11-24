export const isMacPlatform = () =>
  typeof navigator !== 'undefined' && /mac/i.test(navigator.platform || navigator.userAgent || '');
