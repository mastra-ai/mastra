import type { InMemoryDB } from '../inmemory-db';
import { KNOWLEDGE_STORAGE_CONTRACT_VERSION, KNOWLEDGE_STORAGE_SCHEMA_VERSION, KnowledgeStorage } from './base';
import type { KnowledgePageStore } from './pages';
import { InMemoryKnowledgePageStore } from './pages-inmemory';

export class InMemoryKnowledgeStorage extends KnowledgeStorage {
  readonly #pageStore = new InMemoryKnowledgePageStore();

  // Schema-4 page store.
  override materializeScope(
    input: Parameters<KnowledgePageStore['materializeScope']>[0],
  ): ReturnType<KnowledgePageStore['materializeScope']> {
    return this.#pageStore.materializeScope(input);
  }
  override getScopesByAddress(
    input: Parameters<KnowledgePageStore['getScopesByAddress']>[0],
  ): ReturnType<KnowledgePageStore['getScopesByAddress']> {
    return this.#pageStore.getScopesByAddress(input);
  }
  override listChildScopes(
    input: Parameters<KnowledgePageStore['listChildScopes']>[0],
  ): ReturnType<KnowledgePageStore['listChildScopes']> {
    return this.#pageStore.listChildScopes(input);
  }
  override getPage(input: Parameters<KnowledgePageStore['getPage']>[0]): ReturnType<KnowledgePageStore['getPage']> {
    return this.#pageStore.getPage(input);
  }
  override getPageByKey(
    input: Parameters<KnowledgePageStore['getPageByKey']>[0],
  ): ReturnType<KnowledgePageStore['getPageByKey']> {
    return this.#pageStore.getPageByKey(input);
  }
  override findPagesByName(
    input: Parameters<KnowledgePageStore['findPagesByName']>[0],
  ): ReturnType<KnowledgePageStore['findPagesByName']> {
    return this.#pageStore.findPagesByName(input);
  }
  override listChildPages(
    input: Parameters<KnowledgePageStore['listChildPages']>[0],
  ): ReturnType<KnowledgePageStore['listChildPages']> {
    return this.#pageStore.listChildPages(input);
  }
  override listPages(
    input: Parameters<KnowledgePageStore['listPages']>[0],
  ): ReturnType<KnowledgePageStore['listPages']> {
    return this.#pageStore.listPages(input);
  }
  override createPage(
    input: Parameters<KnowledgePageStore['createPage']>[0],
  ): ReturnType<KnowledgePageStore['createPage']> {
    return this.#pageStore.createPage(input);
  }
  override updatePage(
    input: Parameters<KnowledgePageStore['updatePage']>[0],
  ): ReturnType<KnowledgePageStore['updatePage']> {
    return this.#pageStore.updatePage(input);
  }
  override movePage(input: Parameters<KnowledgePageStore['movePage']>[0]): ReturnType<KnowledgePageStore['movePage']> {
    return this.#pageStore.movePage(input);
  }
  override mergePages(
    input: Parameters<KnowledgePageStore['mergePages']>[0],
  ): ReturnType<KnowledgePageStore['mergePages']> {
    return this.#pageStore.mergePages(input);
  }
  override deletePage(
    input: Parameters<KnowledgePageStore['deletePage']>[0],
  ): ReturnType<KnowledgePageStore['deletePage']> {
    return this.#pageStore.deletePage(input);
  }
  override getNote(input: Parameters<KnowledgePageStore['getNote']>[0]): ReturnType<KnowledgePageStore['getNote']> {
    return this.#pageStore.getNote(input);
  }
  override listNotes(
    input: Parameters<KnowledgePageStore['listNotes']>[0],
  ): ReturnType<KnowledgePageStore['listNotes']> {
    return this.#pageStore.listNotes(input);
  }
  override listNotesMentioning(
    input: Parameters<KnowledgePageStore['listNotesMentioning']>[0],
  ): ReturnType<KnowledgePageStore['listNotesMentioning']> {
    return this.#pageStore.listNotesMentioning(input);
  }
  override addNote(input: Parameters<KnowledgePageStore['addNote']>[0]): ReturnType<KnowledgePageStore['addNote']> {
    return this.#pageStore.addNote(input);
  }
  override restampNote(
    input: Parameters<KnowledgePageStore['restampNote']>[0],
  ): ReturnType<KnowledgePageStore['restampNote']> {
    return this.#pageStore.restampNote(input);
  }
  override removeNote(
    input: Parameters<KnowledgePageStore['removeNote']>[0],
  ): ReturnType<KnowledgePageStore['removeNote']> {
    return this.#pageStore.removeNote(input);
  }
  override restoreNote(
    input: Parameters<KnowledgePageStore['restoreNote']>[0],
  ): ReturnType<KnowledgePageStore['restoreNote']> {
    return this.#pageStore.restoreNote(input);
  }
  override searchPages(
    input: Parameters<KnowledgePageStore['searchPages']>[0],
  ): ReturnType<KnowledgePageStore['searchPages']> {
    return this.#pageStore.searchPages(input);
  }
  override listPageActivity(
    input: Parameters<KnowledgePageStore['listPageActivity']>[0],
  ): ReturnType<KnowledgePageStore['listPageActivity']> {
    return this.#pageStore.listPageActivity(input);
  }
  override addPinAudience(
    input: Parameters<KnowledgePageStore['addPinAudience']>[0],
  ): ReturnType<KnowledgePageStore['addPinAudience']> {
    return this.#pageStore.addPinAudience(input);
  }
  override removePinAudience(
    input: Parameters<KnowledgePageStore['removePinAudience']>[0],
  ): ReturnType<KnowledgePageStore['removePinAudience']> {
    return this.#pageStore.removePinAudience(input);
  }
  override listPins(input: Parameters<KnowledgePageStore['listPins']>[0]): ReturnType<KnowledgePageStore['listPins']> {
    return this.#pageStore.listPins(input);
  }

  constructor(_config: { db: InMemoryDB }) {
    super();
  }

  override getCapabilities() {
    return {
      contractVersion: KNOWLEDGE_STORAGE_CONTRACT_VERSION,
      schemaVersion: KNOWLEDGE_STORAGE_SCHEMA_VERSION,
      supportsSchemaInspection: true,
      supportsExplicitReset: true,
    } as const;
  }

  override async inspectSchema() {
    return { status: 'compatible', schemaVersion: KNOWLEDGE_STORAGE_SCHEMA_VERSION } as const;
  }

  override async dangerouslyReset(): Promise<void> {
    await this.dangerouslyClearAll();
  }

  async dangerouslyClearAll(): Promise<void> {
    this.#pageStore.clear();
  }
}
