type TagProps = {
  children: React.ReactNode;
  text?: "new" | "experimental" | "advanced" | "realtime";
  showAbbr?: boolean;
};

export const Tag = ({ children, text = "new", showAbbr = false }: TagProps) => {
  const tags = [
    {
      name: "new",
      abbr: "new",
      color: {
        bg: "bg-[hsla(var(--tag-green),0.06)]",
        text: "text-[hsla(var(--tag-green),1)]",
      },
    },
    {
      name: "experimental",
      abbr: "exp.",
      color: {
        bg: "bg-[hsla(var(--tag-purple),0.06)]",
        text: "text-[hsla(var(--tag-purple),1)]",
      },
    },
    {
      name: "realtime",
      abbr: "RT",
      color: {
        bg: "bg-[hsla(var(--tag-green),0.06)]",
        text: "text-[hsla(var(--tag-green),1)]",
      },
    },
    {
      name: "advanced",
      abbr: "adv.",
      color: {
        bg: "bg-[hsla(var(--tag-blue),0.06)]",
        text: "text-[hsla(var(--tag-blue),1)]",
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
