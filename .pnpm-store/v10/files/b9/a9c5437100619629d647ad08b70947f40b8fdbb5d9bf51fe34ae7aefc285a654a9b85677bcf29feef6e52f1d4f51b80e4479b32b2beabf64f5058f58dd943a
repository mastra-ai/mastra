import { GitError } from "./index";

describe("Error classes", () => {
  describe("GitError class", () => {
    let error: GitError;
    beforeEach(() => {
      error = new GitError(1, "Operation failed");
    });
    it("should be an instance of error", () => {
      expect(error).toBeInstanceOf(Error);
    });
    it("should include error message and exit code in error", () => {
      expect(error.toString()).toMatch(/(Operation failed).*(1)/);
    });
  });
});
