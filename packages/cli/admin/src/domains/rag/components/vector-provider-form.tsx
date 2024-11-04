'use client';

import lodash from 'lodash';
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

import { createPineconeIndex, saveVectorToConfigAction, updatePineconeIndex } from '../actions';
import { useVectorFormContext } from '../context/vector-form-context';
import { useVectorProviderExists } from '../hooks/use-vector-provider';
import { VectorEntity } from '../types';

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

export const VectorProviderForm = ({
  source,
  name,
  indexId,
  entity,
}: {
  source?: 'create' | 'edit';
  indexId?: string;
  name?: string;
  entity?: VectorEntity;
}) => {
  const { apiKey, setApiKey, vectorProvider, setVectorProvider, indexName, setIndexName, setEntities, entities } =
    useVectorFormContext();
  const [show, setShow] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncInterval, setSyncInterval] = useState<string | undefined>('0');
  const [isSavedName, setIsSavedName] = useState(false);
  const [showBanner, setShowBanner] = useState(true);
  const router = useRouter();

  const { exists, apiKey: envApiKey } = useVectorProviderExists({
    providerName: 'PINECONE',
  });

  const isEdit = source === 'edit';

  useEffect(() => {
    if (isEdit && name) {
      setIndexName(name);
      setIsSavedName(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, name]);

  useEffect(() => {
    if (entity) {
      // should we do it here?
      setEntities([entity]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entity]);

  const isFilled = Boolean(vectorProvider) && Boolean(apiKey);

  useEffect(() => {
    if (envApiKey) {
      setApiKey(envApiKey);
    }
  }, [envApiKey]);

  type Response =
    | {
        ok: true;
        data: unknown;
      }
    | {
        ok: false;
        error: string;
      };

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

    if (isEdit) {
      toast.promise<Response>({
        myPromise: () =>
          updatePineconeIndex({
            id: indexId,
            vectorEntities: entities,
            syncInterval,
            indexName: indexName,
          }),
        onSuccess(data) {
          if (data.ok) {
            router.push('/rag');
            setLoading(false);
          }
        },
        onError(err) {
          if (!err.ok) {
            setLoading(false);
          }
        },
        loadingMessage: 'Resyncing index',
        errorMessage: 'Could not resync',
        successMessage: 'Resync successful',
        options: {
          position: 'top-center',
        },
      });

      return;
    }

    const response = await createPineconeIndex({
      name: lodash.kebabCase(indexName),
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
      {isEdit && showBanner ? (
        <div className="rounded-lg flex justify-between items-center bg-muted p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Icon name="info" className="w-3 text-orange-400 h-3" />
            In edit mode, you can only edit the sync interval and entities
          </p>
          <button
            onClick={() => setShowBanner(false)}
            type="button"
            className="flex items-center w-5 h-5 rounded-lg justify-center bg-mastra-bg-5"
          >
            <Icon name="cancel" className="w-3 h-3" />
          </button>
        </div>
      ) : null}
      <div className={cn('space-y-8 p-4 border border-mastra-border-1 rounded-lg', { 'opacity-50': isSaved })}>
        <div className="flex justify-between items-center">
          <h2 className="font-medium text-base flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">1</div>
            <span className="inline-flex flex-col">
              <span className=" text-lg inline-flex items-center gap-2">
                Vector Store {isSaved ? <Icon name="check-in-circle" className="text-mastra-bg-7 h-3 w-3" /> : null}
              </span>
              <span className="text-xs">Configure your vector store connection</span>
            </span>
          </h2>
          {isEdit ? null : (
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
          )}
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

      <div className={cn('space-y-8 p-4 border border-mastra-border-1 rounded-lg', { 'opacity-50': isSavedName })}>
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-base flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">2</div>
            <span className="inline-flex flex-col">
              <span className=" text-lg inline-flex items-center gap-2">
                Create an Index{' '}
                {!isSaved ? (
                  <Icon name="lock" className="w-3 h-3" />
                ) : (
                  <Icon name="check-in-circle" className="text-mastra-bg-7 h-3 w-3" />
                )}
              </span>
              <span className="text-xs">Configure index name</span>
            </span>
          </h2>
          {isEdit ? null : (
            <Button
              className={cn('opacity-100', { ' !cursor-not-allowed opacity-50': !isSaved })}
              variant="outline"
              size="xs"
              type="button"
              disabled={!isSaved}
              onClick={() => setIsSavedName(prev => !prev)}
            >
              {isSavedName ? 'Edit' : 'Save'}
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-gray-400 flex flex-col items-start gap-1 text-xs">
            <p>Name</p>
            <Input
              type="text"
              className="placeholder:text-xs w-full py-5 bg-white/5 overflow-ellipsis"
              placeholder={''}
              autoComplete="false"
              autoCorrect="false"
              onChange={e => setIndexName(e.target.value)}
              value={indexName}
              disabled={!vectorProvider || isSavedName}
            />
          </Label>
        </div>
      </div>

      <div
        className={cn('space-y-8 p-4 border border-mastra-border-1 rounded-lg', { 'opacity-50': !isSaved || loading })}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-base flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">3</div>
            <span className="inline-flex flex-col">
              <span className=" text-lg inline-flex items-center gap-2">
                Select Entities {!isSaved ? <Icon name="lock" className="w-3 h-3" /> : null}
              </span>
              <span className="text-xs">Configure sync interval and select entities to put in the index</span>
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
        disabled={!isSaved || !indexName || !entitiesFilled || loading}
        onClick={createVectorIndex}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <Spinner className="w-3 h-3" /> Syncing...
          </span>
        ) : (
          <span className="flex items-center gap-3">
            <Icon name="play-circle" />
            {isEdit ? 'Resync' : 'Create sync'}
          </span>
        )}
      </Button>
    </section>
  );
};
