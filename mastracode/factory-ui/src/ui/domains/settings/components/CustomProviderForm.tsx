import { Button } from '@mastra/playground-ui/components/Button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@mastra/playground-ui/components/Collapsible';
import { Combobox } from '@mastra/playground-ui/components/Combobox';
import type { ComboboxOption } from '@mastra/playground-ui/components/Combobox';
import { DialogBody, DialogFooter } from '@mastra/playground-ui/components/Dialog';
import { DisclosureChevron } from '@mastra/playground-ui/components/DisclosureChevron';
import { Field, FieldDescription, FieldLabel } from '@mastra/playground-ui/components/Field';
import { Input } from '@mastra/playground-ui/components/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@mastra/playground-ui/components/Select';
import { toast } from '@mastra/playground-ui/components/Toaster';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { IconPlusMedium } from '@mastra/playground-ui/icons/central/IconPlusMedium';
import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import type {
  CustomProviderInfo,
  CustomProviderModelsResult,
  CustomProviderModelTestResult,
  SaveCustomProviderBody,
} from '../../../../api/types';
import {
  refusalCode,
  saveCheckFailure,
  useCheckCustomProvider,
  useSaveCustomProvider,
} from '../../../../hooks/use-custom-providers';
import { ConnectionCheckResult, ModelTestResult, OutdatedResult } from './CustomProviderCheckResult';
import type { ConnectionOutcome } from './CustomProviderCheckResult';
import { CustomProviderHeadersEditor } from './CustomProviderHeadersEditor';
import { CustomProviderModelTest } from './CustomProviderModelTest';
import {
  connectionFields,
  connectionSignature,
  headerDraftProblem,
  headerInputId,
  initialCustomProviderDraft,
  serverHeaderProblemTarget,
} from './custom-provider-draft';
import type { CustomProviderAuthScheme, CustomProviderDraft, HeaderProblem } from './custom-provider-draft';

export interface CustomProviderFormProps {
  provider?: CustomProviderInfo;
  /** Where the provider is saved. Omitted without sign-in, where there is one list. */
  scope?: CustomProviderInfo['scope'];
  requireModels?: boolean;
  onCancel?: () => void;
  onSaved?: (provider: CustomProviderInfo) => void;
}

/** A result and the connection settings it was produced with, so a later edit can mark it out of date. */
interface Tested<Result> {
  signature: string;
  result: Result;
}

/** The fields a save needs filled before anything is sent. */
type RequiredField = 'name' | 'url' | 'models';

/** The fields the form can mark invalid: the required ones, and the API key the server may ask for again. */
type InvalidField = RequiredField | 'apiKey';

const NO_INVALID_FIELDS: ReadonlySet<InvalidField> = new Set();

/** The text of a failed request, for the form's error line. */
function errorMessage(caught: unknown): string {
  return caught instanceof Error ? caught.message : String(caught);
}

/** The server refusals that are about the headers, which live in the collapsible section. */
function headerRefusal(caught: unknown): 'header_refused' | 'header_value_required' | undefined {
  const code = refusalCode(caught);
  return code === 'header_refused' || code === 'header_value_required' ? code : undefined;
}

/** The models offered in the picker: what the endpoint listed, then picks it did not list. */
function modelOptions(models: string[], listed: string[] | undefined, flagUnlisted: boolean): ComboboxOption[] {
  const listedIds = new Set(listed);
  const unlisted = models.filter(id => !listedIds.has(id));
  return [
    ...(listed ?? []).map(id => ({ label: id, value: id })),
    ...unlisted.map(id => ({
      label: id,
      value: id,
      ...(flagUnlisted ? { description: 'Not listed by the endpoint' } : {}),
    })),
  ];
}

/** The label of the button that adds the listed models not picked yet: all of them, or the rest. */
function addListedLabel(unpicked: number, listed: number): string {
  if (unpicked === listed) return `Add all ${listed} listed models`;
  return `Add ${unpicked} more listed model${unpicked === 1 ? '' : 's'}`;
}

/** A connection test result as the form shows it. Only a refused save offers Save anyway. */
function connectionOutcome(models: CustomProviderModelsResult): ConnectionOutcome {
  return models.ok
    ? { ok: true, models: models.models, latencyMs: models.latencyMs }
    : { ok: false, failure: models.failure, refusedSave: false };
}

/**
 * Adds or edits a custom OpenAI-compatible endpoint inside a dialog: renders the dialog's body and footer. Test
 * lists the endpoint's models without saving, Test & save refuses to save an endpoint that fails the test, and
 * Save anyway then saves it untested.
 */
export function CustomProviderForm({
  provider,
  scope,
  requireModels = false,
  onCancel,
  onSaved,
}: CustomProviderFormProps) {
  const connectionCheck = useCheckCustomProvider();
  const modelCheck = useCheckCustomProvider();
  const checkedSave = useSaveCustomProvider();
  const uncheckedSave = useSaveCustomProvider();
  const nameInput = useRef<HTMLInputElement>(null);
  const urlInput = useRef<HTMLInputElement>(null);
  const apiKeyInput = useRef<HTMLInputElement>(null);
  const modelsField = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<CustomProviderDraft>(() => initialCustomProviderDraft(provider));
  const [error, setError] = useState<string>();
  const [invalid, setInvalid] = useState(NO_INVALID_FIELDS);
  const [connection, setConnection] = useState<Tested<ConnectionOutcome>>();
  // Kept apart from `connection`: a later failing test must not take away the ids a passing one listed.
  const [listing, setListing] = useState<Tested<string[]>>();
  const [modelTest, setModelTest] = useState<Tested<CustomProviderModelTestResult> & { model: string }>();
  const [chosenTestModel, setChosenTestModel] = useState<string>();
  // Collapsed for the common case; open when the provider already uses what it holds.
  const [advancedOpen, setAdvancedOpen] = useState(() => draft.authScheme !== 'bearer' || draft.headers.length > 0);

  const signature = connectionSignature(draft);
  const connectionOutdated = connection !== undefined && connection.signature !== signature;
  const listedModels = listing?.result;
  // An outdated listing still offers its IDs as options, but may come from another URL or key, so it neither
  // flags picks as unlisted nor adds its IDs in bulk.
  const listingCurrent = listing !== undefined && listing.signature === signature;
  const unlistedPicks = listedModels && listingCurrent ? draft.models.filter(id => !listedModels.includes(id)) : [];
  const unpickedListed = listedModels && listingCurrent ? listedModels.filter(id => !draft.models.includes(id)) : [];
  const testModel = chosenTestModel && draft.models.includes(chosenTestModel) ? chosenTestModel : draft.models[0];
  // A reply belongs to the model it came from; picking another one hides it.
  const shownModelTest = modelTest && modelTest.model === testModel ? modelTest : undefined;
  const modelTestOutdated = shownModelTest !== undefined && shownModelTest.signature !== signature;
  const saving = checkedSave.isPending || uncheckedSave.isPending;
  const busy = saving || connectionCheck.isPending || modelCheck.isPending;
  const offerUncheckedSave = connection?.result.ok === false && connection.result.refusedSave && !connectionOutdated;
  const target = { ...(provider ? { previousId: provider.id } : {}), ...(scope ? { scope } : {}) };

  /** Applies an edit to the draft, and clears the invalid mark of each required field it fills in. */
  const update = (patch: Partial<CustomProviderDraft>) => {
    setDraft(current => ({ ...current, ...patch }));
    if (invalid.size > 0) setInvalid(new Set([...invalid].filter(field => !(field in patch))));
  };

  /**
   * Shows a header problem. The headers sit in a section that may be collapsed, so it is opened, rendered at
   * once, and the input the problem is about takes focus.
   */
  const showHeaderProblem = (problem: HeaderProblem) => {
    setError(problem.message);
    flushSync(() => setAdvancedOpen(true));
    if (problem.target) document.getElementById(headerInputId(problem.target))?.focus();
  };

  /**
   * Shows a failed request on the error line. A refusal about the headers or the API key also marks the control
   * it is about and moves focus there.
   */
  const showRequestError = (caught: unknown) => {
    const message = errorMessage(caught);
    const code = headerRefusal(caught);
    if (code) {
      showHeaderProblem({ message, target: serverHeaderProblemTarget(code, message, draft.headers) });
      return;
    }
    setError(message);
    // The saved key is only kept on the same origin, so a URL that moved needs the key typed again.
    if (refusalCode(caught) === 'api_key_required') {
      setInvalid(new Set(['apiKey']));
      apiKeyInput.current?.focus();
    }
  };

  /** Checks what a test needs before it calls the endpoint. Reports the problem and returns false when there is one. */
  const connectionReady = (): boolean => {
    if (!draft.url.trim()) {
      setError('Enter the base URL first.');
      setInvalid(new Set(['url']));
      urlInput.current?.focus();
      return false;
    }
    const problem = headerDraftProblem(draft.headers);
    if (problem) {
      showHeaderProblem(problem);
      return false;
    }
    setError(undefined);
    return true;
  };

  /** Records the listing a test returned: the outcome to show and, when it passed, the IDs to offer. */
  const recordListing = (models: CustomProviderModelsResult) => {
    setConnection({ signature, result: connectionOutcome(models) });
    if (models.ok) setListing({ signature, result: models.models });
  };

  /** Lists the endpoint's models with the draft settings. The result keeps the settings it was produced with. */
  const test = async () => {
    if (!connectionReady()) return;
    // A retry that is refused or fails must not sit next to the previous result.
    setConnection(undefined);
    try {
      const response = await connectionCheck.mutateAsync({ ...connectionFields(draft), ...target });
      recordListing(response.check.models);
    } catch (caught) {
      showRequestError(caught);
    }
  };

  /**
   * Sends the test message to the chosen model with the draft settings. The server lists the models in the same
   * call, so a missing reply is explained by the listing when that failed too.
   */
  const sendTestMessage = async () => {
    if (!testModel || !connectionReady()) return;
    // A retry without a reply must not leave an earlier reply or listing on screen.
    setConnection(undefined);
    setModelTest(undefined);
    try {
      const response = await modelCheck.mutateAsync({ ...connectionFields(draft), ...target, model: testModel });
      const { models, reply } = response.check;
      recordListing(models);
      if (reply) setModelTest({ signature, model: testModel, result: reply });
      else if (models.ok) setError('The endpoint did not answer the test message.');
    } catch (caught) {
      showRequestError(caught);
    }
  };

  /** Checks the fields a save needs. Marks the empty ones, focuses the first, and returns false when any is empty. */
  const requiredFieldsFilled = (): boolean => {
    const missing = new Set<RequiredField>();
    if (!draft.name.trim()) missing.add('name');
    if (!draft.url.trim()) missing.add('url');
    if (missing.size > 0) {
      setError('Name and URL are required.');
      setInvalid(missing);
      (missing.has('name') ? nameInput : urlInput).current?.focus();
      return false;
    }
    if (requireModels && draft.models.length === 0) {
      setError('At least one model is required.');
      setInvalid(new Set(['models']));
      modelsField.current?.querySelector('input')?.focus();
      return false;
    }
    setInvalid(NO_INVALID_FIELDS);
    return true;
  };

  /** Saves the draft. With `check` the server tests the connection first and saves nothing if the test fails. */
  const save = async (check: boolean) => {
    if (!requiredFieldsFilled()) return;
    const problem = headerDraftProblem(draft.headers);
    if (problem) {
      showHeaderProblem(problem);
      return;
    }
    setError(undefined);

    const body: SaveCustomProviderBody = {
      name: draft.name.trim(),
      models: draft.models,
      ...connectionFields(draft),
      ...target,
      ...(check ? { check: true } : {}),
    };
    try {
      const result = await (check ? checkedSave : uncheckedSave).mutateAsync(body);
      // Worded from the saved row: an edit racing the save can leave a different check on it than was asked for.
      toast.success(
        result.provider.lastCheck?.ok
          ? `Saved ${result.provider.name}. The connection test passed.`
          : `Saved ${result.provider.name} without a passing connection test.`,
      );
      onSaved?.(result.provider);
    } catch (caught) {
      // A failed test is shown like one from Test, with the option to save without it.
      const failure = check ? saveCheckFailure(caught) : undefined;
      if (failure) setConnection({ signature, result: { ok: false, failure, refusedSave: true } });
      else showRequestError(caught);
    }
  };

  return (
    <>
      <DialogBody>
        <Field invalid={invalid.has('name')}>
          <FieldLabel>Name</FieldLabel>
          <Input
            ref={nameInput}
            placeholder="e.g. my-llm"
            value={draft.name}
            onChange={event => update({ name: event.target.value })}
            autoFocus
          />
        </Field>
        <Field invalid={invalid.has('url')}>
          <FieldLabel>Base URL</FieldLabel>
          <Input
            ref={urlInput}
            placeholder="https://api.example.com/v1"
            value={draft.url}
            onChange={event => update({ url: event.target.value })}
          />
        </Field>
        <Field invalid={invalid.has('apiKey')}>
          <FieldLabel>API key {provider ? '(leave blank to keep, unless the host changes)' : '(optional)'}</FieldLabel>
          <Input
            ref={apiKeyInput}
            type="password"
            placeholder="Paste API key"
            autoComplete="off"
            value={draft.apiKey}
            onChange={event => update({ apiKey: event.target.value })}
          />
        </Field>
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger
            render={
              <Button variant="ghost" size="sm" className="w-full justify-between" iconEnd={<DisclosureChevron />}>
                Auth scheme and headers
              </Button>
            }
          />
          <CollapsibleContent className="flex flex-col gap-4 pt-2">
            <Field>
              <FieldLabel>Auth scheme</FieldLabel>
              <Select<CustomProviderAuthScheme>
                value={draft.authScheme}
                onValueChange={authScheme => update({ authScheme })}
              >
                <SelectTrigger aria-label="Auth scheme">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bearer">Bearer token (Authorization header)</SelectItem>
                  <SelectItem value="x-api-key">x-api-key header</SelectItem>
                </SelectContent>
              </Select>
              <FieldDescription>How the API key is sent.</FieldDescription>
            </Field>
            <CustomProviderHeadersEditor headers={draft.headers} onChange={headers => update({ headers })} />
          </CollapsibleContent>
        </Collapsible>
        <Field ref={modelsField} invalid={invalid.has('models')}>
          <FieldLabel>Models</FieldLabel>
          <Combobox
            multiple
            allowCustomValue
            options={modelOptions(draft.models, listedModels, listingCurrent)}
            value={draft.models}
            onValueChange={models => update({ models })}
            placeholder="Type a model ID"
            // Only shown with nothing typed: typed text is always offered as an option of its own.
            emptyText="Type a model ID and press Enter to add it."
          />
          {unlistedPicks.length > 0 && (
            <FieldDescription>Not listed by the endpoint: {unlistedPicks.join(', ')}.</FieldDescription>
          )}
          {!listingCurrent && (
            <FieldDescription>Run Test to list the endpoint's models, or type an ID.</FieldDescription>
          )}
          {unpickedListed.length > 0 && (
            <div>
              <Button
                variant="ghost"
                size="sm"
                icon={<IconPlusMedium />}
                onClick={() => update({ models: [...draft.models, ...unpickedListed] })}
              >
                {addListedLabel(unpickedListed.length, listedModels?.length ?? 0)}
              </Button>
            </div>
          )}
        </Field>
        {testModel && (
          <CustomProviderModelTest
            models={draft.models}
            model={testModel}
            onModelChange={setChosenTestModel}
            onSend={() => void sendTestMessage()}
            sending={modelCheck.isPending}
            disabled={busy}
          />
        )}
        {shownModelTest && !modelTestOutdated && (
          <ModelTestResult model={shownModelTest.model} result={shownModelTest.result} />
        )}
        {connection && !connectionOutdated && <ConnectionCheckResult outcome={connection.result} />}
        {(modelTestOutdated || connectionOutdated) && <OutdatedResult />}
      </DialogBody>
      {error && (
        <Txt as="p" variant="caption" className="text-destructive-foreground px-5 pt-2" role="alert">
          {error}
        </Txt>
      )}
      <DialogFooter>
        {onCancel && (
          <Button variant="ghost" disabled={saving} onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          loading={connectionCheck.isPending}
          disabled={busy && !connectionCheck.isPending}
          onClick={() => void test()}
        >
          Test
        </Button>
        {offerUncheckedSave && (
          <Button
            loading={uncheckedSave.isPending}
            disabled={busy && !uncheckedSave.isPending}
            onClick={() => void save(false)}
          >
            Save anyway
          </Button>
        )}
        <Button
          variant="primary"
          loading={checkedSave.isPending}
          disabled={busy && !checkedSave.isPending}
          onClick={() => void save(true)}
        >
          Test &amp; save
        </Button>
      </DialogFooter>
    </>
  );
}
