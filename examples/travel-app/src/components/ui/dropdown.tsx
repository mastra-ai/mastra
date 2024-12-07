'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type MenuItem = {
  title: string;
  href: string;
};

const MENU_ITEMS: MenuItem[] = [
  { title: 'Agent Example', href: '/' },
  { title: 'Workflow Example', href: '/workflow' },
  { title: 'Agent with Memory Example', href: '/agent-memory' },
];

export default function ExamplesDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  const activeItem = MENU_ITEMS.find(item => item.href === pathname) || MENU_ITEMS[0];

  return <></>;
  // return (
  //   <div className="relative">
  //     <button
  //       onClick={() => setIsOpen(!isOpen)}
  //       className="flex items-center space-x-1 text-gray-600 hover:text-blue-600 transition-colors"
  //       onBlur={() => setTimeout(() => setIsOpen(false), 200)}
  //     >
  //       <span>{activeItem.title}</span>
  //       <ChevronDown className="h-4 w-4" />
  //     </button>

  //     {isOpen && (
  //       <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-2">
  //         {MENU_ITEMS.map(item => (
  //           <Link
  //             key={item.href}
  //             href={item.href}
  //             className={`block px-4 py-2 text-sm hover:bg-gray-50 ${
  //               item.href === pathname ? 'text-blue-600 font-medium bg-blue-50' : 'text-gray-600'
  //             }`}
  //             onClick={() => setIsOpen(false)}
  //           >
  //             {item.title}
  //           </Link>
  //         ))}
  //       </div>
  //     )}
  //   </div>
  // );
}
