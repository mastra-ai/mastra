import { Bot } from 'lucide-react';

import { cn } from '../../lib/utils';

import { Mastra } from './mastra';

const links = [
  {
    name: 'Agents',
    url: '/agents',
    icon: Bot,
  },
  // {
  //   name: 'Workflows',
  //   url: '/workflows',
  //   icon: Workflow, //import from lucide-react
  // },
  // {
  //   name: 'Playground',
  //   url: '/playground',
  //   icon: Play, //import from lucide-react
  // },
];

export const Sidebar = () => {
  const pathname = window.location.pathname;
  const path = pathname.split('/')[1];

  return (
    <div className="relative z-20 h-full text-mastra-el-6">
      <div className="bg-mastra-bg-1 h-full w-full p-4 flex gap-6 flex-col">
        <div className="flex items-center justify-between">
          <div className="flex gap-2 px-2 items-center">
            <Mastra />
            <p className="text-medium text-sm  gradient py-[0.38rem] font-tasa">Mastra</p>
          </div>
        </div>

        <div>
          <div className="flex flex-col gap-0.5">
            {links.map(link => {
              const [pagePath] = path.split('/');
              const lowercasedPagePath = link.name.toLowerCase();
              const isActive =
                link.url === path ||
                link.name === path ||
                pagePath === lowercasedPagePath ||
                (link.name === 'Agents' && path === '');
              return (
                <a
                  href={link.url}
                  className={cn(
                    'flex cursor-pointer w-full px-2 items-center focus-visible:outline-none transition-colors focus-visible:ring-1 focus-visible:ring-zinc-900 gap-3 rounded-sm group text-small hover:bg-zinc-900',
                    isActive ? 'bg-zinc-900' : '',
                  )}
                >
                  <link.icon
                    className={cn(
                      'w-[0.875rem] h-[0.875rem] text-gray-300 group-hover:text-gray-100',
                      isActive ? 'text-gray-100' : '',
                    )}
                  />
                  <p
                    className={cn(
                      'py-[0.38rem] text-gray-300/60 group-hover:text-gray-100 text-sm transition-all  capitalize ',
                      isActive ? 'text-gray-100' : '',
                    )}
                  >
                    {link.name}
                  </p>
                </a>
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
          <a
            href="https://mastra.ai/docs/guide"
            target="_blank"
            rel="noopener"
            className="text-sm text-gray-300/60 hover:text-gray-100"
          >
            Docs
          </a>
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
