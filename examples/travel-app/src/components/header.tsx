import { Plane } from 'lucide-react';

import Link from 'next/link';

import ExamplesDropdown from './ui/dropdown';
import { GitHubIcon } from './ui/icons';

export default function Header() {
  return (
    <header className="sticky top-0 z-10 bg-white border-b border-gray-200">
      <div className="container mx-auto px-4">
        <div className="h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2 group">
            <Plane className="h-6 w-6 text-blue-600" />
            <div className="flex flex-col">
              <span className="text-xl font-semibold text-blue-600">TravelAI</span>
              <span className="text-xs text-gray-500 -mt-1">a Mastra example app</span>
            </div>
          </Link>

          <div className="flex items-center space-x-6">
            <nav>
              <ExamplesDropdown />
            </nav>
            <a
              href="https://github.com/mastra-ai/mastra/tree/main/examples/travel-app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-600 hover:text-blue-600 transition-colors"
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
