import { Bot, DraftingCompass, Workflow } from 'lucide-react';
import { useLocation, Link } from 'react-router';

import { cn } from '../../lib/utils';

import { Mastra } from './mastra';

const links = [
  {
    name: 'Agents',
    url: '/agents',
    icon: Bot,
  },
  {
    name: 'Tools',
    url: '/tools',
    icon: DraftingCompass,
  },
  {
    name: 'Workflows',
    url: '/workflows',
    icon: Workflow,
  },
];

export const Sidebar = () => {
  const { pathname: path } = useLocation();

  return (
    <div className="relative z-20 h-full text-mastra-el-6">
      <div className="bg-mastra-bg-1 h-full w-full p-4 flex gap-6 flex-col">
        <div className="flex items-center justify-between">
          <div className="flex gap-2 px-2 items-center">
            <Mastra />
            <p className="text-medium text-sm  gradient py-[0.38rem] font-tasa">Mastra Playground</p>
          </div>
        </div>

        <div>
          <div className="flex flex-col gap-0.5">
            {links.map(link => {
              const [_, pagePath] = path.split('/');
              const lowercasedPagePath = link.name.toLowerCase();
              const isActive = link.url === path || link.name === path || pagePath === lowercasedPagePath;
              return (
                <Link
                  to={link.url}
                  className={cn(
                    'flex cursor-pointer w-full px-2 items-center focus-visible:outline-none transition-colors focus-visible:ring-1 focus-visible:ring-mastra-border-4 gap-3 rounded-xs group text-small hover:bg-mastra-el-6/5',
                    isActive ? 'bg-mastra-el-6/5' : '',
                  )}
                >
                  <link.icon
                    className={cn(
                      'w-[0.875rem] h-[0.875rem] text-mastra-el-3 group-hover:text-mastra-el-6',
                      isActive ? 'text-mastra-el-6' : '',
                    )}
                  />
                  <p
                    className={cn(
                      'py-[0.38rem] text-mastra-el-6/60 group-hover:text-mastra-el-6 transition-all  capitalize ',
                      isActive ? 'text-mastra-el-6' : '',
                    )}
                  >
                    {link.name}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex mt-auto gap-2 items-center justify-center">
          <a
            href="https://mastra.ai"
            target="_blank"
            rel="noopener"
            className="text-sm text-gray-300/60 hover:text-gray-100"
          >
            Mastra.AI
          </a>
          <div className="w-1 h-1 bg-gray-300/60 rounded-full" />
          <a
            href="https://mastra.ai/docs"
            target="_blank"
            rel="noopener"
            className="text-sm text-gray-300/60 hover:text-gray-100"
          >
            Docs
          </a>
          <div className="w-1 h-1 bg-gray-300/60 rounded-full" />

          <a
            href="https://github.com/mastra-ai/mastra"
            target="_blank"
            rel="noopener"
            className="text-sm text-gray-300/60 hover:text-gray-100"
          >
            GitHub
          </a>
        </div>
      </div>
    </div>
  );
};
