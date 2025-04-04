//blue
//green
//yellow

export const Tag = ({
  children,
  text = "new",
  showAbbr = false,
}: {
  children: React.ReactNode;
  text?: "new" | "experimental" | "advanced";
  showAbbr?: boolean;
}) => {
  const tags = [
    {
      name: "new",
      abbr: "new",
      color: {
        bg: "bg-[hsla(143,97%,54%,0.06)]",
        text: "text-[hsla(143,97%,54%,1)]",
      },
    },
    {
      name: "experimental",
      abbr: "exp",
      color: {
        bg: "bg-[hsl(187deg,100%,41.6%,0.06)]",
        text: "text-[hsl(187deg,100%,41.6%,1)]",
      },
    },
    {
      name: "advanced",
      abbr: "adv",
      color: {
        bg: "bg-[hsl(231deg,48.4%,47.8%,0.1)]",
        text: "text-[hsl(231deg,48.4%,47.8%,1)]",
      },
    },
  ];
  const tag = tags.find((t) => t.name === text);
  return (
    <span className="flex items-center gap-[0.62rem]">
      {children}
      <span
        className={`m-tag font-medium text-xs shrink-0 px-2 pr-[0.44rem] py-0.5 rounded-md ${
          tag?.color.bg
        } ${tag?.color.text}`}
      >
        {showAbbr ? tag?.abbr : text}
      </span>
    </span>
  );
};
