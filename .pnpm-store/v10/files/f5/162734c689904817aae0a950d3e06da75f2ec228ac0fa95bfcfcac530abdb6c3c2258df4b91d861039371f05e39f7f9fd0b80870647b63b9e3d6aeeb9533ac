import { describe } from "riteway";
import match from "riteway/match";
import { errorCauses, createError, noop } from "./error-causes.js";

/*eslint-disable */
const createExampleStack = ({filtered = false} = {}) => filtered === false ? `Error: Foo  
at createError () 
at Timeout._onTimeout () 
at listOnTimeout () 
at process.processTimers () `:
`Error: Foo  
at Timeout._onTimeout () 
at listOnTimeout () 
at process.processTimers () `;
/*eslint-enable */

describe("createError", async (assert) => {
  const optionNames = ["name", "message", "code", "stack"];

  const name = "ImATeapot";
  const message = "I'm a teapot";
  const code = 418;

  const error = createError({
    name,
    message,
    code,
  });
  const cause = {
    name,
    message,
    code,
  };

  assert({
    given: "name, message, and code",
    should: "return an error cause with matching name, message, and code",
    actual: error.cause,
    expected: cause,
  });

  optionNames.forEach((option) => {
    const error = createError();
    assert({
      given: `no ${option}`,
      should: `not return a cause with a ${option} property`,
      actual: Object.prototype.hasOwnProperty.call(error.cause, option),
      expected: false,
    });
  });

  {
    const stack = createExampleStack();
    assert({
      given: "a stack",
      should: "return a cause with the original stack",
      actual: createError({ stack }).cause.stack,
      expected: stack,
    });
  }

  {
    const error = createError({ name: "TestError" });
    const contains = match(error.stack);

    assert({
      given: "valid input, where createError creates an error stack",
      should: "return an error with createError removed from the stack",
      actual: contains("at createError"),
      expected: "",
    });
  }

  {
    const foo = "bar";

    assert({
      given: "an undocumented prop",
      should: "pass the prop through to the error.cause",
      actual: createError({ foo }).cause.foo,
      expected: foo,
    });
  }
});

describe("errorCauses", async (assert) => {
  const [fetchErrors, handleFetchErrors] = errorCauses({
    NotFound: {
      code: 404,
      message: "The requested resource was not found",
    },
    MissingURI: {
      code: 400,
      message: "URI is required",
    },
  });
  const { NotFound } = fetchErrors;

  assert({
    given: "a list of error causes",
    should: "return a map of error causes keyed by error name",
    actual: fetchErrors,
    expected: {
      NotFound: NotFound,
      MissingURI: {
        name: "MissingURI", // make sure the name is on it.
        code: 400,
        message: "URI is required",
      },
    },
  });

  assert({
    given: "a list of error causes",
    should: "return a function to handle errors",
    actual: handleFetchErrors({
      NotFound: ({ cause }) => cause,
      MissingURI: noop,
    })(createError(NotFound)),
    expected: NotFound,
  });

  {
    const given = "a call to the handler missing an error handler";
    const description = {
      given,
      should: "throw a MissingHandler error",
    };
    const missingErrorName = "MissingURI";
    const expectedCause = {
      name: "MissingHandler",
      message: "Missing error handler: MissingURI",
    };

    try {
      handleFetchErrors({
        NotFound: noop,
      });

      assert({
        ...description,
        actual: "no error was thrown",
        expected: expectedCause,
      });
    } catch (e) {
      assert({
        ...description,
        actual: e.cause,
        expected: expectedCause,
      });

      const contains = match(e.cause.message);
      assert({
        given,
        should: "report the missing error name",
        actual: contains(missingErrorName),
        expected: missingErrorName,
      });
    }
  }

  {
    const given = "the error cause is not in the list of error causes";
    const description = {
      given,
      should: "throw an unexpected error",
    };

    const expectedCause = {
      name: "UnexpectedError",
      message: "An unexpected error was thrown",
    };

    try {
      const e = new Error("This Error Does Not Exist.com");
      handleFetchErrors({
        NotFound: noop,
        MissingURI: noop,
      })(e);

      assert({
        ...description,
        actual: "no error was thrown",
        expected: expectedCause,
      });
    } catch (e) {
      //name
      const contains = match(JSON.stringify(e.cause));
      assert({
        ...description,
        actual: contains(expectedCause.name),
        expected: expectedCause.name,
      });

      //message
      assert({
        ...description,
        actual: contains(expectedCause.message),
        expected: expectedCause.message,
      });
    }
  }
});

describe("noop", async (assert) => {
  assert({
    given: "no arguments",
    should: "return undefined",
    actual: noop(),
    expected: undefined,
  });
});
