type InnerNavProps = {
  children: React.ReactNode;
};

export function InnerNav({ children }: InnerNavProps) {
  return <div className="flex border-b border-gray-600 text-sm w-full">{children}</div>;
}
