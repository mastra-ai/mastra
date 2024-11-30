'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import { useSidebar } from '@/lib/sidebar-context';

export default function Sidebar() {
  const { isOpen, setIsOpen } = useSidebar();

  return (
    <aside className={`relative transition-all duration-300 ease-in-out ${isOpen ? 'w-80' : 'w-0'}`}>
      <div
        className={`
        fixed top-16 right-0 h-[calc(100vh-64px)] bg-white shadow-lg
        transition-all duration-300 ease-in-out
        ${isOpen ? 'w-80 translate-x-0' : 'w-80 translate-x-full'}
      `}
      >
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="absolute -left-14 top-1/2 -translate-y-1/2 bg-white p-2 shadow-lg rounded-l-lg flex flex-col items-center justify-center w-14"
          aria-label={isOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          {isOpen ? (
            <>
              <ChevronRight size={24} />
              <span className="text-sm">Learn</span>
            </>
          ) : (
            <>
              <ChevronLeft size={24} />
              <span className="text-sm">Learn</span>
            </>
          )}
        </button>

        <div
          className={`
          h-full overflow-y-auto p-6
          transition-opacity duration-300 ease-in-out
          ${isOpen ? 'opacity-100' : 'opacity-0'}
        `}
        >
          <h2 className="text-xl font-bold mb-4">Information</h2>
          <p>Hello World!</p>
        </div>
      </div>
    </aside>
  );
}
