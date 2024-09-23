import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { el } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function minutesSincePRDate(
  prs: any[],
  date_compare: keyof (typeof prs)[number],
  comparison_operator: string = 'greater',
) {
  const lastDate = prs.reduce(
    (acc: number, pr) => {
      const prDate = new Date(pr[date_compare]).getTime();

      if (comparison_operator === 'greater') {
        return prDate > acc ? prDate : acc;
      } else if (comparison_operator === 'less') {
        return prDate < acc ? prDate : acc;
      }
    },
    comparison_operator === 'less' ? Infinity : 0,
  );

  // Calculate the minutes since the last PR was opened
  return Math.floor((new Date().getTime() - lastDate) / 60000);
}
