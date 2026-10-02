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
        await call('snowflake_get_statement_result', { statementHandle });
        steps.push(makeStep('get statement result', 'snowflake_get_statement_result', 'pass'));
      } catch (error) {
        steps.push(makeStep('get statement result', 'snowflake_get_statement_result', 'fail', errorMessage(error)));
      }
    }

    // Exercise cancel_statement. Submit a slow statement with timeout: 0
    // so Snowflake returns the handle immediately while the query is still
    // running in the background, then cancel it. SYSTEM$WAIT is a built-in
    // procedure that sleeps for N seconds — perfect "cancel me" workload.
    if (tools['snowflake_cancel_statement']) {
      let cancelHandle: string | undefined;
      try {
        const slow = await call<{ statementHandle?: string; statement_handle?: string }>(
          'snowflake_execute_statement',
          { statement: 'CALL SYSTEM$WAIT(30)', timeout: 0 },
        );
        cancelHandle = slow.statementHandle ?? slow.statement_handle;
      } catch (error) {
        // If the async submission itself fails, fall back to cancelling the
        // synchronous handle we already have. Snowflake will return a benign
        // "statement already finished" response but the call still exercises
        // the endpoint wiring.
        cancelHandle = statementHandle;
        steps.push(
          makeStep(
            'async submit for cancel',
            'snowflake_execute_statement',
            'fail',
            `${errorMessage(error)} — falling back to completed-handle cancel`,
          ),
        );
      }

      if (cancelHandle) {
        try {
          await call('snowflake_cancel_statement', { statement_handle: cancelHandle });
          steps.push(makeStep('cancel statement', 'snowflake_cancel_statement', 'pass'));
        } catch (error) {
          steps.push(makeStep('cancel statement', 'snowflake_cancel_statement', 'fail', errorMessage(error)));
        }
      }
    }

    return steps;
  },
};
