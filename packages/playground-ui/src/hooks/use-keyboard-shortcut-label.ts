import { useState } from 'react';

type NavigatorWithUserAgentData = Navigator & {
  userAgentData?: {
    platform?: string;
  };
};

const APPLE_PLATFORM_PATTERN = /mac|iphone|ipad|ipod/i;

function getIsApplePlatform() {
  if (typeof navigator === 'undefined') return false;

  const nav = navigator as NavigatorWithUserAgentData;
  const platform = nav.userAgentData?.platform || nav.platform || '';
  const userAgent = nav.userAgent || '';

  return APPLE_PLATFORM_PATTERN.test(platform) || APPLE_PLATFORM_PATTERN.test(userAgent);
}

export function useIsApplePlatform() {
  const [isApplePlatform] = useState(getIsApplePlatform);

  return isApplePlatform;
}

export const keyboardShortcutLabel = (key: string, isApplePlatform: boolean) =>
  `${isApplePlatform ? '⌘' : 'Ctrl'} ${key.trim().toUpperCase()}`;

export function useKeyboardShortcutLabel(key: string) {
  return keyboardShortcutLabel(key, useIsApplePlatform());
}
