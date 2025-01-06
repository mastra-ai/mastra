import { PlaneTakeoff } from "lucide-react";

import Link from "next/link";

import ExamplesDropdown from "./examples-dropdown";
import { GitHubIcon } from "./ui/icons";

export default function Header() {
  return (
    <header className="bg-[var(--brut-bg)] border-b-4 border-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link
            href="/"
            className="flex items-center gap-2 bg-black text-white px-4 py-2 transform -rotate-2 hover:rotate-0 transition-all shadow-[4px_4px_0px_0px_#000000] hover:shadow-none hover:translate-x-1 hover:translate-y-1"
          >
            <PlaneTakeoff className="h-5 w-5" />
            <span className="font-mono font-bold text-lg">TravelAI</span>
          </Link>

          <div className="flex items-center gap-4">
            <ExamplesDropdown />

            <a
              href="https://github.com/mastra-ai/mastra/tree/main/examples/travel-app"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[var(--brut-green)] p-2 border-2 border-black transform -rotate-2 hover:rotate-0 transition-all shadow-[4px_4px_0px_0px_#000000] hover:shadow-none hover:translate-x-1 hover:translate-y-1"
              aria-label="View source on GitHub"
            >
              <GitHubIcon className="h-6 w-6" />
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
