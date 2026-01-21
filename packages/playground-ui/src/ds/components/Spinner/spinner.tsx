import { cn } from '@/lib/utils';

export type SpinnerProps = {
  color?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
};

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
};

function Spinner({ color, className, size = 'md' }: SpinnerProps) {
  return (
    <svg
      className={cn('animate-spin', sizeClasses[size], className)}
      style={{ animationDuration: '800ms', animationTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)' }}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" stroke={color || 'currentColor'} className="text-accent1" />
    </svg>
  );
}

export { Spinner };
