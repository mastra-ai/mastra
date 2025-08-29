import { Header, HeaderTitle, MainContentLayout, TemplatesTools, TemplatesList } from '@mastra/playground-ui';
import { useMastraTemplates } from '@/hooks/use-templates';
import { cn } from '@/lib/utils';
import { Link } from 'react-router';

import { useState } from 'react';

export default function Templates() {
  const { data, isLoading } = useMastraTemplates();
  const { templates, tags, providers } = data ?? { templates: [], tags: [], providers: [] };
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

      <div className={cn('overflow-y-auto w-full h-full px-[2rem] pb-[3rem] z-[1]')}>
        <TemplatesTools
          selectedTag={selectedTag}
          onTagChange={value => handleFilterChange(value, 'tag')}
          tagOptions={tagOptions}
          selectedProvider={selectedProvider}
          onProviderChange={value => handleFilterChange(value, 'provider')}
          providerOptions={providerOptions}
          searchTerm={searchTerm}
          onSearchChange={handleSearch}
          onReset={isFiltered ? handleReset : undefined}
          className="max-w-[80rem]"
          isLoading={isLoading}
        />
        <TemplatesList
          templates={filteredTemplates}
          linkComponent={Link}
          className="max-w-[80rem] mx-auto"
          isLoading={isLoading}
        />
      </div>
    </MainContentLayout>
  );
}
