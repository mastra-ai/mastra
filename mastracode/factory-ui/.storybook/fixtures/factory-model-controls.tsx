import { ComposerStatusLine } from '@mastra/playground-ui/components/Composer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { ApiConfigProvider } from '../../src/api/config';
import { queryKeys } from '../../src/api/keys';
import type { ModelPackInfo } from '../../src/api/types';
import type { AvailableModelOption } from '../../src/hooks/useAvailableModels';
import { ModelPicker } from '../../src/ui/domains/chat/components/StatusLine/ModelPicker';
import { ModesSelection } from '../../src/ui/domains/chat/components/StatusLine/ModesSelection';
import { ChatConnectionContext } from '../../src/ui/domains/chat/context/ChatConnectionContext';
import { ChatModelsContext } from '../../src/ui/domains/chat/context/ChatModelsContext';
import { ChatModesContext } from '../../src/ui/domains/chat/context/ChatModesContext';
import { ChatSessionContext } from '../../src/ui/domains/chat/context/ChatSessionContext';
import {
  models,
  modes,
  packs,
  packModel,
} from '../../../../packages/playground-ui/.storybook/fixtures/model-picker/models';
import type { ModelControlState } from '../../../../packages/playground-ui/.storybook/fixtures/model-picker/models';

const modelPacks: ModelPackInfo[] = packs.map(pack => ({
  id: pack.id,
  name: pack.name,
  description: '',
  models: { build: packModel(pack.id, 'build'), plan: packModel(pack.id, 'plan'), fast: packModel(pack.id, 'fast') },
  custom: false,
  active: pack.id === 'balanced',
}));

export function FactoryModelControls({
  personal,
  mode,
  onModeChange,
  state,
}: {
  personal: boolean;
  mode: string;
  onModeChange: (mode: string) => void;
  state: ModelControlState;
}) {
  const [selection, setSelection] = useState({ packId: 'balanced', overrides: new Map<string, string>() });
  const [queryClient] = useState(() => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
    const catalog: AvailableModelOption[] = models
      .filter(model => state !== 'unconfigured' || model.id !== packModel('balanced', mode))
      .map(model => ({ ...model, hasApiKey: true }));
    client.setQueryData(queryKeys.availableModels(), catalog);
    return client;
  });
  const modelId = selection.overrides.get(mode) ?? packModel(selection.packId, mode);
  return (
    <ApiConfigProvider baseUrl="">
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/factories/story/user/threads/story']}>
          <Routes>
            <Route
              path="/factories/:factoryId/*"
              element={
                <ChatSessionContext.Provider
                  value={{
                    kind: personal ? 'user' : 'factory',
                    resourceId: 'story',
                    sessionEnabled: state !== 'locked',
                    resourceReady: true,
                    sandboxReady: true,
                    sandboxPreparing: false,
                    resourceEnabled: true,
                    baseUrl: '',
                  }}
                >
                  <ChatConnectionContext.Provider value={{ status: 'ready' }}>
                    <ChatModesContext.Provider
                      value={{
                        modes,
                        activeMode: modes.find(option => option.id === mode),
                        activeModeId: mode,
                        isLoading: false,
                        error: undefined,
                        setMode: async id => onModeChange(id),
                      }}
                    >
                      <ChatModelsContext.Provider
                        value={{
                          activeModelId: state === 'loading' ? undefined : modelId,
                          activeModelPackId: selection.packId,
                          defaultModelPackId: 'balanced',
                          draftModelPackId: undefined,
                          modelPacks,
                          isLoading: state === 'loading',
                          error: undefined,
                          setModel: async id =>
                            setSelection(current => ({
                              ...current,
                              overrides: new Map(current.overrides).set(mode, id),
                            })),
                          setModelPack: async packId => setSelection({ packId, overrides: new Map() }),
                        }}
                      >
                        <ComposerStatusLine>
                          <ModesSelection />
                          <ModelPicker />
                        </ComposerStatusLine>
                      </ChatModelsContext.Provider>
                    </ChatModesContext.Provider>
                  </ChatConnectionContext.Provider>
                </ChatSessionContext.Provider>
              }
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </ApiConfigProvider>
  );
}
