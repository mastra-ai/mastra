const modeColorClasses: Record<string, { text: string; border: string }> = {
  build: {
    text: 'text-[#087a32] dark:text-[#4ade80]',
    border:
      'border-[#087a32]/60 focus-within:border-[#087a32] dark:border-[#4ade80]/60 dark:focus-within:border-[#4ade80]',
  },
  plan: {
    text: 'text-[#6d28d9] dark:text-[#c4b5fd]',
    border:
      'border-[#6d28d9]/60 focus-within:border-[#6d28d9] dark:border-[#c4b5fd]/60 dark:focus-within:border-[#c4b5fd]',
  },
  fast: {
    text: 'text-[#8a4400] dark:text-[#fdba74]',
    border:
      'border-[#8a4400]/60 focus-within:border-[#8a4400] dark:border-[#fdba74]/60 dark:focus-within:border-[#fdba74]',
  },
};

export function getModeTextColorClass(modeId: string | undefined): string | undefined {
  return modeId ? modeColorClasses[modeId.toLowerCase()]?.text : undefined;
}

export function getModeBorderColorClass(modeId: string | undefined): string | undefined {
  return modeId ? modeColorClasses[modeId.toLowerCase()]?.border : undefined;
}
