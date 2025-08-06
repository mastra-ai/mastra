import { Header, HeaderTitle, MainContentLayout, TemplatesTools, TemplatesList } from '@mastra/playground-ui';
import { useTemplates } from '@/domains/templates/use-templates';
import { cn } from '@/lib/utils';
import { Link } from 'react-router';

import { useState } from 'react';

export default function Templates() {
  const { data: templates, tags, providers } = useTemplates();
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const tagOptions = [{ value: 'all', label: 'All' }];
  (tags || []).forEach(tag => {
    tagOptions.push({ value: tag, label: tag });
  });
  const providerOptions = [{ value: 'all', label: 'All' }];
  (providers || []).forEach(provider => {
    providerOptions.push({ value: provider, label: provider });
  });

  const handleFilterChange = (value: string, filter: string) => {
    if (filter === 'tag') {
      setSelectedTag(value);
    } else if (filter === 'provider') {
      setSelectedProvider(value);
    }
  };

  const handleSearch = (value: string) => {
    setSearchTerm(value);
  };

  const handleReset = () => {
    setSelectedTag('all');
    setSelectedProvider('all');
    setSearchTerm('');
  };

  const filteredTemplates = templates.filter(template => {
    if (
      searchTerm &&
      !template.title.toLowerCase().includes(searchTerm) &&
      !template.description.toLowerCase().includes(searchTerm)
    ) {
      return false;
    }
    if (selectedTag !== 'all' && !template.tags.includes(selectedTag)) {
      return false;
    }
    if (selectedProvider !== 'all' && !template.supportedProviders.includes(selectedProvider)) {
      return false;
    }
    return true;
  });

  const isFiltered = searchTerm || selectedTag !== 'all' || selectedProvider !== 'all';

  return (
    <MainContentLayout>
      <Header>
        <HeaderTitle>Templates</HeaderTitle>
      </Header>

      <div className={cn('overflow-y-scroll w-full h-full px-[2rem] pb-[3rem] z-[1]')}>
        <TemplatesTools
          tagOptions={tagOptions}
          selectedTag={selectedTag}
          providerOptions={providerOptions}
          selectedProvider={selectedProvider}
          searchTerm={searchTerm}
          onTagChange={value => handleFilterChange(value, 'tag')}
          onProviderChange={value => handleFilterChange(value, 'provider')}
          onSearchChange={handleSearch}
          onReset={isFiltered ? handleReset : undefined}
          className="max-w-[80rem]"
        />
        <TemplatesList templates={filteredTemplates} linkComponent={Link} className="max-w-[80rem] mx-auto" />
      </div>
    </MainContentLayout>
  );
}
