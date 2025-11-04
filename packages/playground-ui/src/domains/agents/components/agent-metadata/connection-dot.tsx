interface ConnectionDotProps {
  connected: boolean;
  size?: 'sm' | 'md';
}

export const ConnectionDot = ({ connected, size = 'sm' }: ConnectionDotProps) => {
  const sizeClasses = size === 'sm' ? 'w-2 h-2' : 'w-3 h-3';

  return (
    <div
      className={`${sizeClasses} rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}
      title={connected ? 'Connected' : 'Not connected'}
    />
  );
};
