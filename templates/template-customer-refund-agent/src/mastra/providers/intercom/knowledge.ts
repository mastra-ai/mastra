import type {
  KnowledgeDocumentRef,
  KnowledgeEvidence,
  KnowledgeProvider,
  ProviderBinding,
} from "../contracts";
import { IntercomClient } from "./client";
import type { IntercomDevelopmentConfig } from "./config";

type Article = Record<string, unknown>;
const MAX_ARTICLE_PAGES = 50;
const ARTICLE_PAGE_SIZE = 50;
const MAX_ARTICLE_CURSOR_LENGTH = 1_024;

type Cursor = {
  starting_after: string;
  per_page: number;
};

type ArticlesPage = {
  data?: Article[];
  pages?: {
    next?: Cursor | null;
    page?: number;
    total_pages?: number;
  } | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPublished(article: Article) {
  return article.state === "published";
}
function articleEvidence(article: Article): KnowledgeEvidence {
  if (!isPublished(article))
    throw new Error("Intercom article is not published.");
  const id = String(article.id ?? "");
  const body =
    typeof article.body === "string"
      ? article.body
      : typeof article.description === "string"
        ? article.description
        : "";
  if (!id || !body) throw new Error("Intercom article lacks an id or body.");
  const updated = Number(article.updated_at ?? article.created_at ?? 0);
  if (!Number.isFinite(updated) || updated <= 0)
    throw new Error("Intercom article lacks an update timestamp.");
  return {
    title:
      typeof article.title === "string"
        ? article.title
        : `Intercom article ${id}`,
    text: body,
    source: `intercom:article:${id}`,
    version: String(updated),
    effectiveAt: new Date(updated * 1_000).toISOString(),
    score: 1,
  };
}

export class IntercomKnowledgeProvider implements KnowledgeProvider {
  readonly kind = "intercom" as const;
  constructor(
    private readonly config: IntercomDevelopmentConfig,
    private readonly client = new IntercomClient(config),
  ) {}
  private assert(binding: ProviderBinding) {
    if (
      !this.config.knowledgeEnabled ||
      binding.providerKind !== "intercom" ||
      binding.tenantId !== this.config.tenantId ||
      binding.providerAccountId !== this.config.accountId
    )
      throw new Error(
        "Intercom knowledge synchronization is not enabled for this binding.",
      );
  }
  private articlePagePath(cursor?: Cursor) {
    const target = new URL("/articles", `${this.config.apiBaseUrl}/`);
    if (target.origin !== this.config.apiBaseUrl)
      throw new Error("Intercom article pagination destination is invalid.");
    target.searchParams.set(
      "per_page",
      String(cursor?.per_page ?? ARTICLE_PAGE_SIZE),
    );
    if (cursor)
      target.searchParams.set("starting_after", cursor.starting_after);
    return `${target.pathname}${target.search}`;
  }
  private parseNextCursor(next: unknown): Cursor {
    if (!isRecord(next))
      throw new Error(
        "Intercom article pagination returned a malformed cursor.",
      );
    const startingAfter = next.starting_after;
    const perPage = next.per_page;
    if (
      typeof startingAfter !== "string" ||
      startingAfter.trim().length === 0 ||
      startingAfter.length > MAX_ARTICLE_CURSOR_LENGTH ||
      typeof perPage !== "number" ||
      !Number.isSafeInteger(perPage) ||
      perPage < 1 ||
      perPage > ARTICLE_PAGE_SIZE
    )
      throw new Error(
        "Intercom article pagination returned a malformed cursor.",
      );
    return { starting_after: startingAfter, per_page: perPage };
  }
  private async articles() {
    const articles: Article[] = [];
    let path = this.articlePagePath();
    const visited = new Set<string>();
    for (let page = 0; page < MAX_ARTICLE_PAGES; page += 1) {
      if (visited.has(path))
        throw new Error("Intercom article pagination repeated a page.");
      visited.add(path);
      const result = await this.client.request<ArticlesPage>(path, {
        method: "GET",
      });
      if (!Array.isArray(result.data))
        throw new Error("Intercom article pagination response is malformed.");
      if (result.pages === null) {
        articles.push(...result.data.filter(isPublished));
        return articles;
      }
      if (!isRecord(result.pages))
        throw new Error("Intercom article pagination response is malformed.");
      const currentPage = result.pages.page;
      const totalPages = result.pages.total_pages;
      const next = result.pages.next;
      const terminalEmptyPage =
        page === 0 &&
        result.data.length === 0 &&
        currentPage === 1 &&
        totalPages === 0 &&
        (next === undefined || next === null);
      if (
        typeof currentPage !== "number" ||
        typeof totalPages !== "number" ||
        !Number.isSafeInteger(currentPage) ||
        !Number.isSafeInteger(totalPages) ||
        currentPage < 1 ||
        (totalPages < currentPage && !terminalEmptyPage)
      )
        throw new Error("Intercom article pagination response is malformed.");
      if (terminalEmptyPage) return articles;
      articles.push(...result.data.filter(isPublished));
      if (next !== undefined && next !== null) {
        if (currentPage >= totalPages)
          throw new Error("Intercom article pagination response is malformed.");
        path = this.articlePagePath(this.parseNextCursor(next));
        continue;
      }
      if (currentPage < totalPages)
        throw new Error("Intercom article pagination is incomplete.");
      return articles;
    }
    throw new Error(
      `Intercom article pagination exceeded ${MAX_ARTICLE_PAGES} pages.`,
    );
  }
  async listChanged(
    binding: ProviderBinding,
    since?: string,
  ): Promise<KnowledgeDocumentRef[]> {
    this.assert(binding);
    const threshold = since ? Date.parse(since) : 0;
    return (await this.articles())
      .map(articleEvidence)
      .filter((article) => Date.parse(article.effectiveAt ?? "") > threshold)
      .map((article) => ({
        source: article.source,
        version: article.version,
        changedAt: article.effectiveAt!,
      }));
  }
  async fetchDocument(binding: ProviderBinding, source: string) {
    this.assert(binding);
    const id = source.replace(/^intercom:article:/, "");
    const article = await this.client.request<Article>(
      `/articles/${encodeURIComponent(id)}`,
      { method: "GET" },
    );
    return isPublished(article) ? articleEvidence(article) : undefined;
  }
  async search(binding: ProviderBinding, query: string, topK: number) {
    this.assert(binding);
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    return (await this.articles())
      .map(articleEvidence)
      .filter((article) =>
        terms.some((term) =>
          `${article.title} ${article.text}`.toLowerCase().includes(term),
        ),
      )
      .slice(0, topK);
  }
}
