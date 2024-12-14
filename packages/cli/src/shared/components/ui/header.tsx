export const Header = ({ title }: { title: string }) => {
  return (
    <header className="sticky top-0 z-50">
      <div className=" flex items-center justify-between w-full h-12 px-4 border-b bg-background">
        <div className="flex items-center gap-2">
          <h1 className="font-medium text-sm font-mono">{title}</h1>
        </div>
      </div>
    </header>
  );
};
