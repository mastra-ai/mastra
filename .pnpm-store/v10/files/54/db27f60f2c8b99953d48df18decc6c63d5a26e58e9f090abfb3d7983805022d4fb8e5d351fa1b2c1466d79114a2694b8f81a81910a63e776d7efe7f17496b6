import outdent from "outdent";

import parse from "./";

describe("parsing a changeset", () => {
  it("should parse a changeset", () => {
    const changesetMd = outdent`---
    "cool-package": minor
    ---

    Nice simple summary
    `;

    const changeset = parse(changesetMd);
    expect(changeset).toEqual({
      releases: [{ name: "cool-package", type: "minor" }],
      summary: "Nice simple summary",
    });
  });
  it("should parse major, minor, and patch changes", () => {
    const changesetMd = outdent`---
    "cool-package": minor
    "cool-package2": major
    "cool-package3": patch
    ---

    Nice simple summary
    `;

    const changeset = parse(changesetMd);
    expect(changeset).toEqual({
      releases: [
        { name: "cool-package", type: "minor" },
        { name: "cool-package2", type: "major" },
        { name: "cool-package3", type: "patch" },
      ],
      summary: "Nice simple summary",
    });
  });
  it("should parse a changeset with a scoped package", () => {
    const changesetMd = outdent`---
    "@cool/package": minor
    ---

    Nice simple summary
    `;

    const changeset = parse(changesetMd);
    expect(changeset).toEqual({
      releases: [{ name: "@cool/package", type: "minor" }],
      summary: "Nice simple summary",
    });
  });
  it("should parse a changeset with multiline summary", () => {
    const expectedSummary = outdent`Let us go then you and I,
    When the evening is spread out against the sky
    Like a patient, etherized upon a table.

    - The Lovesong of J Alfred Prufrock, T. S. Eliot`;

    const changesetMd = outdent`---
    "cool-package": minor
    ---

    Let us go then you and I,
    When the evening is spread out against the sky
    Like a patient, etherized upon a table.

    - The Lovesong of J Alfred Prufrock, T. S. Eliot
    `;

    const changeset = parse(changesetMd);
    expect(changeset).toEqual({
      releases: [{ name: "cool-package", type: "minor" }],
      summary: expectedSummary,
    });
  });
  it("should parse a changeset with multiple packages and multiline summary", () => {
    const expectedSummary = outdent`Let us go then you and I,
    When the evening is spread out against the sky
    Like a patient, etherized upon a table.

    - The Lovesong of J Alfred Prufrock, T. S. Eliot`;

    const changesetMd = outdent`---
    "cool-package": minor
    "best-package": patch
    ---

    Let us go then you and I,
    When the evening is spread out against the sky
    Like a patient, etherized upon a table.

    - The Lovesong of J Alfred Prufrock, T. S. Eliot
    `;

    const changeset = parse(changesetMd);
    expect(changeset).toEqual({
      releases: [
        { name: "cool-package", type: "minor" },
        { name: "best-package", type: "patch" },
      ],
      summary: expectedSummary,
    });
  });
  it("should be fine if a packageName includes ---", () => {
    const changesetMd = outdent`---
    "cool---package": minor
    ---

    Nice simple summary
    `;

    const changeset = parse(changesetMd);
    expect(changeset).toEqual({
      releases: [{ name: "cool---package", type: "minor" }],
      summary: "Nice simple summary",
    });
  });
  it("should be fine if the summary body includes ---", () => {
    const expectedSummary = outdent`---
    Nice simple summary---that has this`;

    const changesetMd = outdent`---
    "cool-package": minor
    ---

    ---
    Nice simple summary---that has this

    `;

    const changeset = parse(changesetMd);
    expect(changeset).toEqual({
      releases: [{ name: "cool-package", type: "minor" }],
      summary: expectedSummary,
    });
  });
  it("should be fine if the summary body is completely empty and there is no trailing whitespace", () => {
    const changesetMd = outdent`---
    "cool-package": minor
    ---`;

    const changeset = parse(changesetMd);
    expect(changeset).toEqual({
      releases: [{ name: "cool-package", type: "minor" }],
      summary: "",
    });
  });
  it("should be fine if there is no summary body and the frontmatter has some trailing whitespace", () => {
    const changesetMd = outdent`---
    "cool-package": minor
    --- `;

    const changeset = parse(changesetMd);
    expect(changeset).toEqual({
      releases: [{ name: "cool-package", type: "minor" }],
      summary: "",
    });
  });
  it("should be fine if the changeset is empty", () => {
    const changesetMd = outdent`---
    ---

    `;

    const changeset = parse(changesetMd);
    expect(changeset).toEqual({
      releases: [],
      summary: "",
    });
  });
  it("should be fine if the changeset is empty and without any trailing whitespace", () => {
    const changeset = parse(`---\n---`);
    expect(changeset).toEqual({
      releases: [],
      summary: "",
    });
  });
  it("should be fine if the frontmatter is followed by a whitespace on the same line", () => {
    const changesetMd = outdent`---
    "cool-package": minor
    ---${
      "  " /* this prevents auto-formatters from removing the trailing whitespace */
    }

    Nice simple summary
    `;

    const changeset = parse(changesetMd);
    expect(changeset).toEqual({
      releases: [{ name: "cool-package", type: "minor" }],
      summary: "Nice simple summary",
    });
  });
  it("should be fine when md contains Windows new lines", () => {
    const changesetMd = outdent`---
    "cool-package": minor
    "best-package": patch
    ---

    Nice simple summary
    `
      .split("\n")
      .join("\r\n");

    const changeset = parse(changesetMd);
    expect(changeset).toEqual({
      releases: [
        { name: "cool-package", type: "minor" },
        { name: "best-package", type: "patch" },
      ],
      summary: "Nice simple summary",
    });
  });
  it("should throw if the frontmatter is followed by non-whitespace characters on the same line", () => {
    const changesetMd = outdent`---
    "cool-package": minor
    ---  fail

    Nice simple summary
    `;

    expect(() => parse(changesetMd)).toThrowErrorMatchingInlineSnapshot(`
      "could not parse changeset - invalid frontmatter: ---
      "cool-package": minor
      ---  fail

      Nice simple summary"
    `);
  });
});
