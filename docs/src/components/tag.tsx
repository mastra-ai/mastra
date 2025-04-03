//blue
//green
//yellow

export const Tag = ({
  children,
  text = "new",
}: {
  children: React.ReactNode;
  text?: string;
}) => {
  return (
    <span className="flex items-center gap-[0.62rem]">
      {children}{" "}
      <span className="m-tag text-[hsla(143,97%,54%,1)] shrink-0 bg-[hsla(143,97%,54%,0.06)] px-2 pr-[0.44rem] py-0.5 rounded-md">
        {text}
      </span>
    </span>
  );
};
