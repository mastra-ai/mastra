const modeColorClasses: Record<string, { text: string; spotlight: string }> = {
  build: {
    text: 'text-[#087a32] dark:text-[#4ade80]',
    spotlight: '[--composer-spotlight:#087a32] dark:[--composer-spotlight:#4ade80]',
  },
  plan: {
    text: 'text-[#6d28d9] dark:text-[#c4b5fd]',
    spotlight: '[--composer-spotlight:#6d28d9] dark:[--composer-spotlight:#c4b5fd]',
  },
  fast: {
    text: 'text-[#8a4400] dark:text-[#fdba74]',
    spotlight: '[--composer-spotlight:#8a4400] dark:[--composer-spotlight:#fdba74]',
  },
};

export function getModeTextColorClass(modeId: string | undefined): string | undefined {
  return modeId ? modeColorClasses[modeId.toLowerCase()]?.text : undefined;
}

export function getModeSpotlightColorClass(modeId: string | undefined): string | undefined {
  return modeId ? modeColorClasses[modeId.toLowerCase()]?.spotlight : undefined;
}
