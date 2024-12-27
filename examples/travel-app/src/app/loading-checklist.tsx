"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";

import { LOADING_MESSAGES } from "./travel-form";

export function LoadingChecklist({ isLoading }: { isLoading: boolean }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        setCurrentIndex((prev) =>
          prev < LOADING_MESSAGES.length - 1 ? prev + 1 : prev,
        );
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [currentIndex, isLoading]);

  return (
    <div className="bg-[var(--brut-bg)] p-4 md:p-8 flex items-center justify-center">
      <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_#000000] p-8 max-w-md w-full transform -rotate-1 hover:rotate-0 transition-transform">
        <h2 className="font-mono font-bold text-2xl mb-6 bg-black text-white inline-block px-4 py-2 rotate-1">
          Planning Your Trip
        </h2>

        <ul className="space-y-4">
          {LOADING_MESSAGES.map((message, index) => (
            <li
              key={index}
              className={`
                flex items-center gap-3 font-mono text-lg
                transition-all duration-500
                ${index > currentIndex ? "opacity-30" : "opacity-100"}
              `}
            >
              <div
                className={`
                  w-6 h-6 border-2 border-black flex items-center justify-center
                  ${index < currentIndex ? "bg-[var(--brut-green)]" : "bg-white"}
                  transition-colors duration-300
                `}
              >
                {index < currentIndex && (
                  <Check className="w-4 h-4 text-black animate-[scale-in_0.2s_ease-in-out]" />
                )}
              </div>
              <span
                className={`text-sm ${
                  index === currentIndex
                    ? "animate-[fade-in_0.5s_ease-in-out]"
                    : ""
                }`}
              >
                {message}
              </span>
              {index === currentIndex && (
                <span className="flex">
                  <span className="animate-[bounce_0.6s_ease-in-out_infinite] ">
                    .
                  </span>
                  <span className="animate-[bounce_0.6s_ease-in-out_infinite] delay-100">
                    .
                  </span>
                  <span className="animate-[bounce_0.6s_ease-in-out_infinite] delay-200">
                    .
                  </span>
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
