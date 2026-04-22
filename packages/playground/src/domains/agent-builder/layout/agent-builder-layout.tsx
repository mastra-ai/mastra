export const AgentBuilderLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="bg-surface1 font-sans h-screen">
      <div className="h-full overflow-y-auto">{children}</div>
    </div>
  );
};
