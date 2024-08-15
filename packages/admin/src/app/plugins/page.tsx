import React from 'react';

import { PluginHeader } from '@/domains/plugins/components/plugin-header';
import { PluginListRow } from '@/domains/plugins/components/plugin-list-row';

import { future } from '../../../example.future.config';

const pluginToSrcMap: Record<string, string> = {
  google: '/google.svg',
  notion: '/notion.svg',
  slack: '/slack.svg',
  rewatch: '/rewatch.svg',
  mailchimp: '/mailchimp.svg',
};

const PluginsPage = () => {
  const integrations = future.authenticatablePlugins();
  const plugins = integrations.map(integration => {
    return {
      pluginName: integration.name,
      imgSrc: pluginToSrcMap[integration.name.toLowerCase()],
      plugin: integration.plugin,
    };
  });

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0">
        <PluginHeader />
      </div>
      <div className="grow overflow-hidden">
        {plugins.map(({ pluginName, imgSrc, plugin }) => {
          return <PluginListRow key={plugin.name} pluginName={pluginName} imageSrc={imgSrc} />;
        })}
      </div>
    </div>
  );
};

export default PluginsPage;
