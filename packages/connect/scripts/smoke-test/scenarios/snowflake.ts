import type { Scenario, ScenarioStep } from '../scenario.js';
import { makeStep, errorMessage, requireTools, runReadBatch } from '../scenario.js';

/**
 * Deep Snowflake scenario: Snowflake's exposed surface is mostly listing
 * objects + executing SQL statements. The scenario walks every list tool and
 * runs a benign `SELECT 1` through the statement engine, polling the
 * statement-status endpoint and reading its result once it finishes.
 */
export const snowflakeScenario: Scenario = {
  integrationId: 'snowflake',
  summary: 'listing inventory + benign SELECT 1 statement lifecycle',
  async run({ tools, call }) {
    const steps: ScenarioStep[] = [];
    const missing = requireTools(tools, ['snowflake_execute_statement']);
    if (missing) {
      steps.push({ name: 'preflight', status: 'skip', detail: missing });
      return steps;
    }

    steps.push(
      ...(await runReadBatch(
        call,
        [
          ['snowflake_list_warehouses', {}],
          ['snowflake_list_databases', {}],
          ['snowflake_list_schemas', {}],
          ['snowflake_list_tables', {}],
          ['snowflake_list_views', {}],
          ['snowflake_list_columns', {}],
          ['snowflake_list_stages', {}],
          ['snowflake_list_streams', {}],
          ['snowflake_list_tasks', {}],
          ['snowflake_list_users', {}],
          ['snowflake_list_roles', {}],
        ],
        tools,
      )),
    );

    let statementHandle: string | undefined;
    try {
      const stmt = await call<{ statementHandle?: string; statement_handle?: string }>('snowflake_execute_statement', {
        statement: 'SELECT 1 AS smoke',
      });
      statementHandle = stmt.statementHandle ?? stmt.statement_handle;
      steps.push(
        makeStep(
          'execute statement',
          'snowflake_execute_statement',
          statementHandle ? 'pass' : 'fail',
          statementHandle,
        ),
      );
    } catch (error) {
      steps.push(makeStep('execute statement', 'snowflake_execute_statement', 'fail', errorMessage(error)));
      return steps;
    }

    if (statementHandle && tools['snowflake_get_statement_status']) {
      try {
        await call('snowflake_get_statement_status', { statementHandle });
        steps.push(makeStep('get statement status', 'snowflake_get_statement_status', 'pass'));
      } catch (error) {
        steps.push(makeStep('get statement status', 'snowflake_get_statement_status', 'fail', errorMessage(error)));
      }
    }
    if (statementHandle && tools['snowflake_get_statement_result']) {
      try {
        await call('snowflake_get_statement_result', { statement_handle: statementHandle });
        steps.push(makeStep('get statement result', 'snowflake_get_statement_result', 'pass'));
      } catch (error) {
        steps.push(makeStep('get statement result', 'snowflake_get_statement_result', 'fail', errorMessage(error)));
      }
    }

    // Exercise cancel_statement against the already-completed handle. The
    // execute tool has no async submission parameter (the SQL API's
    // `async=true` query param is not part of the generated input schema),
    // so a genuinely in-flight cancel is not reachable from the toolset.
    // Cancelling a finished statement returns a benign "statement already
    // finished"-style response, which still proves the endpoint wiring.
    if (statementHandle && tools['snowflake_cancel_statement']) {
      try {
        await call('snowflake_cancel_statement', { statement_handle: statementHandle });
        steps.push(makeStep('cancel statement (completed handle)', 'snowflake_cancel_statement', 'pass'));
      } catch (error) {
        const msg = errorMessage(error);
        const benign = /status=(400|404|422)|already (finished|completed|closed)|cannot be cancell?ed/i.test(msg);
        steps.push(
          makeStep(
            'cancel statement (completed handle)',
            'snowflake_cancel_statement',
            benign ? 'pass' : 'fail',
            benign ? `expected error: ${msg}` : msg,
          ),
        );
      }
    }

    return steps;
  },
};
