import { useEffect, useState } from 'react';

export type StepTimerProps = React.HTMLAttributes<HTMLDivElement> & { startTime: number; endedAt?: number };
export const StepTimerClass = 'mastra:text-[10px] mastra:text-text3 mastra:font-mono';

export const StepTimer = ({ className, startTime, endedAt, ...props }: StepTimerProps) => {
  const [time, setTime] = useState(startTime);

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(Date.now());
    }, 100);

    return () => clearInterval(interval);
  }, []);

  const timeDiff = (endedAt ? endedAt - startTime : time - startTime) / 1000;

  return <span className={StepTimerClass}>{Number(timeDiff.toPrecision(3))}s</span>;
};
