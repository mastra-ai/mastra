import Link from "next/link";

export const CustomButton = ({
  text = "Get started",
  href = "/docs",
  isExternal = false,
}: {
  text: string;
  href?: string;
  isExternal: boolean;
}) => {
  if (isExternal) {
    return (
      <a
        href={href}
        className="!bg-white rounded-md hover:opacity-90 w-full py-[0.56rem] lg:w-auto justify-center group flex h-[2.125rem] items-center gap-1 px-4 lg:py-2 font-semibold text-[0.9rem] text-black"
      >
        {text}
      </a>
    );
  }
  return (
    <Link
      href={href}
      className="!bg-white rounded-md hover:opacity-90 w-full py-[0.56rem] lg:w-auto justify-center group flex h-[2.125rem] items-center gap-1 px-4 lg:py-2 font-semibold text-[0.9rem] text-black"
    >
      <span> {text}</span>
    </Link>
  );
};
