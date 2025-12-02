import { describe, test, expect } from "vitest";
import { DeveloperIndexConfig } from "./deployApi/finishPush.js";
import chalk from "chalk";
import { formatIndex } from "./indexes.js";

describe("formatIndex", () => {
  test("formats database index with multiple fields", () => {
    const databaseIndex: DeveloperIndexConfig = {
      type: "database",
      name: "messages.by_user_and_timestamp",
      fields: ["userId", "timestamp"],
    };

    const result = formatIndex(databaseIndex);

    const expected = `messages.${chalk.bold("by_user_and_timestamp")}   ${chalk.gray(`${chalk.underline("userId")}, ${chalk.underline("timestamp")}`)}`;
    expect(result).toEqual(expected);
  });

  test("formats text index without filter fields", () => {
    const searchIndex: DeveloperIndexConfig = {
      type: "search",
      name: "articles.search_by_content",
      searchField: "content",
      filterFields: [],
    };

    const result = formatIndex(searchIndex);

    const expected = `articles.${chalk.bold("search_by_content")} ${chalk.gray(`${chalk.cyan("(text)")}   ${chalk.underline("content")}`)}`;
    expect(result).toEqual(expected);
  });

  test("formats text index with filter fields", () => {
    const searchIndex: DeveloperIndexConfig = {
      type: "search",
      name: "articles.search_by_content",
      searchField: "content",
      filterFields: ["category", "status"],
    };

    const result = formatIndex(searchIndex);

    const expected = `articles.${chalk.bold("search_by_content")} ${chalk.gray(`${chalk.cyan("(text)")}   ${chalk.underline("content")}, filters on ${chalk.underline("category")}, ${chalk.underline("status")}`)}`;
    expect(result).toEqual(expected);
  });

  test("formats vector index with single filter field", () => {
    const vectorIndex: DeveloperIndexConfig = {
      type: "vector",
      name: "documents.embedding_index",
      dimensions: 1536,
      vectorField: "embedding",
      filterFields: ["userId"],
    };

    const result = formatIndex(vectorIndex);

    const expected = `documents.${chalk.bold("embedding_index")} ${chalk.gray(`${chalk.cyan("(vector)")}   ${chalk.underline("embedding")} (1536 dimensions), filter on ${chalk.underline("userId")}`)}`;
    expect(result).toEqual(expected);
  });

  test("formats vector index with multiple filter fields", () => {
    const vectorIndex: DeveloperIndexConfig = {
      type: "vector",
      name: "documents.embedding_index",
      dimensions: 768,
      vectorField: "embedding",
      filterFields: ["userId", "type", "category"],
    };

    const result = formatIndex(vectorIndex);

    const expected = `documents.${chalk.bold("embedding_index")} ${chalk.gray(`${chalk.cyan("(vector)")}   ${chalk.underline("embedding")} (768 dimensions), filters on ${chalk.underline("userId")}, ${chalk.underline("type")}, ${chalk.underline("category")}`)}`;
    expect(result).toEqual(expected);
  });
});
