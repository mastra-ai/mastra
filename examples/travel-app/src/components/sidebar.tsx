"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { useSidebar } from "@/lib/sidebar-context";

export default function Sidebar() {
  const { isOpen, setIsOpen, content } = useSidebar();

  const defaultContent = <></>;

  return (
    <aside
      className={`
        relative 
        ${isOpen ? "lg:w-1/2 transition-all  duration-300 ease-in-out" : "w-0"}
      `}
    >
      <div
        className={`
          fixed top-16 right-0 h-[calc(100vh-64px)] bg-white shadow-lg
         
          lg:w-[100%] w-[80%]
          ${isOpen ? "translate-x-0 lg:relative transition-all duration-300 ease-in-out" : "translate-x-full"}
          flex flex-col
        `}
      >
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="absolute -left-14 top-1/2 -translate-y-1/2  p-2  rounded-l-lg  flex-col justify-center w-14 inline-flex items-center gap-2 bg-black text-white font-mono font-bold px-4 py-2 border-4 border-black shadow-[4px_4px_0px_0px_#000000] hover:shadow-none hover:translate-x-1  transition-all transform -rotate-1 hover:rotate-0"
          aria-label={isOpen ? "Close sidebar" : "Open sidebar"}
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
            h-full w-full border-4 border-black overflow-y-auto p-6
            ${isOpen ? "opacity-100 transition-opacity duration-300 ease-in-out" : "opacity-0"}
          `}
        >
          {content || defaultContent}
        </div>
      </div>
    </aside>
  );
}
