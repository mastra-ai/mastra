import { Button } from '@mastra/playground-ui/components/Button';
import { EntityName, EntityDescription, EntityContent, Entity } from '@mastra/playground-ui/components/Entity';
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Popover, PopoverTrigger, PopoverContent } from '@mastra/playground-ui/components/Popover';
import { ScrollArea } from '@mastra/playground-ui/components/ScrollArea';
import { Section, SubSectionRoot } from '@mastra/playground-ui/components/Section';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { ToolsIcon } from '@mastra/playground-ui/icons/ToolsIcon';
import { cn } from '@mastra/playground-ui/utils/cn';
import type { RuleGroup } from '@mastra/playground-ui/utils/rule-engine';
import { PlusIcon, XIcon } from 'lucide-react';
import { useCallback, useMemo } from 'react';
import { useWatch } from 'react-hook-form';

import { useAgentEditFormContext } from '../../context/agent-edit-form-context';
import { DisplayConditionsDialog } from '@/domains/cms';
import { SubSectionHeader } from '@/domains/cms/components/section/section-header';
import { MCPClientList } from '@/domains/mcps/components/mcp-client-list';
import { IntegrationToolsSection } from '@/domains/tool-providers/components';
import { useTools } from '@/domains/tools/hooks/use-all-tools';

export function ToolsPage() {
  const { form, readOnly, isCodeAgentOverride, editorConfig } = useAgentEditFormContext();
  const { control } = form;
  const { data: tools } = useTools();
  const selectedTools = useWatch({ control, name: 'tools' });
  const selectedIntegrationTools = useWatch({ control, name: 'integrationTools' });
  const variables = useWatch({ control, name: 'variables' });
  const toolsConfig = editorConfig === false ? false : editorConfig?.tools;
  const descriptionsOnly = isCodeAgentOverride && typeof toolsConfig === 'object' && toolsConfig.description === true;
  const isToolsLocked = isCodeAgentOverride && (editorConfig === false || toolsConfig === false);
  const canEditToolMembership = !readOnly && !descriptionsOnly && !isToolsLocked;
  const canEditToolDescriptions = !readOnly && !isToolsLocked && (!isCodeAgentOverride || toolsConfig !== false);
  // MCP clients and integration tools are tool-membership additions, so they
  // are hidden whenever tool membership cannot be edited (locked or descriptions-only).
  const hideToolMembershipSections = isToolsLocked || descriptionsOnly;

  const options = useMemo(() => {
    const opts: { value: string; label: string; description: string }[] = [];

    if (tools) {
      for (const [id, tool] of Object.entries(tools)) {
        opts.push({
          value: id,
          label: id,
          description: tool.description || '',
        });
      }
    }

    return opts;
  }, [tools]);

  const selectedToolIds = Object.keys(selectedTools || {});

  const getOriginalDescription = (id: string): string => {
    const option = options.find(opt => opt.value === id);
    return option?.description || '';
  };

  const handleValueChange = (toolId: string) => {
    const isSet = selectedTools?.[toolId] !== undefined;
    if (isSet) {
      const next = { ...selectedTools };
      delete next[toolId];
      form.setValue('tools', next, { shouldDirty: true });
    } else {
      form.setValue(
        'tools',
        {
          ...selectedTools,
          [toolId]: { ...selectedTools?.[toolId], description: getOriginalDescription(toolId) },
        },
        { shouldDirty: true },
      );
    }
  };

  const handleDescriptionChange = (toolId: string, description: string) => {
    form.setValue(
      'tools',
      {
        ...selectedTools,
        [toolId]: { ...selectedTools?.[toolId], description },
      },
      { shouldDirty: true },
    );
  };

  const handleRulesChange = (toolId: string, rules: RuleGroup | undefined) => {
    form.setValue(
      'tools',
      {
        ...selectedTools,
        [toolId]: { ...selectedTools?.[toolId], rules },
      },
      { shouldDirty: true },
    );
  };

  const handleIntegrationToolsSubmit = useCallback(
    (providerId: string, tools: Map<string, string>) => {
      const next = { ...selectedIntegrationTools };

      // Remove all tools from this provider
      for (const key of Object.keys(next)) {
        if (key.startsWith(`${providerId}:`)) {
          delete next[key];
        }
      }

      // Add selected tools, preserving existing config (rules) if available
      for (const [id, description] of tools) {
        next[id] = selectedIntegrationTools?.[id] || { description };
      }

      form.setValue('integrationTools', next, { shouldDirty: true });
    },
    [form, selectedIntegrationTools],
  );

  const selectedOptions = useMemo(() => {
    // Include all selected tools, even agent-level tools not in the global list.
    // Tools registered on the agent (not at the Mastra instance level) won't
    // appear in useTools() but are still valid selections in the stored config.
    return selectedToolIds.map(id => {
      const existing = options.find(opt => opt.value === id);
      return existing || { value: id, label: id, description: selectedTools?.[id]?.description || '' };
    });
  }, [options, selectedToolIds, selectedTools]);

  const unselectedOptions = useMemo(() => {
    return options.filter(opt => !selectedToolIds.includes(opt.value));
  }, [options, selectedToolIds]);

  const handleAddTool = (toolId: string) => {
    form.setValue(
      'tools',
      {
        ...selectedTools,
        [toolId]: { ...selectedTools?.[toolId], description: getOriginalDescription(toolId) },
      },
      { shouldDirty: true },
    );
  };

  const renderToolEntity = (tool: (typeof options)[number]) => {
    return (
      <Entity key={tool.value} className="bg-surface2">
        <EntityContent>
          <EntityName className="text-ui-md! leading-ui-md! font-medium">{tool.label}</EntityName>
          <EntityDescription>
            <input
              type="text"
              aria-label={`Description for ${tool.label}`}
              disabled={!canEditToolDescriptions}
              className={cn(
                'border border-transparent appearance-none block w-full text-neutral3 bg-transparent rounded px-1 -mx-1 transition-colors focus:outline-solid focus:outline-1 focus:outline-white focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-white',
                canEditToolDescriptions && 'hover:bg-surface4 focus:bg-surface4',
              )}
              value={selectedTools?.[tool.value]?.description ?? tool.description}
              onChange={e => handleDescriptionChange(tool.value, e.target.value)}
            />
          </EntityDescription>
        </EntityContent>

        {canEditToolMembership && (
          <DisplayConditionsDialog
            entityName={tool.label}
            schema={variables}
            rules={selectedTools?.[tool.value]?.rules}
            onRulesChange={rules => handleRulesChange(tool.value, rules)}
          />
        )}

        {canEditToolMembership && (
          <button
            type="button"
            onClick={() => handleValueChange(tool.value)}
            className="text-neutral3 hover:text-neutral5 transition-colors rounded-sm focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-white/30"
            aria-label={`Remove ${tool.label}`}
          >
            <Icon size="sm">
              <XIcon />
            </Icon>
          </button>
        )}
      </Entity>
    );
  };

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-6 pt-4">
        {isToolsLocked && (
          <Notice variant="info" title="Tools are owned by code">
            <Notice.Message>
              This code-defined agent has disabled tools editing from Studio. Update the agent definition in code to
              change its tools.
            </Notice.Message>
          </Notice>
        )}
        {!isToolsLocked && descriptionsOnly && (
          <Notice variant="info" title="Tool membership is owned by code">
            <Notice.Message>
              This code-defined agent only allows editing tool descriptions from Studio. Update the agent definition in
              code to add or remove tools.
            </Notice.Message>
          </Notice>
        )}
        <SubSectionRoot>
          <Section.Header>
            <SubSectionHeader title="Tools" icon={<ToolsIcon />} />

            {canEditToolMembership && unselectedOptions.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Icon size="sm">
                      <PlusIcon />
                    </Icon>
                    Add Tools
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-80 p-0 pt-4 max-h-72 overflow-y-auto">
                  {unselectedOptions.map(tool => (
                    <button
                      key={tool.value}
                      type="button"
                      onClick={() => handleAddTool(tool.value)}
                      className="flex flex-col gap-0.5 w-full text-left px-3 py-2.5 hover:bg-white/10 focus:bg-white/10 transition-colors focus-visible:outline-hidden focus-visible:ring-0"
                    >
                      <span className="text-ui-md font-normal text-neutral5">{tool.label}</span>
                      {tool.description && <span className="text-ui-xs text-neutral3">{tool.description}</span>}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            )}
          </Section.Header>

          {selectedOptions.length > 0 && (
            <div className="flex flex-col gap-1">{selectedOptions.map(tool => renderToolEntity(tool))}</div>
          )}
        </SubSectionRoot>

        {!hideToolMembershipSections && <MCPClientList />}

        {!hideToolMembershipSections && (
          <IntegrationToolsSection
            selectedToolIds={selectedIntegrationTools}
            onSubmitTools={canEditToolMembership ? handleIntegrationToolsSubmit : undefined}
          />
        )}
      </div>
    </ScrollArea>
  );
}
