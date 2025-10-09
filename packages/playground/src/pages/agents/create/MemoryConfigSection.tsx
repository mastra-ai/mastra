import { InputField } from '@mastra/playground-ui';
import { Checkbox } from '@/components/ui/checkbox';
import type { AgentFormData } from './types';

interface MemoryConfigSectionProps {
  formData: AgentFormData;
  onUpdateMemoryConfig: (updates: Partial<AgentFormData['memoryConfig']>) => void;
}

export function MemoryConfigSection({ formData, onUpdateMemoryConfig }: MemoryConfigSectionProps) {
  return (
    <div className="space-y-4 flex flex-col h-full">
      <div>
        <h3 className="text-base font-semibold text-mastra-el-1 mb-0.5">Memory Configuration</h3>
        <p className="text-xs text-mastra-el-3">Context & recall settings</p>
      </div>

      <div className="flex-1 space-y-3.5 overflow-y-auto pr-1">
        {/* Last Messages - Compact */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="lastMessages" className="text-sm text-mastra-el-3 min-w-fit">
              Last Messages
            </label>
            <input
              id="lastMessages"
              name="lastMessages"
              type="number"
              min={0}
              value={formData.memoryConfig.lastMessages}
              onChange={e =>
                onUpdateMemoryConfig({
                  lastMessages: parseInt(e.target.value) || 0,
                })
              }
              className="w-20 text-[0.875rem] text-[rgba(255,255,255,0.8)] border border-[rgba(255,255,255,0.15)] rounded-lg bg-transparent px-[0.75rem] py-[0.5rem] focus:outline-none focus:shadow-[inset_0_0_0_1px_#18fb6f]"
            />
          </div>
          <p className="text-[0.75rem] text-icon2">Recent messages to include in context</p>
        </div>

        {/* Semantic Recall */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="semanticRecall"
              checked={formData.memoryConfig.semanticRecall.enabled}
              onCheckedChange={checked =>
                onUpdateMemoryConfig({
                  semanticRecall: {
                    ...formData.memoryConfig.semanticRecall,
                    enabled: checked as boolean,
                  },
                })
              }
            />
            <label htmlFor="semanticRecall" className="text-sm cursor-pointer text-mastra-el-3">
              Enable Semantic Recall (RAG)
            </label>
          </div>

          {formData.memoryConfig.semanticRecall.enabled && (
            <div className="ml-6 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <label htmlFor="topK" className="text-sm text-mastra-el-3 min-w-fit">
                  Top K Results
                </label>
                <input
                  id="topK"
                  type="number"
                  min={1}
                  max={20}
                  value={formData.memoryConfig.semanticRecall.topK}
                  onChange={e =>
                    onUpdateMemoryConfig({
                      semanticRecall: {
                        ...formData.memoryConfig.semanticRecall,
                        topK: parseInt(e.target.value) || 5,
                      },
                    })
                  }
                  className="w-20 text-[0.875rem] text-[rgba(255,255,255,0.8)] border border-[rgba(255,255,255,0.15)] rounded-lg bg-transparent px-[0.75rem] py-[0.5rem] focus:outline-none focus:shadow-[inset_0_0_0_1px_#18fb6f]"
                />
              </div>
              <div className="flex items-center justify-between gap-4">
                <label htmlFor="messageRange" className="text-sm text-mastra-el-3 min-w-fit">
                  Message Range
                </label>
                <input
                  id="messageRange"
                  type="number"
                  min={0}
                  max={10}
                  value={formData.memoryConfig.semanticRecall.messageRange}
                  onChange={e =>
                    onUpdateMemoryConfig({
                      semanticRecall: {
                        ...formData.memoryConfig.semanticRecall,
                        messageRange: parseInt(e.target.value) || 2,
                      },
                    })
                  }
                  className="w-20 text-[0.875rem] text-[rgba(255,255,255,0.8)] border border-[rgba(255,255,255,0.15)] rounded-lg bg-transparent px-[0.75rem] py-[0.5rem] focus:outline-none focus:shadow-[inset_0_0_0_1px_#18fb6f]"
                />
              </div>
            </div>
          )}
        </div>

        {/* Working Memory */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="workingMemory"
              checked={formData.memoryConfig.workingMemory.enabled}
              onCheckedChange={checked =>
                onUpdateMemoryConfig({
                  workingMemory: {
                    ...formData.memoryConfig.workingMemory,
                    enabled: checked as boolean,
                  },
                })
              }
            />
            <label htmlFor="workingMemory" className="text-sm cursor-pointer text-mastra-el-3">
              Enable Working Memory
            </label>
          </div>

          {formData.memoryConfig.workingMemory.enabled && (
            <div className="ml-6">
              <div className="space-y-2">
                <label className="text-[0.8125rem] text-icon3">Scope</label>
                <select
                  value={formData.memoryConfig.workingMemory.scope}
                  onChange={e =>
                    onUpdateMemoryConfig({
                      workingMemory: {
                        ...formData.memoryConfig.workingMemory,
                        scope: e.target.value as 'thread' | 'resource',
                      },
                    })
                  }
                  aria-label="Working memory scope"
                  className="flex grow items-center cursor-pointer text-[0.875rem] text-[rgba(255,255,255,0.8)] border border-[rgba(255,255,255,0.15)] leading-none rounded-lg bg-transparent min-h-[2.5rem] px-[0.75rem] py-[0.5rem] w-full focus:outline-none focus:shadow-[inset_0_0_0_1px_#18fb6f]"
                >
                  <option value="thread" className="bg-[#1a1a1a]">
                    Thread (per conversation)
                  </option>
                  <option value="resource" className="bg-[#1a1a1a]">
                    Resource (across all user threads)
                  </option>
                </select>
                <p className="text-[0.75rem] text-icon2">
                  {formData.memoryConfig.workingMemory.scope === 'thread'
                    ? 'Working memory is specific to this conversation'
                    : 'Working memory persists across all conversations for this user'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Thread Settings */}
        <div className="flex items-center space-x-2">
          <Checkbox
            id="generateTitle"
            checked={formData.memoryConfig.threads.generateTitle}
            onCheckedChange={checked =>
              onUpdateMemoryConfig({
                threads: {
                  ...formData.memoryConfig.threads,
                  generateTitle: checked as boolean,
                },
              })
            }
          />
          <label htmlFor="generateTitle" className="text-sm cursor-pointer text-mastra-el-3">
            Auto-generate Thread Titles
          </label>
        </div>
      </div>
    </div>
  );
}
