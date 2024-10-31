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
import { Slider } from '@/components/ui/slider';
import Spinner from '@/components/ui/spinner';

import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

import { createPineconeIndex, saveVectorToConfigAction } from '../actions';
import { useVectorFormContext } from '../context/vector-form-context';
import { useVectorProviderExists } from '../hooks/use-vector-provider';

import { VectorProviderFormIntegration } from './vector-provider-form-integration';

const vectorProviders = [{ label: 'PINECONE', value: 'PINECONE' }];

const resyncingIntervals = [
  { label: 'Minute ', desc: 'triggers at 5 minutes past the hour', pattern: '5 * * * *', min: 0, max: 59 },
  {
    label: 'Hour',
    desc: 'triggers every minute, between 05:00 AM and 05:59 AM',
    pattern: '* 5 * * *',
    min: 0,
    max: 23,
  },
  {
    label: 'Day of Month',
    desc: 'triggers every minute, on day 5 of the month',
    pattern: '* * 5 * *',
    min: 1,
    max: 31,
  },
  { label: 'Month', desc: 'triggers every minute, only in May', pattern: '* * * 5 *', min: 1, max: 12 },
  { label: 'Day of Week', desc: 'triggers every minute, only on Friday', pattern: '* * * * 5', min: 0, max: 6 },
];

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
  const [cronInterval, setCronInterval] = useState(5);

  const router = useRouter();

  const { exists, apiKey: envApiKey } = useVectorProviderExists({
    providerName: 'PINECONE',
  });

  const isFilled = Boolean(vectorProvider) && Boolean(apiKey);

  const intervalValue = resyncingIntervals.find(interval => interval.pattern === syncInterval);

  function transformValueToCronValue(cronInterval: number) {}

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
      syncInterval: '',
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
          <Label className="text-gray-400 flex items-center gap-1 text-xs">
            Sync Interval
            <Link
              href="https://vercel.com/docs/cron-jobs#cron-expressions"
              className="text-mastra-el-accent text-[9px] hover:underline"
              target="_blank"
            >
              (vercel cron expresion) :
            </Link>
          </Label>

          <Select value={syncInterval as unknown as string} onValueChange={value => setSyncInterval(value)}>
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
        {syncInterval ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-gray-400 text-xs flex gap-1 items-center">Interval Value</p>
              <span className="bg-mastra-bg-4 px-2 p-1 rounded font-mono text-xs">{cronInterval}</span>
            </div>

            <div className="space-y-6">
              <Slider
                value={[cronInterval]}
                max={intervalValue?.max!}
                disabled={!isSaved}
                min={intervalValue?.min}
                onValueChange={value => setCronInterval(value[0])}
              />

              <div className="rounded-lg bg-muted p-4">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Icon name="clock" className="w-3 h-3" />A value of <span className="text-white">5</span> means: it{' '}
                  {intervalValue?.desc}
                </p>
              </div>
            </div>
          </div>
        ) : null}
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
