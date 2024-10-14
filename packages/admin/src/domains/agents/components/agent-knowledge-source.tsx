'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SelectDropDown from '@/components/ui/select-dropdown';

import { useAgentFormContext } from '../context/agent-form-context';

import { AgentKnowledgeSourceIntegration } from './agent-knowledge-source-integration';

const vectorProviders = [{ label: 'PINECONE', value: 'PINECONE' }];

const resyncingIntervals = [
  { label: '15 minutes', value: '15_mins' },
  { label: '30 minutes', value: '30_mins' },
  { label: '1 hour', value: '1_hr' },
  { label: '6 hours', value: '6_hrs' },
  { label: '24 hours', value: '24_hrs' },
  { label: 'Weekly', value: 'weekly' },
];

export const AgentKnowledgeSource = () => {
  const [isNewIndex, setIsNewIndex] = useState(false);
  const { knowledgeSource, setKnowledgeSource } = useAgentFormContext();
  const [apiKey, setApiKey] = useState('');
  const [show, setShow] = useState(false);
  const [open, setOpen] = useState(false);

  const { vector_provider, resyncingInterval, entities } = knowledgeSource || {};

  return (
    <section className="space-y-2">
      <h1 className="font-medium text-sm">Knowledge source:</h1>

      <div className="space-y-1">
        <Label className="text-mastra-el-3 text-xs font-medium">Vector provider</Label>
        <SelectDropDown
          idKey="value"
          nameKey="label"
          open={open}
          onOpenChange={setOpen}
          data={vectorProviders}
          selectedValues={[{ label: vector_provider, value: vector_provider }]}
          setSelectedValues={values => {
            setKnowledgeSource(prev => ({ ...prev, vector_provider: values?.[0]?.value }));
          }}
          placeholder="Vector provider"
          isSingleSelect
          withCheckbox={false}
        >
          <Button
            type="button"
            variant={'ghost'}
            className=" w-full py-5 mt-1  flex items-center justify-start  cursor-default rounded bg-mastra-bg-6 gap-2 border-[0.5px] border-mastra-border-1  px-2 text-xs"
          >
            {vector_provider || 'Select vector provider'}
          </Button>
        </SelectDropDown>
      </div>

      <AnimatePresence>
        {vectorProviders ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{
              type: 'spring',
              bounce: 0,
              duration: 0.5,
            }}
            className="space-y-2"
          >
            <div className="space-y-1">
              <Label className="text-mastra-el-3 text-xs font-medium">API Key</Label>
              <div className="flex gap-2">
                <Input
                  type={show ? 'text' : 'password'}
                  className="placeholder:text-xs py-5 font-mono bg-white/5 overflow-ellipsis"
                  placeholder={''}
                  autoComplete="false"
                  autoCorrect="false"
                  onChange={e => setApiKey(e.target.value)}
                  onBlur={() => {
                    // TODO: save api key to .env
                  }}
                />

                <Button
                  type="button"
                  className="w-[68px] font-mono text-sm self-end"
                  onClick={() => setShow(prev => !prev)}
                >
                  {show ? 'hide' : 'show'}
                </Button>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-mastra-el-3 text-xs font-medium">Resyncing Interval</Label>
              <SelectDropDown
                idKey="value"
                nameKey="label"
                data={resyncingIntervals}
                selectedValues={[{ label: resyncingInterval, value: resyncingInterval }]}
                setSelectedValues={values => {
                  setKnowledgeSource(prev => ({ ...prev, resyncingInterval: values?.[0]?.value }));
                }}
                placeholder="Resyncing interval"
                isSingleSelect
                withCheckbox={false}
              >
                <Button
                  type="button"
                  variant={'ghost'}
                  className=" w-full py-5 mt-1  flex items-center justify-start  cursor-default rounded bg-mastra-bg-6 gap-2 border-[0.5px] border-mastra-border-1  px-2 text-xs"
                >
                  {resyncingInterval
                    ? resyncingIntervals?.find(({ value }) => value === resyncingInterval)?.label
                    : 'Select resyncing interval'}
                </Button>
              </SelectDropDown>
            </div>

            <div className="space-y-2">
              <Label className="text-mastra-el-3 text-xs font-medium">Entities to sync</Label>
              {entities?.map((ent, index) => (
                <AgentKnowledgeSourceIntegration
                  key={ent.integration}
                  integrationIndex={index}
                  integrationName={ent.integration}
                />
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
};
