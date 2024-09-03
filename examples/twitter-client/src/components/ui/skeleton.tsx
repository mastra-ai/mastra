import React from 'react';

export const Skeleton: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => {
  return (
    <div className={`animate-pulse rounded-sm bg-slate-800 ${className || ''}`} {...props}>
      <span className="sr-only">Loading...</span>
    </div>
  );
};
