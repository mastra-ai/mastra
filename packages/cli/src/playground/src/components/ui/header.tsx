export const Header = ({
  title,
  rightElement,
  children,
}: {
  title: string | React.ReactNode;
  rightElement?: React.ReactNode;
  children?: React.ReactNode;
}) => {
  return (
    <header className="sticky top-0 z-50">
      <div className="flex h-[var(--top-bar-height)] w-full content-center items-center justify-between border-b-[0.1px] border-mastra-border-1 px-[1.31rem]">
        <div className="flex items-center gap-2">
          <h1 className="font-medium text-sm font-mono">{title}</h1>
          {children}
          <div className="ml-auto">{rightElement}</div>
        </div>
      </div>
    </header>
  );
};
