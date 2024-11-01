'use client';

import { useEffect, useState } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import Icon from '@/components/icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import SelectDropDown from '@/components/ui/select-dropdown';
import Spinner from '@/components/ui/spinner';

import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

import { createPineconeIndex, saveVectorToConfigAction } from '../actions';
import { useVectorFormContext } from '../context/vector-form-context';
import { useVectorProviderExists } from '../hooks/use-vector-provider';

import { VectorProviderFormIntegration } from './vector-provider-form-integration';

const vectorProviders = [{ label: 'PINECONE', value: 'PINECONE' }];

const resyncingIntervals = [
  { label: 'None', pattern: '0' },
  {
    label: (
      <span>
        Every 5 Min : <span className="font-mono text-mastra-bg-7"> */5 * * * *</span>
      </span>
    ),
    pattern: '5 * * * *',
  },
  {
    label: (
      <span>
        Every 15 Minutes : <span className="font-mono text-mastra-bg-7"> */15 * * * *</span>
      </span>
    ),
    pattern: '*/15 * * * *',
  },
  {
    label: (
      <span>
        Every hour : <span className="font-mono text-mastra-bg-7">0 * * * *</span>
      </span>
    ),
    pattern: '0 * * * *',
  },
  {
    label: (
      <span>
        Every six hours : <span className="font-mono text-mastra-bg-7">0 */6 * * *</span>
      </span>
    ),
    pattern: '0 */6 * * *',
  },
  {
    label: (
      <span>
        Every day : <span className="font-mono text-mastra-bg-7">0 0 * * *</span>
      </span>
    ),
    pattern: '0 0 * * *',
  },
  {
    label: (
      <span>
        Every week : <span className="font-mono text-mastra-bg-7">0 0 * * 0</span>
      </span>
    ),
    pattern: '0 0 * * 0',
  },
] as const;

//TODO: check if persisted and change "Save" button to "Edit",
// and there should be a visual cue that it's connected
//Put mastra doc text on the right

type SyncInterval = (typeof resyncingIntervals)[number]['label'];

export const VectorProviderForm = () => {
  const { apiKey, setApiKey, vectorProvider, setVectorProvider, entities } = useVectorFormContext();
  const [show, setShow] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncInterval, setSyncInterval] = useState<string | undefined>('0');

  const router = useRouter();

  const { exists, apiKey: envApiKey } = useVectorProviderExists({
    providerName: 'PINECONE',
  });

  const isFilled = Boolean(vectorProvider) && Boolean(apiKey);

  const intervalValue = resyncingIntervals.find(interval => interval.pattern === syncInterval);

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
    <section className={cn('space-y-10 max-w-[36rem]')}>
      <div className={cn('space-y-8 p-4 border border-mastra-border-1 rounded-lg', { 'opacity-80': isSaved })}>
        <div className="flex justify-between items-center">
          <h2 className={cn('font-medium text-base flex items-center gap-1')}>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">1</div>
            <span className="inline-flex flex-col">
              <span className=" text-lg inline-flex items-center gap-2">
                Vector Store {isSaved ? <Icon name="check-in-circle" className="text-mastra-bg-7 h-3 w-3" /> : null}
              </span>
              <span className="text-xs">Configure your vector store connection</span>
            </span>
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
          <Label className="text-mastra-el-3 justify-between text-xs flex w-full items-center font-medium">
            <p> API Key </p>
            <Button
              type="button"
              size={'xs'}
              disabled={!vectorProvider || isSaved}
              className="text-xs self-end"
              onClick={() => setShow(prev => !prev)}
            >
              {isSaved ? 'show' : show ? 'hide' : 'show'}
            </Button>
          </Label>
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
          </div>
        </div>
      </div>

      <div className={cn('space-y-8 p-4 border border-mastra-border-1 rounded-lg', { 'opacity-50': !isSaved })}>
        <div className="flex items-center justify-between">
          <h2 className={cn('font-medium text-base flex items-center gap-1')}>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">2</div>
            <span className="inline-flex flex-col">
              <span className=" text-lg inline-flex items-center gap-2">
                Select Entities {!isSaved ? <Icon name="lock" className="w-3 h-3" /> : null}
              </span>
              <span className="text-xs">Configure sync interval and entities</span>
            </span>
          </h2>
        </div>
        {entities?.map((ent, index) => (
          <VectorProviderFormIntegration
            key={ent.integration}
            integrationIndex={index}
            integrationName={ent.integration}
            disabled={!isSaved || loading}
          />
        ))}

        <div className="flex flex-col gap-1">
          <Label className="text-gray-400 flex items-center justify-between gap-1 text-xs">
            Sync Interval
            <p>
              *Only works on{' '}
              <Link
                href="https://vercel.com/docs/cron-jobs#cron-expressions"
                className="text-mastra-el-accent hover:underline"
                target="_blank"
              >
                vercel
              </Link>
            </p>
          </Label>

          <Select
            value={syncInterval as unknown as string}
            onValueChange={value => {
              setSyncInterval(value);
            }}
          >
            <SelectTrigger className="w-full h-[34px] text-white bg-mastra-bg-2 border-mastra-bg-4">
              <SelectValue placeholder="Choose sync interval" />
            </SelectTrigger>
            <SelectContent className=" text-white">
              {resyncingIntervals.map(option => (
                <SelectItem key={option.pattern} value={option.pattern}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button
        className={cn('text-white w-full', {
          '!cursor-not-allowed !opacity-50 text-white': !isSaved || !entitiesFilled || loading,
        })}
        size="default"
        type="button"
        disabled={!isSaved || !entitiesFilled || loading}
        onClick={createVectorIndex}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <Spinner className="w-3 h-3" /> Syncing...
          </span>
        ) : (
          <span className="flex items-center gap-3">
            <Icon name="play-circle" />
            Start sync
          </span>
        )}
      </Button>
    </section>
  );
};
