'use client';

import { Search } from 'lucide-react';
import React from 'react';

import Image from 'next/image';

import Breadcrumb from '@/components/ui/breadcrumbs';
import { Input } from '@/components/ui/input';

import { addPluginAction } from '../actions';

const CreatePlugin = () => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const plugins = [
    {
      name: 'Google',
      url: '/google.svg',
    },
    {
      name: 'Notion',
      url: '/notion.svg',
    },
    {
      name: 'Slack',
      url: '/slack.svg',
    },
    {
      name: 'Rewatch',
      url: '/rewatch.svg',
    },
    {
      name: 'Mailchimp',
      url: '/mailchimp.svg',
    },
  ];

  const filteredPlugins = React.useMemo(
    () =>
      plugins.filter(plugin => {
        return plugin.name.toLowerCase().includes(searchTerm.toLowerCase());
      }),
    [searchTerm],
  );

  const addPlugin = (pluginName: string) => {
    console.log(`Adding plugin: ${pluginName}`, pluginName);
    addPluginAction(pluginName);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0">
        <div className="flex h-[var(--top-bar-height)] w-full content-center items-center justify-between border-b-[0.1px] border-primary-border px-[1.31rem]">
          <div className="inline-flex h-[26px] w-[125px] items-center justify-start gap-3">
            <Breadcrumb
              items={[
                {
                  label: 'Create plugin',
                  href: ``,
                  isCurrent: true,
                },
              ]}
              pageClassName="font-medium"
            />
          </div>
        </div>
      </div>
      <div className="px-3">
        <div className="my-6 relative">
          <Search size={17} className="absolute top-1/2 -translate-y-1/2 left-3 text-gray-400" />
          <Input
            className="bg-gray-400/5 px-9 py-3"
            placeholder="Search for plugin"
            value={searchTerm}
            onChange={handleInputChange}
          />
        </div>
        <div className="grid grid-cols-3 gap-y-3">
          {filteredPlugins.map(plugin => {
            return (
              <button
                onClick={() => addPlugin(plugin.name)}
                className="hover:bg-slate-500/15 p-3 flex gap-3 items-center transition-colors duration-150"
                key={plugin.name}
              >
                <Image src={`/plugins/${plugin.url}`} width={28} height={28} alt={plugin.name} />
                <span>{plugin.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CreatePlugin;
