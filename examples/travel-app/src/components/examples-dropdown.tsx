"use client";

import { usePathname, useRouter } from "next/navigation";

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "./ui/select";

type MenuItem = {
  title: string;
  href: string;
};

const MENU_ITEMS: MenuItem[] = [{ title: "Agent Example", href: "/" }];

export default function ExamplesDropdown() {
  const pathname = usePathname();
  const router = useRouter();

  const activeItem =
    MENU_ITEMS.find((item) => item.href === pathname) || MENU_ITEMS[0];

  return (
    <Select
      onValueChange={(href) => {
        router.push(href);
      }}
      value={activeItem.href}
    >
      <SelectTrigger className="h-10 gap-2 text-base bg-[#FF3366] text-white font-mono font-bold px-4 py-2 border-2 border-black transform rotate-2 hover:rotate-0 transition-all shadow-[4px_4px_0px_0px_#000000] hover:shadow-none hover:translate-x-1 hover:translate-y-1">
        <SelectValue placeholder={activeItem.title} />
      </SelectTrigger>
      <SelectContent className="font-mono border-2 border-black bg-white">
        {MENU_ITEMS.map((item) => (
          <SelectItem
            key={item.href}
            value={item.href}
            className="hover:!bg-[#FFDE5A] cursor-pointer font-bold"
          >
            {item.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
