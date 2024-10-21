'use client';

import { useEffect, useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import Icon from '@/components/icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SelectDropDown from '@/components/ui/select-dropdown';

import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

import { createPineconeIndex, saveVectorToConfigAction } from '../actions';
import { useVectorFormContext } from '../context/vector-form-context';
import { useVectorProviderExists } from '../hooks/use-vector-provider';

import { VectorProviderFormIntegration } from './vector-provider-form-integration';

const vectorProviders = [{ label: 'PINECONE', value: 'PINECONE' }];

const resyncingIntervals = [
  { label: '15 minutes', value: '15_mins' },
  { label: '30 minutes', value: '30_mins' },
  { label: '1 hour', value: '1_hr' },
  { label: '6 hours', value: '6_hrs' },
  { label: '24 hours', value: '24_hrs' },
  { label: 'Weekly', value: 'weekly' },
];

const lock = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    // class="lucide lucide-lock"
  >
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

//TODO: check if persisted and change "Save" button to "Edit",
// and there should be a visual cue that it's connected
//Put mastra doc text on the right

export const VectorProviderForm = () => {
  const { apiKey, setApiKey, vectorProvider, setVectorProvider, entities } = useVectorFormContext();
  const [show, setShow] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncInterval, setSyncInterval] = useState<string | undefined>();

  const router = useRouter();

  const { exists, apiKey: envApiKey } = useVectorProviderExists({
    providerName: 'PINECONE',
  });

  const isFilled = Boolean(vectorProvider) && Boolean(apiKey);
  console.log({ isFilled });
  useEffect(() => {
    if (envApiKey) {
      setApiKey(envApiKey);
    }
  }, [envApiKey]);

  const updateLocalProvider = async () => {
    if (!isSaved) {
      saveVectorToConfigAction({
        providerName: vectorProvider,
        apiKey,
      });
      setIsSaved(true);
    } else {
      setIsSaved(false);
    }
  };

  const createVectorIndex = async () => {
    setLoading(true);
    const response = await createPineconeIndex({
      provider: vectorProvider || 'PINECONE',
      vectorEntities: entities,
      syncInterval,
    });
    if (!response.ok) {
      setLoading(false);
      toast(response.error);

      return;
    }
    toast.success('Sync successful');
    router.push('/rag');
  };

  const entitiesFilled = entities.some(ent => ent.integration && ent.data.some(d => d.name && d.fields?.length > 0));

  useEffect(() => {
    if (exists) {
      setIsSaved(true);
      setVectorProvider('PINECONE');
    }
  }, [exists]);

  return (
    <section className={cn('space-y-2 max-w-[36rem]')}>
      <div className={cn('space-y-8', { 'opacity-50': isSaved })}>
        <div className="flex justify-between items-center">
          <h2 className={cn('font-medium text-[1rem] flex items-center gap-1', { 'text-green-500': isSaved })}>
            1. {isSaved ? 'Vector Store Connected' : 'Connect Vector Store'}{' '}
            {isSaved ? <Icon name="check-in-circle" className="text-green-600" /> : null}
          </h2>

          <Button
            className={cn('opacity-100', { ' !cursor-not-allowed opacity-50': !isFilled })}
            variant="outline"
            size="xs"
            type="button"
            disabled={apiKey === ''}
            onClick={updateLocalProvider}
          >
            {isSaved ? 'Edit' : 'Save'}
          </Button>
        </div>

        <div className="space-y-1">
          <Label className="text-mastra-el-3 text-xs font-medium">Vector provider</Label>
          <SelectDropDown
            idKey="value"
            nameKey="label"
            open={open}
            onOpenChange={setOpen}
            data={vectorProviders}
            selectedValues={
              exists ? [{ label: 'PINECONE', value: 'PINECONE' }] : [{ label: vectorProvider, value: vectorProvider }]
            }
            setSelectedValues={values => {
              setVectorProvider(values?.[0]?.value);
            }}
            placeholder="Vector provider"
            isSingleSelect
            withCheckbox={false}
            isDisabled={isSaved}
            asRadio
          >
            <Button
              type="button"
              variant={'ghost'}
              className="w-full py-5 mt-1  flex items-center justify-start  cursor-default rounded bg-mastra-bg-6 gap-2 border-[0.5px] border-mastra-border-1  px-2 text-xs"
            >
              {vectorProvider || 'Select vector provider'}

              <Icon name="down-caret" className="ml-auto" />
            </Button>
          </SelectDropDown>
        </div>
        <div className={cn('space-y-1', { 'opacity-50': !vectorProvider })}>
          <Label className="text-mastra-el-3 text-xs font-medium">API Key</Label>
          <div className="flex gap-2">
            <Input
              type={isSaved ? 'password' : show ? 'text' : 'password'}
              className="placeholder:text-xs py-5 font-mono bg-white/5 overflow-ellipsis"
              placeholder={''}
              autoComplete="false"
              autoCorrect="false"
              onChange={e => setApiKey(e.target.value)}
              value={exists ? envApiKey : apiKey}
              disabled={!vectorProvider || isSaved}
            />

            <Button
              type="button"
              variant="outline"
              disabled={!vectorProvider || isSaved}
              className="w-[68px] font-mono text-sm self-end"
              onClick={() => setShow(prev => !prev)}
            >
              {isSaved ? 'show' : show ? 'hide' : 'show'}
            </Button>
          </div>
        </div>
      </div>

      <div className={cn('space-y-8 !mt-10', { 'opacity-50': !isSaved })}>
        <div className="flex items-center justify-between">
          <h2 className="text-gray-200 text-[1rem] font-medium flex items-center gap-1">
            {!isSaved ? lock : null} 2. Select Entities
          </h2>
          <Button
            className={cn('text-green-500 border-green-500', {
              '!cursor-not-allowed !opacity-50 text-gray-500 border-gray-500': !isSaved || !entitiesFilled || loading,
            })}
            variant="outline"
            size="xs"
            type="button"
            disabled={!isSaved || !entitiesFilled || loading}
            onClick={createVectorIndex}
          >
            {loading ? 'Syncing...' : 'Start sync'}
          </Button>
        </div>
        {entities?.map((ent, index) => (
          <VectorProviderFormIntegration
            key={ent.integration}
            integrationIndex={index}
            integrationName={ent.integration}
            disabled={!isSaved || loading}
          />
        ))}
        <div className="flex flex-col space-y-1">
          <Label className="text-gray-400 text-xs">Sync Interval</Label>

          <Input
            type={'text'}
            className="placeholder:text-xs py-5  text-gray-400 overflow-ellipsis"
            placeholder={'e.g 5 * * * *'}
            autoComplete="false"
            autoCorrect="false"
            onChange={e => {
              setSyncInterval(e.target.value);
            }}
            value={syncInterval}
            disabled={!isSaved}
          />

          <span className="text-[0.65rem] text-mastra-el-2">
            This is a{' '}
            <Link
              href="https://vercel.com/docs/cron-jobs#cron-expressions"
              className="text-blue-400 hover:underline"
              target="_blank"
            >
              vercel cron expresion
            </Link>
          </span>
        </div>
      </div>
    </section>
  );
};
