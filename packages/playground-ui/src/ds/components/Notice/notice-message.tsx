export interface NoticeMessageProps {
  children: React.ReactNode;
  className?: string;
}

export function NoticeMessage({ children, className }: NoticeMessageProps) {
  return <div className={className}>{children}</div>;
}
