export const streamResult = {
  runId: '8db4d18d-d677-4ad9-baac-c0c233eedc23',
  eventTimestamp: '2025-08-24T23:46:14.926Z',
  status: 'running',
  phase: 'initializing',
  payload: {
    workflowState: {
      status: 'running',
      steps: {
        'clone-template': {
          id: 'clone-template',
          description: 'Clone the template repository to a temporary directory at the specified ref',
          status: 'success',
          startTime: '2025-08-24T23:46:14.926Z',
          stepCallId: '4b983a16-bcac-4b51-9a10-660cbc6c1106',
          payload: {
            repo: 'https://github.com/mastra-ai/template-text-to-sql',
            ref: 'openai',
            slug: 'text-to-sql',
            targetPath: '/Users/grzegorzlobinski/Work/mastra/examples/agent',
          },
          startedAt: 1756079174922,
          output: {
            templateDir: '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL',
            commitSha: 'acccf3b4f77f7fe9e5d8e4baeef143cdf4d84a0f',
            slug: 'text-to-sql',
            success: true,
          },
          endTime: '2025-08-24T23:46:15.838Z',
        },
        'analyze-package': {
          id: 'analyze-package',
          description: 'Analyze the template package.json to extract dependency information',
          status: 'success',
          startTime: '2025-08-24T23:46:15.838Z',
          stepCallId: 'd2837f00-47c0-4f29-bfcf-4e5767391ec0',
          payload: {
            templateDir: '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL',
            commitSha: 'acccf3b4f77f7fe9e5d8e4baeef143cdf4d84a0f',
            slug: 'text-to-sql',
            success: true,
          },
          startedAt: 1756079175813,
          output: {
            dependencies: {
              '@mastra/core': 'latest',
              '@mastra/libsql': 'latest',
              '@mastra/loggers': 'latest',
              '@mastra/memory': 'latest',
              ai: '^4.3.19',
              'csv-parse': '^5.6.0',
              dotenv: '^17.0.1',
              pg: '^8.16.3',
              zod: '^3.25.75',
              '@ai-sdk/openai': '^2.0.19',
            },
            devDependencies: {
              '@types/node': '^24.0.10',
              '@types/pg': '^8.15.5',
              mastra: 'latest',
              typescript: '^5.8.3',
            },
            peerDependencies: {},
            scripts: {
              test: 'echo "Error: no test specified" && exit 1',
              dev: 'mastra dev',
              build: 'mastra build',
              start: 'mastra start',
            },
            name: 'template-text-to-sql',
            version: '1.0.0',
            description:
              'A Mastra workflow system for database introspection and natural language to SQL conversion. Features PostgreSQL schema analysis, AI-powered query generation, safe SQL execution, and interactive workflows for database operations.',
            success: true,
          },
          endTime: '2025-08-24T23:46:15.838Z',
        },
        'discover-units': {
          id: 'discover-units',
          description: 'Discover template units by analyzing the templates directory structure',
          status: 'success',
          startTime: '2025-08-24T23:46:15.838Z',
          stepCallId: '6e82495d-2ae8-4971-b387-7d240b05ab81',
          payload: {
            templateDir: '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL',
            commitSha: 'acccf3b4f77f7fe9e5d8e4baeef143cdf4d84a0f',
            slug: 'text-to-sql',
            success: true,
          },
          startedAt: 1756079175813,
          output: {
            units: [
              {
                kind: 'agent',
                id: 'sqlAgent',
                file: 'src/mastra/agents/sql-agent.ts',
              },
              {
                kind: 'workflow',
                id: 'databaseQueryWorkflow',
                file: 'src/mastra/workflows/database-query-workflow.ts',
              },
              {
                kind: 'tool',
                id: 'databaseIntrospectionTool',
                file: 'src/mastra/tools/database-introspection-tool.ts',
              },
              {
                kind: 'tool',
                id: 'databaseSeedingTool',
                file: 'src/mastra/tools/database-seeding-tool.ts',
              },
              {
                kind: 'tool',
                id: 'sqlExecutionTool',
                file: 'src/mastra/tools/sql-execution-tool.ts',
              },
              {
                kind: 'tool',
                id: 'sqlGenerationTool',
                file: 'src/mastra/tools/sql-generation-tool.ts',
              },
              {
                kind: 'other',
                id: 'index',
                file: 'src/mastra/index.ts',
              },
            ],
            success: true,
          },
          endTime: '2025-08-24T23:46:29.413Z',
        },
        'order-units': {
          id: 'order-units',
          description: 'Sort units in topological order based on kind weights',
          status: 'success',
          startTime: '2025-08-24T23:46:29.413Z',
          stepCallId: '70c55d72-c375-403c-a8ae-e718460e1a64',
          payload: {
            units: [
              {
                kind: 'agent',
                id: 'sqlAgent',
                file: 'src/mastra/agents/sql-agent.ts',
              },
              {
                kind: 'workflow',
                id: 'databaseQueryWorkflow',
                file: 'src/mastra/workflows/database-query-workflow.ts',
              },
              {
                kind: 'tool',
                id: 'databaseIntrospectionTool',
                file: 'src/mastra/tools/database-introspection-tool.ts',
              },
              {
                kind: 'tool',
                id: 'databaseSeedingTool',
                file: 'src/mastra/tools/database-seeding-tool.ts',
              },
              {
                kind: 'tool',
                id: 'sqlExecutionTool',
                file: 'src/mastra/tools/sql-execution-tool.ts',
              },
              {
                kind: 'tool',
                id: 'sqlGenerationTool',
                file: 'src/mastra/tools/sql-generation-tool.ts',
              },
              {
                kind: 'other',
                id: 'index',
                file: 'src/mastra/index.ts',
              },
            ],
            success: true,
          },
          startedAt: 1756079189408,
          output: {
            orderedUnits: [
              {
                kind: 'tool',
                id: 'databaseIntrospectionTool',
                file: 'src/mastra/tools/database-introspection-tool.ts',
              },
              {
                kind: 'tool',
                id: 'databaseSeedingTool',
                file: 'src/mastra/tools/database-seeding-tool.ts',
              },
              {
                kind: 'tool',
                id: 'sqlExecutionTool',
                file: 'src/mastra/tools/sql-execution-tool.ts',
              },
              {
                kind: 'tool',
                id: 'sqlGenerationTool',
                file: 'src/mastra/tools/sql-generation-tool.ts',
              },
              {
                kind: 'workflow',
                id: 'databaseQueryWorkflow',
                file: 'src/mastra/workflows/database-query-workflow.ts',
              },
              {
                kind: 'agent',
                id: 'sqlAgent',
                file: 'src/mastra/agents/sql-agent.ts',
              },
              {
                kind: 'other',
                id: 'index',
                file: 'src/mastra/index.ts',
              },
            ],
            success: true,
          },
          endTime: '2025-08-24T23:46:29.413Z',
        },
        'prepare-branch': {
          id: 'prepare-branch',
          description: 'Create or switch to integration branch before modifications',
          status: 'success',
          startTime: '2025-08-24T23:46:29.413Z',
          stepCallId: '93404087-c9cd-4c0c-82c6-2f741be95fe2',
          payload: {
            commitSha: 'acccf3b4f77f7fe9e5d8e4baeef143cdf4d84a0f',
            slug: 'text-to-sql',
            targetPath: '/Users/grzegorzlobinski/Work/mastra/examples/agent',
          },
          startedAt: 1756079189408,
          output: {
            branchName: 'feat/install-template-text-to-sql',
            success: true,
          },
          endTime: '2025-08-24T23:46:29.595Z',
        },
        'package-merge': {
          id: 'package-merge',
          description: 'Merge template package.json dependencies into target project',
          status: 'running',
          startTime: '2025-08-24T23:46:29.595Z',
          stepCallId: '7609c42b-2ae3-4e68-89d9-bf3e8ea30d1d',
          payload: {
            commitSha: 'acccf3b4f77f7fe9e5d8e4baeef143cdf4d84a0f',
            slug: 'text-to-sql',
            targetPath: '/Users/grzegorzlobinski/Work/mastra/examples/agent',
            packageInfo: {
              dependencies: {
                '@mastra/core': 'latest',
                '@mastra/libsql': 'latest',
                '@mastra/loggers': 'latest',
                '@mastra/memory': 'latest',
                ai: '^4.3.19',
                'csv-parse': '^5.6.0',
                dotenv: '^17.0.1',
                pg: '^8.16.3',
                zod: '^3.25.75',
                '@ai-sdk/openai': '^2.0.19',
              },
              devDependencies: {
                '@types/node': '^24.0.10',
                '@types/pg': '^8.15.5',
                mastra: 'latest',
                typescript: '^5.8.3',
              },
              peerDependencies: {},
              scripts: {
                test: 'echo "Error: no test specified" && exit 1',
                dev: 'mastra dev',
                build: 'mastra build',
                start: 'mastra start',
              },
              name: 'template-text-to-sql',
              version: '1.0.0',
              description:
                'A Mastra workflow system for database introspection and natural language to SQL conversion. Features PostgreSQL schema analysis, AI-powered query generation, safe SQL execution, and interactive workflows for database operations.',
              success: true,
            },
          },
          startedAt: 1756079189594,
          output: {
            success: true,
            applied: true,
            message: 'Successfully merged template dependencies for text-to-sql',
          },
          endTime: '2025-08-24T23:46:38.039Z',
        },
        install: {
          id: 'install',
          description: 'Install packages based on merged package.json',
          status: 'pending',
          startTime: '2025-08-24T23:46:38.039Z',
          stepCallId: '8f8c228a-0698-41d0-b10e-ce8dc0d6bce2',
          payload: {
            targetPath: '/Users/grzegorzlobinski/Work/mastra/examples/agent',
          },
          startedAt: 1756079198029,
          output: {
            success: true,
          },
          endTime: '2025-08-24T23:46:46.416Z',
        },
        'programmatic-file-copy': {
          id: 'programmatic-file-copy',
          description: 'Programmatically copy template files to target project based on ordered units',
          status: 'pending',
          startTime: '2025-08-24T23:46:46.416Z',
          stepCallId: '3dbef3ee-c852-4522-bb70-fdc1a2ad0b1a',
          payload: {
            orderedUnits: [
              {
                kind: 'tool',
                id: 'databaseIntrospectionTool',
                file: 'src/mastra/tools/database-introspection-tool.ts',
              },
              {
                kind: 'tool',
                id: 'databaseSeedingTool',
                file: 'src/mastra/tools/database-seeding-tool.ts',
              },
              {
                kind: 'tool',
                id: 'sqlExecutionTool',
                file: 'src/mastra/tools/sql-execution-tool.ts',
              },
              {
                kind: 'tool',
                id: 'sqlGenerationTool',
                file: 'src/mastra/tools/sql-generation-tool.ts',
              },
              {
                kind: 'workflow',
                id: 'databaseQueryWorkflow',
                file: 'src/mastra/workflows/database-query-workflow.ts',
              },
              {
                kind: 'agent',
                id: 'sqlAgent',
                file: 'src/mastra/agents/sql-agent.ts',
              },
              {
                kind: 'other',
                id: 'index',
                file: 'src/mastra/index.ts',
              },
            ],
            templateDir: '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL',
            commitSha: 'acccf3b4f77f7fe9e5d8e4baeef143cdf4d84a0f',
            slug: 'text-to-sql',
            targetPath: '/Users/grzegorzlobinski/Work/mastra/examples/agent',
          },
          startedAt: 1756079206412,
          output: {
            success: true,
            copiedFiles: [
              {
                source:
                  '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL/src/mastra/tools/database-introspection-tool.ts',
                destination:
                  '/Users/grzegorzlobinski/Work/mastra/examples/agent/src/mastra/tools/databaseIntrospectionTool.ts',
                unit: {
                  kind: 'tool',
                  id: 'databaseIntrospectionTool',
                },
              },
              {
                source:
                  '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL/src/mastra/tools/database-seeding-tool.ts',
                destination:
                  '/Users/grzegorzlobinski/Work/mastra/examples/agent/src/mastra/tools/databaseSeedingTool.ts',
                unit: {
                  kind: 'tool',
                  id: 'databaseSeedingTool',
                },
              },
              {
                source:
                  '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL/src/mastra/tools/sql-execution-tool.ts',
                destination: '/Users/grzegorzlobinski/Work/mastra/examples/agent/src/mastra/tools/sqlExecutionTool.ts',
                unit: {
                  kind: 'tool',
                  id: 'sqlExecutionTool',
                },
              },
              {
                source:
                  '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL/src/mastra/tools/sql-generation-tool.ts',
                destination: '/Users/grzegorzlobinski/Work/mastra/examples/agent/src/mastra/tools/sqlGenerationTool.ts',
                unit: {
                  kind: 'tool',
                  id: 'sqlGenerationTool',
                },
              },
              {
                source:
                  '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL/src/mastra/workflows/database-query-workflow.ts',
                destination:
                  '/Users/grzegorzlobinski/Work/mastra/examples/agent/src/mastra/workflows/databaseQueryWorkflow.ts',
                unit: {
                  kind: 'workflow',
                  id: 'databaseQueryWorkflow',
                },
              },
              {
                source:
                  '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL/src/mastra/agents/sql-agent.ts',
                destination: '/Users/grzegorzlobinski/Work/mastra/examples/agent/src/mastra/agents/sqlAgent.ts',
                unit: {
                  kind: 'agent',
                  id: 'sqlAgent',
                },
              },
            ],
            conflicts: [
              {
                unit: {
                  kind: 'other',
                  id: 'index',
                },
                issue: 'File exists - skipped: index.ts',
                sourceFile: 'src/mastra/index.ts',
                targetFile: 'src/mastra/index.ts',
              },
            ],
            message: 'Programmatic file copy completed. Copied 6 files, 1 conflicts detected.',
          },
          endTime: '2025-08-24T23:46:53.323Z',
        },
        'intelligent-merge': {
          id: 'intelligent-merge',
          description: 'Use AgentBuilder to intelligently merge template files',
          status: 'pending',
          startTime: '2025-08-24T23:46:53.323Z',
          stepCallId: 'd34d8977-1ebe-4360-b908-f534264c561b',
          payload: {
            conflicts: [
              {
                unit: {
                  kind: 'other',
                  id: 'index',
                },
                issue: 'File exists - skipped: index.ts',
                sourceFile: 'src/mastra/index.ts',
                targetFile: 'src/mastra/index.ts',
              },
            ],
            copiedFiles: [
              {
                source:
                  '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL/src/mastra/tools/database-introspection-tool.ts',
                destination:
                  '/Users/grzegorzlobinski/Work/mastra/examples/agent/src/mastra/tools/databaseIntrospectionTool.ts',
                unit: {
                  kind: 'tool',
                  id: 'databaseIntrospectionTool',
                },
              },
              {
                source:
                  '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL/src/mastra/tools/database-seeding-tool.ts',
                destination:
                  '/Users/grzegorzlobinski/Work/mastra/examples/agent/src/mastra/tools/databaseSeedingTool.ts',
                unit: {
                  kind: 'tool',
                  id: 'databaseSeedingTool',
                },
              },
              {
                source:
                  '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL/src/mastra/tools/sql-execution-tool.ts',
                destination: '/Users/grzegorzlobinski/Work/mastra/examples/agent/src/mastra/tools/sqlExecutionTool.ts',
                unit: {
                  kind: 'tool',
                  id: 'sqlExecutionTool',
                },
              },
              {
                source:
                  '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL/src/mastra/tools/sql-generation-tool.ts',
                destination: '/Users/grzegorzlobinski/Work/mastra/examples/agent/src/mastra/tools/sqlGenerationTool.ts',
                unit: {
                  kind: 'tool',
                  id: 'sqlGenerationTool',
                },
              },
              {
                source:
                  '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL/src/mastra/workflows/database-query-workflow.ts',
                destination:
                  '/Users/grzegorzlobinski/Work/mastra/examples/agent/src/mastra/workflows/databaseQueryWorkflow.ts',
                unit: {
                  kind: 'workflow',
                  id: 'databaseQueryWorkflow',
                },
              },
              {
                source:
                  '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL/src/mastra/agents/sql-agent.ts',
                destination: '/Users/grzegorzlobinski/Work/mastra/examples/agent/src/mastra/agents/sqlAgent.ts',
                unit: {
                  kind: 'agent',
                  id: 'sqlAgent',
                },
              },
            ],
            commitSha: 'acccf3b4f77f7fe9e5d8e4baeef143cdf4d84a0f',
            slug: 'text-to-sql',
            targetPath: '/Users/grzegorzlobinski/Work/mastra/examples/agent',
            templateDir: '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL',
          },
          startedAt: 1756079213018,
          output: {
            success: true,
            applied: true,
            message: 'Successfully resolved 1 conflicts from template text-to-sql',
            conflictsResolved: [
              {
                unit: {
                  kind: 'other',
                  id: 'index',
                },
                issue: 'File exists - skipped: index.ts',
                resolution: 'No specific resolution found for other index',
                actualWork: false,
              },
            ],
          },
          endTime: '2025-08-24T23:47:25.984Z',
        },
        'validation-and-fix': {
          id: 'validation-and-fix',
          description: 'Validate the merged template code and fix any issues using a specialized agent',
          status: 'pending',
          startTime: '2025-08-24T23:47:25.984Z',
          stepCallId: '1c9c0029-e45e-4a37-a7a8-a771b9f2ac38',
          payload: {
            commitSha: 'acccf3b4f77f7fe9e5d8e4baeef143cdf4d84a0f',
            slug: 'text-to-sql',
            targetPath: '/Users/grzegorzlobinski/Work/mastra/examples/agent',
            templateDir: '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL',
            orderedUnits: [
              {
                kind: 'tool',
                id: 'databaseIntrospectionTool',
                file: 'src/mastra/tools/database-introspection-tool.ts',
              },
              {
                kind: 'tool',
                id: 'databaseSeedingTool',
                file: 'src/mastra/tools/database-seeding-tool.ts',
              },
              {
                kind: 'tool',
                id: 'sqlExecutionTool',
                file: 'src/mastra/tools/sql-execution-tool.ts',
              },
              {
                kind: 'tool',
                id: 'sqlGenerationTool',
                file: 'src/mastra/tools/sql-generation-tool.ts',
              },
              {
                kind: 'workflow',
                id: 'databaseQueryWorkflow',
                file: 'src/mastra/workflows/database-query-workflow.ts',
              },
              {
                kind: 'agent',
                id: 'sqlAgent',
                file: 'src/mastra/agents/sql-agent.ts',
              },
              {
                kind: 'other',
                id: 'index',
                file: 'src/mastra/index.ts',
              },
            ],
            copiedFiles: [
              {
                source:
                  '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL/src/mastra/tools/database-introspection-tool.ts',
                destination:
                  '/Users/grzegorzlobinski/Work/mastra/examples/agent/src/mastra/tools/databaseIntrospectionTool.ts',
                unit: {
                  kind: 'tool',
                  id: 'databaseIntrospectionTool',
                },
              },
              {
                source:
                  '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL/src/mastra/tools/database-seeding-tool.ts',
                destination:
                  '/Users/grzegorzlobinski/Work/mastra/examples/agent/src/mastra/tools/databaseSeedingTool.ts',
                unit: {
                  kind: 'tool',
                  id: 'databaseSeedingTool',
                },
              },
              {
                source:
                  '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL/src/mastra/tools/sql-execution-tool.ts',
                destination: '/Users/grzegorzlobinski/Work/mastra/examples/agent/src/mastra/tools/sqlExecutionTool.ts',
                unit: {
                  kind: 'tool',
                  id: 'sqlExecutionTool',
                },
              },
              {
                source:
                  '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL/src/mastra/tools/sql-generation-tool.ts',
                destination: '/Users/grzegorzlobinski/Work/mastra/examples/agent/src/mastra/tools/sqlGenerationTool.ts',
                unit: {
                  kind: 'tool',
                  id: 'sqlGenerationTool',
                },
              },
              {
                source:
                  '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL/src/mastra/workflows/database-query-workflow.ts',
                destination:
                  '/Users/grzegorzlobinski/Work/mastra/examples/agent/src/mastra/workflows/databaseQueryWorkflow.ts',
                unit: {
                  kind: 'workflow',
                  id: 'databaseQueryWorkflow',
                },
              },
              {
                source:
                  '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL/src/mastra/agents/sql-agent.ts',
                destination: '/Users/grzegorzlobinski/Work/mastra/examples/agent/src/mastra/agents/sqlAgent.ts',
                unit: {
                  kind: 'agent',
                  id: 'sqlAgent',
                },
              },
            ],
            conflictsResolved: [
              {
                unit: {
                  kind: 'other',
                  id: 'index',
                },
                issue: 'File exists - skipped: index.ts',
                resolution: 'No specific resolution found for other index',
                actualWork: false,
              },
            ],
          },
          startedAt: 1756079245974,
        },
        'mapping_9763e03b-8c53-4ab1-b675-96ebb9826f94': {
          status: 'success',
          startTime: '2025-08-24T23:46:15.838Z',
          id: 'mapping_9763e03b-8c53-4ab1-b675-96ebb9826f94',
          stepCallId: 'f9f219d3-d64b-4a4b-afc6-4097afd96cb3',
          payload: {
            templateDir: '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL',
            commitSha: 'acccf3b4f77f7fe9e5d8e4baeef143cdf4d84a0f',
            slug: 'text-to-sql',
            success: true,
          },
          startedAt: 1756079175813,
          output: {
            templateDir: '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL',
            commitSha: 'acccf3b4f77f7fe9e5d8e4baeef143cdf4d84a0f',
            slug: 'text-to-sql',
            success: true,
          },
          endTime: '2025-08-24T23:46:15.838Z',
        },
        'mapping_12005b63-8929-4d58-b04e-0f9aace60b9f': {
          status: 'success',
          startTime: '2025-08-24T23:46:29.413Z',
          id: 'mapping_12005b63-8929-4d58-b04e-0f9aace60b9f',
          stepCallId: '21f21639-4e46-4758-a63f-008c0fb044ac',
          payload: {
            'analyze-package': {
              dependencies: {
                '@mastra/core': 'latest',
                '@mastra/libsql': 'latest',
                '@mastra/loggers': 'latest',
                '@mastra/memory': 'latest',
                ai: '^4.3.19',
                'csv-parse': '^5.6.0',
                dotenv: '^17.0.1',
                pg: '^8.16.3',
                zod: '^3.25.75',
                '@ai-sdk/openai': '^2.0.19',
              },
              devDependencies: {
                '@types/node': '^24.0.10',
                '@types/pg': '^8.15.5',
                mastra: 'latest',
                typescript: '^5.8.3',
              },
              peerDependencies: {},
              scripts: {
                test: 'echo "Error: no test specified" && exit 1',
                dev: 'mastra dev',
                build: 'mastra build',
                start: 'mastra start',
              },
              name: 'template-text-to-sql',
              version: '1.0.0',
              description:
                'A Mastra workflow system for database introspection and natural language to SQL conversion. Features PostgreSQL schema analysis, AI-powered query generation, safe SQL execution, and interactive workflows for database operations.',
              success: true,
            },
            'discover-units': {
              units: [
                {
                  kind: 'agent',
                  id: 'sqlAgent',
                  file: 'src/mastra/agents/sql-agent.ts',
                },
                {
                  kind: 'workflow',
                  id: 'databaseQueryWorkflow',
                  file: 'src/mastra/workflows/database-query-workflow.ts',
                },
                {
                  kind: 'tool',
                  id: 'databaseIntrospectionTool',
                  file: 'src/mastra/tools/database-introspection-tool.ts',
                },
                {
                  kind: 'tool',
                  id: 'databaseSeedingTool',
                  file: 'src/mastra/tools/database-seeding-tool.ts',
                },
                {
                  kind: 'tool',
                  id: 'sqlExecutionTool',
                  file: 'src/mastra/tools/sql-execution-tool.ts',
                },
                {
                  kind: 'tool',
                  id: 'sqlGenerationTool',
                  file: 'src/mastra/tools/sql-generation-tool.ts',
                },
                {
                  kind: 'other',
                  id: 'index',
                  file: 'src/mastra/index.ts',
                },
              ],
              success: true,
            },
          },
          startedAt: 1756079189407,
          output: {
            units: [
              {
                kind: 'agent',
                id: 'sqlAgent',
                file: 'src/mastra/agents/sql-agent.ts',
              },
              {
                kind: 'workflow',
                id: 'databaseQueryWorkflow',
                file: 'src/mastra/workflows/database-query-workflow.ts',
              },
              {
                kind: 'tool',
                id: 'databaseIntrospectionTool',
                file: 'src/mastra/tools/database-introspection-tool.ts',
              },
              {
                kind: 'tool',
                id: 'databaseSeedingTool',
                file: 'src/mastra/tools/database-seeding-tool.ts',
              },
              {
                kind: 'tool',
                id: 'sqlExecutionTool',
                file: 'src/mastra/tools/sql-execution-tool.ts',
              },
              {
                kind: 'tool',
                id: 'sqlGenerationTool',
                file: 'src/mastra/tools/sql-generation-tool.ts',
              },
              {
                kind: 'other',
                id: 'index',
                file: 'src/mastra/index.ts',
              },
            ],
            success: true,
          },
          endTime: '2025-08-24T23:46:29.413Z',
        },
        'mapping_9748160d-0d6f-4b5e-a80e-a581de4ca07f': {
          status: 'success',
          startTime: '2025-08-24T23:46:29.413Z',
          id: 'mapping_9748160d-0d6f-4b5e-a80e-a581de4ca07f',
          stepCallId: '7fb361d1-05f2-48f3-876d-55f3d94dda37',
          payload: {
            orderedUnits: [
              {
                kind: 'tool',
                id: 'databaseIntrospectionTool',
                file: 'src/mastra/tools/database-introspection-tool.ts',
              },
              {
                kind: 'tool',
                id: 'databaseSeedingTool',
                file: 'src/mastra/tools/database-seeding-tool.ts',
              },
              {
                kind: 'tool',
                id: 'sqlExecutionTool',
                file: 'src/mastra/tools/sql-execution-tool.ts',
              },
              {
                kind: 'tool',
                id: 'sqlGenerationTool',
                file: 'src/mastra/tools/sql-generation-tool.ts',
              },
              {
                kind: 'workflow',
                id: 'databaseQueryWorkflow',
                file: 'src/mastra/workflows/database-query-workflow.ts',
              },
              {
                kind: 'agent',
                id: 'sqlAgent',
                file: 'src/mastra/agents/sql-agent.ts',
              },
              {
                kind: 'other',
                id: 'index',
                file: 'src/mastra/index.ts',
              },
            ],
            success: true,
          },
          startedAt: 1756079189408,
          output: {
            commitSha: 'acccf3b4f77f7fe9e5d8e4baeef143cdf4d84a0f',
            slug: 'text-to-sql',
            targetPath: '/Users/grzegorzlobinski/Work/mastra/examples/agent',
          },
          endTime: '2025-08-24T23:46:29.413Z',
        },
        'mapping_7fd28d2e-7016-4189-ae79-e63b7d455f31': {
          status: 'success',
          startTime: '2025-08-24T23:46:29.595Z',
          id: 'mapping_7fd28d2e-7016-4189-ae79-e63b7d455f31',
          stepCallId: 'ae0a8d4b-b466-487f-8bd2-8b8bd3a410df',
          payload: {
            branchName: 'feat/install-template-text-to-sql',
            success: true,
          },
          startedAt: 1756079189593,
          output: {
            commitSha: 'acccf3b4f77f7fe9e5d8e4baeef143cdf4d84a0f',
            slug: 'text-to-sql',
            targetPath: '/Users/grzegorzlobinski/Work/mastra/examples/agent',
            packageInfo: {
              dependencies: {
                '@mastra/core': 'latest',
                '@mastra/libsql': 'latest',
                '@mastra/loggers': 'latest',
                '@mastra/memory': 'latest',
                ai: '^4.3.19',
                'csv-parse': '^5.6.0',
                dotenv: '^17.0.1',
                pg: '^8.16.3',
                zod: '^3.25.75',
                '@ai-sdk/openai': '^2.0.19',
              },
              devDependencies: {
                '@types/node': '^24.0.10',
                '@types/pg': '^8.15.5',
                mastra: 'latest',
                typescript: '^5.8.3',
              },
              peerDependencies: {},
              scripts: {
                test: 'echo "Error: no test specified" && exit 1',
                dev: 'mastra dev',
                build: 'mastra build',
                start: 'mastra start',
              },
              name: 'template-text-to-sql',
              version: '1.0.0',
              description:
                'A Mastra workflow system for database introspection and natural language to SQL conversion. Features PostgreSQL schema analysis, AI-powered query generation, safe SQL execution, and interactive workflows for database operations.',
              success: true,
            },
          },
          endTime: '2025-08-24T23:46:29.595Z',
        },
        'mapping_87226e2b-903a-4224-8599-dfa980e7ba09': {
          status: 'success',
          startTime: '2025-08-24T23:46:38.039Z',
          id: 'mapping_87226e2b-903a-4224-8599-dfa980e7ba09',
          stepCallId: 'e4e73489-06db-48e7-a6dd-da6e9f30315c',
          payload: {
            success: true,
            applied: true,
            message: 'Successfully merged template dependencies for text-to-sql',
          },
          startedAt: 1756079198029,
          output: {
            targetPath: '/Users/grzegorzlobinski/Work/mastra/examples/agent',
          },
          endTime: '2025-08-24T23:46:38.039Z',
        },
        'mapping_56698d76-6b37-4e45-8c93-284160c53ee4': {
          status: 'success',
          startTime: '2025-08-24T23:46:46.416Z',
          id: 'mapping_56698d76-6b37-4e45-8c93-284160c53ee4',
          stepCallId: '95723626-b357-464d-9aeb-2a0ad34f53ab',
          payload: {
            success: true,
          },
          startedAt: 1756079206412,
          output: {
            orderedUnits: [
              {
                kind: 'tool',
                id: 'databaseIntrospectionTool',
                file: 'src/mastra/tools/database-introspection-tool.ts',
              },
              {
                kind: 'tool',
                id: 'databaseSeedingTool',
                file: 'src/mastra/tools/database-seeding-tool.ts',
              },
              {
                kind: 'tool',
                id: 'sqlExecutionTool',
                file: 'src/mastra/tools/sql-execution-tool.ts',
              },
              {
                kind: 'tool',
                id: 'sqlGenerationTool',
                file: 'src/mastra/tools/sql-generation-tool.ts',
              },
              {
                kind: 'workflow',
                id: 'databaseQueryWorkflow',
                file: 'src/mastra/workflows/database-query-workflow.ts',
              },
              {
                kind: 'agent',
                id: 'sqlAgent',
                file: 'src/mastra/agents/sql-agent.ts',
              },
              {
                kind: 'other',
                id: 'index',
                file: 'src/mastra/index.ts',
              },
            ],
            templateDir: '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL',
            commitSha: 'acccf3b4f77f7fe9e5d8e4baeef143cdf4d84a0f',
            slug: 'text-to-sql',
            targetPath: '/Users/grzegorzlobinski/Work/mastra/examples/agent',
          },
          endTime: '2025-08-24T23:46:46.416Z',
        },
        'mapping_d9db151b-3d76-44e4-9402-eb14982b12c9': {
          status: 'success',
          startTime: '2025-08-24T23:46:53.323Z',
          id: 'mapping_d9db151b-3d76-44e4-9402-eb14982b12c9',
          stepCallId: 'bfcf0880-fc0b-456d-a150-4b6b47a69bf7',
          payload: {
            success: true,
            copiedFiles: [
              {
                source:
                  '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL/src/mastra/tools/database-introspection-tool.ts',
                destination:
                  '/Users/grzegorzlobinski/Work/mastra/examples/agent/src/mastra/tools/databaseIntrospectionTool.ts',
                unit: {
                  kind: 'tool',
                  id: 'databaseIntrospectionTool',
                },
              },
              {
                source:
                  '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL/src/mastra/tools/database-seeding-tool.ts',
                destination:
                  '/Users/grzegorzlobinski/Work/mastra/examples/agent/src/mastra/tools/databaseSeedingTool.ts',
                unit: {
                  kind: 'tool',
                  id: 'databaseSeedingTool',
                },
              },
              {
                source:
                  '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL/src/mastra/tools/sql-execution-tool.ts',
                destination: '/Users/grzegorzlobinski/Work/mastra/examples/agent/src/mastra/tools/sqlExecutionTool.ts',
                unit: {
                  kind: 'tool',
                  id: 'sqlExecutionTool',
                },
              },
              {
                source:
                  '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL/src/mastra/tools/sql-generation-tool.ts',
                destination: '/Users/grzegorzlobinski/Work/mastra/examples/agent/src/mastra/tools/sqlGenerationTool.ts',
                unit: {
                  kind: 'tool',
                  id: 'sqlGenerationTool',
                },
              },
              {
                source:
                  '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL/src/mastra/workflows/database-query-workflow.ts',
                destination:
                  '/Users/grzegorzlobinski/Work/mastra/examples/agent/src/mastra/workflows/databaseQueryWorkflow.ts',
                unit: {
                  kind: 'workflow',
                  id: 'databaseQueryWorkflow',
                },
              },
              {
                source:
                  '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL/src/mastra/agents/sql-agent.ts',
                destination: '/Users/grzegorzlobinski/Work/mastra/examples/agent/src/mastra/agents/sqlAgent.ts',
                unit: {
                  kind: 'agent',
                  id: 'sqlAgent',
                },
              },
            ],
            conflicts: [
              {
                unit: {
                  kind: 'other',
                  id: 'index',
                },
                issue: 'File exists - skipped: index.ts',
                sourceFile: 'src/mastra/index.ts',
                targetFile: 'src/mastra/index.ts',
              },
            ],
            message: 'Programmatic file copy completed. Copied 6 files, 1 conflicts detected.',
          },
          startedAt: 1756079213018,
          output: {
            conflicts: [
              {
                unit: {
                  kind: 'other',
                  id: 'index',
                },
                issue: 'File exists - skipped: index.ts',
                sourceFile: 'src/mastra/index.ts',
                targetFile: 'src/mastra/index.ts',
              },
            ],
            copiedFiles: [
              {
                source:
                  '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL/src/mastra/tools/database-introspection-tool.ts',
                destination:
                  '/Users/grzegorzlobinski/Work/mastra/examples/agent/src/mastra/tools/databaseIntrospectionTool.ts',
                unit: {
                  kind: 'tool',
                  id: 'databaseIntrospectionTool',
                },
              },
              {
                source:
                  '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL/src/mastra/tools/database-seeding-tool.ts',
                destination:
                  '/Users/grzegorzlobinski/Work/mastra/examples/agent/src/mastra/tools/databaseSeedingTool.ts',
                unit: {
                  kind: 'tool',
                  id: 'databaseSeedingTool',
                },
              },
              {
                source:
                  '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL/src/mastra/tools/sql-execution-tool.ts',
                destination: '/Users/grzegorzlobinski/Work/mastra/examples/agent/src/mastra/tools/sqlExecutionTool.ts',
                unit: {
                  kind: 'tool',
                  id: 'sqlExecutionTool',
                },
              },
              {
                source:
                  '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL/src/mastra/tools/sql-generation-tool.ts',
                destination: '/Users/grzegorzlobinski/Work/mastra/examples/agent/src/mastra/tools/sqlGenerationTool.ts',
                unit: {
                  kind: 'tool',
                  id: 'sqlGenerationTool',
                },
              },
              {
                source:
                  '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL/src/mastra/workflows/database-query-workflow.ts',
                destination:
                  '/Users/grzegorzlobinski/Work/mastra/examples/agent/src/mastra/workflows/databaseQueryWorkflow.ts',
                unit: {
                  kind: 'workflow',
                  id: 'databaseQueryWorkflow',
                },
              },
              {
                source:
                  '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL/src/mastra/agents/sql-agent.ts',
                destination: '/Users/grzegorzlobinski/Work/mastra/examples/agent/src/mastra/agents/sqlAgent.ts',
                unit: {
                  kind: 'agent',
                  id: 'sqlAgent',
                },
              },
            ],
            commitSha: 'acccf3b4f77f7fe9e5d8e4baeef143cdf4d84a0f',
            slug: 'text-to-sql',
            targetPath: '/Users/grzegorzlobinski/Work/mastra/examples/agent',
            templateDir: '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL',
          },
          endTime: '2025-08-24T23:46:53.323Z',
        },
        'mapping_5455a414-d312-4fe3-97af-61d4c8eb470f': {
          status: 'success',
          startTime: '2025-08-24T23:47:25.984Z',
          id: 'mapping_5455a414-d312-4fe3-97af-61d4c8eb470f',
          stepCallId: 'eaedbe10-553a-4a4c-ae59-c09e7a60fe85',
          payload: {
            success: true,
            applied: true,
            message: 'Successfully resolved 1 conflicts from template text-to-sql',
            conflictsResolved: [
              {
                unit: {
                  kind: 'other',
                  id: 'index',
                },
                issue: 'File exists - skipped: index.ts',
                resolution: 'No specific resolution found for other index',
                actualWork: false,
              },
            ],
          },
          startedAt: 1756079245974,
          output: {
            commitSha: 'acccf3b4f77f7fe9e5d8e4baeef143cdf4d84a0f',
            slug: 'text-to-sql',
            targetPath: '/Users/grzegorzlobinski/Work/mastra/examples/agent',
            templateDir: '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL',
            orderedUnits: [
              {
                kind: 'tool',
                id: 'databaseIntrospectionTool',
                file: 'src/mastra/tools/database-introspection-tool.ts',
              },
              {
                kind: 'tool',
                id: 'databaseSeedingTool',
                file: 'src/mastra/tools/database-seeding-tool.ts',
              },
              {
                kind: 'tool',
                id: 'sqlExecutionTool',
                file: 'src/mastra/tools/sql-execution-tool.ts',
              },
              {
                kind: 'tool',
                id: 'sqlGenerationTool',
                file: 'src/mastra/tools/sql-generation-tool.ts',
              },
              {
                kind: 'workflow',
                id: 'databaseQueryWorkflow',
                file: 'src/mastra/workflows/database-query-workflow.ts',
              },
              {
                kind: 'agent',
                id: 'sqlAgent',
                file: 'src/mastra/agents/sql-agent.ts',
              },
              {
                kind: 'other',
                id: 'index',
                file: 'src/mastra/index.ts',
              },
            ],
            copiedFiles: [
              {
                source:
                  '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL/src/mastra/tools/database-introspection-tool.ts',
                destination:
                  '/Users/grzegorzlobinski/Work/mastra/examples/agent/src/mastra/tools/databaseIntrospectionTool.ts',
                unit: {
                  kind: 'tool',
                  id: 'databaseIntrospectionTool',
                },
              },
              {
                source:
                  '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL/src/mastra/tools/database-seeding-tool.ts',
                destination:
                  '/Users/grzegorzlobinski/Work/mastra/examples/agent/src/mastra/tools/databaseSeedingTool.ts',
                unit: {
                  kind: 'tool',
                  id: 'databaseSeedingTool',
                },
              },
              {
                source:
                  '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL/src/mastra/tools/sql-execution-tool.ts',
                destination: '/Users/grzegorzlobinski/Work/mastra/examples/agent/src/mastra/tools/sqlExecutionTool.ts',
                unit: {
                  kind: 'tool',
                  id: 'sqlExecutionTool',
                },
              },
              {
                source:
                  '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL/src/mastra/tools/sql-generation-tool.ts',
                destination: '/Users/grzegorzlobinski/Work/mastra/examples/agent/src/mastra/tools/sqlGenerationTool.ts',
                unit: {
                  kind: 'tool',
                  id: 'sqlGenerationTool',
                },
              },
              {
                source:
                  '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL/src/mastra/workflows/database-query-workflow.ts',
                destination:
                  '/Users/grzegorzlobinski/Work/mastra/examples/agent/src/mastra/workflows/databaseQueryWorkflow.ts',
                unit: {
                  kind: 'workflow',
                  id: 'databaseQueryWorkflow',
                },
              },
              {
                source:
                  '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL/src/mastra/agents/sql-agent.ts',
                destination: '/Users/grzegorzlobinski/Work/mastra/examples/agent/src/mastra/agents/sqlAgent.ts',
                unit: {
                  kind: 'agent',
                  id: 'sqlAgent',
                },
              },
            ],
            conflictsResolved: [
              {
                unit: {
                  kind: 'other',
                  id: 'index',
                },
                issue: 'File exists - skipped: index.ts',
                resolution: 'No specific resolution found for other index',
                actualWork: false,
              },
            ],
          },
          endTime: '2025-08-24T23:47:25.984Z',
        },
      },
    },
    currentStep: {
      id: 'package-merge',
      status: 'running',
      startTime: '2025-08-24T23:47:25.984Z',
      stepCallId: '1c9c0029-e45e-4a37-a7a8-a771b9f2ac38',
      payload: {
        commitSha: 'acccf3b4f77f7fe9e5d8e4baeef143cdf4d84a0f',
        slug: 'text-to-sql',
        targetPath: '/Users/grzegorzlobinski/Work/mastra/examples/agent',
        templateDir: '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL',
        orderedUnits: [
          {
            kind: 'tool',
            id: 'databaseIntrospectionTool',
            file: 'src/mastra/tools/database-introspection-tool.ts',
          },
          {
            kind: 'tool',
            id: 'databaseSeedingTool',
            file: 'src/mastra/tools/database-seeding-tool.ts',
          },
          {
            kind: 'tool',
            id: 'sqlExecutionTool',
            file: 'src/mastra/tools/sql-execution-tool.ts',
          },
          {
            kind: 'tool',
            id: 'sqlGenerationTool',
            file: 'src/mastra/tools/sql-generation-tool.ts',
          },
          {
            kind: 'workflow',
            id: 'databaseQueryWorkflow',
            file: 'src/mastra/workflows/database-query-workflow.ts',
          },
          {
            kind: 'agent',
            id: 'sqlAgent',
            file: 'src/mastra/agents/sql-agent.ts',
          },
          {
            kind: 'other',
            id: 'index',
            file: 'src/mastra/index.ts',
          },
        ],
        copiedFiles: [
          {
            source:
              '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL/src/mastra/tools/database-introspection-tool.ts',
            destination:
              '/Users/grzegorzlobinski/Work/mastra/examples/agent/src/mastra/tools/databaseIntrospectionTool.ts',
            unit: {
              kind: 'tool',
              id: 'databaseIntrospectionTool',
            },
          },
          {
            source:
              '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL/src/mastra/tools/database-seeding-tool.ts',
            destination: '/Users/grzegorzlobinski/Work/mastra/examples/agent/src/mastra/tools/databaseSeedingTool.ts',
            unit: {
              kind: 'tool',
              id: 'databaseSeedingTool',
            },
          },
          {
            source:
              '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL/src/mastra/tools/sql-execution-tool.ts',
            destination: '/Users/grzegorzlobinski/Work/mastra/examples/agent/src/mastra/tools/sqlExecutionTool.ts',
            unit: {
              kind: 'tool',
              id: 'sqlExecutionTool',
            },
          },
          {
            source:
              '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL/src/mastra/tools/sql-generation-tool.ts',
            destination: '/Users/grzegorzlobinski/Work/mastra/examples/agent/src/mastra/tools/sqlGenerationTool.ts',
            unit: {
              kind: 'tool',
              id: 'sqlGenerationTool',
            },
          },
          {
            source:
              '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL/src/mastra/workflows/database-query-workflow.ts',
            destination:
              '/Users/grzegorzlobinski/Work/mastra/examples/agent/src/mastra/workflows/databaseQueryWorkflow.ts',
            unit: {
              kind: 'workflow',
              id: 'databaseQueryWorkflow',
            },
          },
          {
            source:
              '/var/folders/xx/f2rz03c13v59rw89132psf7w0000gn/T/mastra-template-9UTNkL/src/mastra/agents/sql-agent.ts',
            destination: '/Users/grzegorzlobinski/Work/mastra/examples/agent/src/mastra/agents/sqlAgent.ts',
            unit: {
              kind: 'agent',
              id: 'sqlAgent',
            },
          },
        ],
        conflictsResolved: [
          {
            unit: {
              kind: 'other',
              id: 'index',
            },
            issue: 'File exists - skipped: index.ts',
            resolution: 'No specific resolution found for other index',
            actualWork: false,
          },
        ],
      },
      startedAt: 1756079245974,
    },
  },
};

export const workflowInfo = {
  name: 'agent-builder-template',
  description:
    'Merges a Mastra template repository into the current project using intelligent AgentBuilder-powered merging',
  steps: {
    'clone-template': {
      id: 'clone-template',
      description: 'Clone the template repository to a temporary directory at the specified ref',
      inputSchema:
        '{"json":{"type":"object","properties":{"repo":{"type":"string","description":"Git URL or local path of the template repo"},"ref":{"type":"string","description":"Tag/branch/commit to checkout (defaults to main/master)"},"slug":{"type":"string","description":"Slug for branch/scripts; defaults to inferred from repo"},"targetPath":{"type":"string","description":"Project path to merge into; defaults to current directory"}},"required":["repo"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      outputSchema:
        '{"json":{"type":"object","properties":{"templateDir":{"type":"string"},"commitSha":{"type":"string"},"slug":{"type":"string"},"success":{"type":"boolean"},"error":{"type":"string"}},"required":["templateDir","commitSha","slug"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
    },
    'analyze-package': {
      id: 'analyze-package',
      description: 'Analyze the template package.json to extract dependency information',
      inputSchema:
        '{"json":{"type":"object","properties":{"templateDir":{"type":"string"},"commitSha":{"type":"string"},"slug":{"type":"string"},"success":{"type":"boolean"},"error":{"type":"string"}},"required":["templateDir","commitSha","slug"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      outputSchema:
        '{"json":{"type":"object","properties":{"name":{"type":"string"},"version":{"type":"string"},"description":{"type":"string"},"dependencies":{"type":"object","additionalProperties":{"type":"string"}},"devDependencies":{"type":"object","additionalProperties":{"type":"string"}},"peerDependencies":{"type":"object","additionalProperties":{"type":"string"}},"scripts":{"type":"object","additionalProperties":{"type":"string"}},"success":{"type":"boolean"},"error":{"type":"string"}},"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
    },
    'discover-units': {
      id: 'discover-units',
      description: 'Discover template units by analyzing the templates directory structure',
      inputSchema:
        '{"json":{"type":"object","properties":{"templateDir":{"type":"string"},"commitSha":{"type":"string"},"slug":{"type":"string"},"success":{"type":"boolean"},"error":{"type":"string"}},"required":["templateDir","commitSha","slug"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      outputSchema:
        '{"json":{"type":"object","properties":{"units":{"type":"array","items":{"type":"object","properties":{"kind":{"type":"string","enum":["mcp-server","tool","workflow","agent","integration","network","other"]},"id":{"type":"string"},"file":{"type":"string"}},"required":["kind","id","file"],"additionalProperties":false}},"success":{"type":"boolean"},"error":{"type":"string"}},"required":["units"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
    },
    'order-units': {
      id: 'order-units',
      description: 'Sort units in topological order based on kind weights',
      inputSchema:
        '{"json":{"type":"object","properties":{"units":{"type":"array","items":{"type":"object","properties":{"kind":{"type":"string","enum":["mcp-server","tool","workflow","agent","integration","network","other"]},"id":{"type":"string"},"file":{"type":"string"}},"required":["kind","id","file"],"additionalProperties":false}},"success":{"type":"boolean"},"error":{"type":"string"}},"required":["units"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      outputSchema:
        '{"json":{"type":"object","properties":{"orderedUnits":{"type":"array","items":{"type":"object","properties":{"kind":{"type":"string","enum":["mcp-server","tool","workflow","agent","integration","network","other"]},"id":{"type":"string"},"file":{"type":"string"}},"required":["kind","id","file"],"additionalProperties":false}},"success":{"type":"boolean"},"error":{"type":"string"}},"required":["orderedUnits"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
    },
    'prepare-branch': {
      id: 'prepare-branch',
      description: 'Create or switch to integration branch before modifications',
      inputSchema:
        '{"json":{"type":"object","properties":{"slug":{"type":"string"},"commitSha":{"type":"string"},"targetPath":{"type":"string"}},"required":["slug"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      outputSchema:
        '{"json":{"type":"object","properties":{"branchName":{"type":"string"},"success":{"type":"boolean"},"error":{"type":"string"}},"required":["branchName"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
    },
    'package-merge': {
      id: 'package-merge',
      description: 'Merge template package.json dependencies into target project',
      inputSchema:
        '{"json":{"type":"object","properties":{"commitSha":{"type":"string"},"slug":{"type":"string"},"targetPath":{"type":"string"},"packageInfo":{"type":"object","properties":{"name":{"type":"string"},"version":{"type":"string"},"description":{"type":"string"},"dependencies":{"type":"object","additionalProperties":{"type":"string"}},"devDependencies":{"type":"object","additionalProperties":{"type":"string"}},"peerDependencies":{"type":"object","additionalProperties":{"type":"string"}},"scripts":{"type":"object","additionalProperties":{"type":"string"}},"success":{"type":"boolean"},"error":{"type":"string"}},"additionalProperties":false}},"required":["commitSha","slug","packageInfo"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      outputSchema:
        '{"json":{"type":"object","properties":{"success":{"type":"boolean"},"applied":{"type":"boolean"},"message":{"type":"string"},"error":{"type":"string"}},"required":["success","applied","message"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
    },
    install: {
      id: 'install',
      description: 'Install packages based on merged package.json',
      inputSchema:
        '{"json":{"type":"object","properties":{"targetPath":{"type":"string","description":"Path to the project to install packages in"}},"required":["targetPath"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      outputSchema:
        '{"json":{"type":"object","properties":{"success":{"type":"boolean"},"error":{"type":"string"}},"required":["success"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
    },
    'programmatic-file-copy': {
      id: 'programmatic-file-copy',
      description: 'Programmatically copy template files to target project based on ordered units',
      inputSchema:
        '{"json":{"type":"object","properties":{"orderedUnits":{"type":"array","items":{"type":"object","properties":{"kind":{"type":"string","enum":["mcp-server","tool","workflow","agent","integration","network","other"]},"id":{"type":"string"},"file":{"type":"string"}},"required":["kind","id","file"],"additionalProperties":false}},"templateDir":{"type":"string"},"commitSha":{"type":"string"},"slug":{"type":"string"},"targetPath":{"type":"string"}},"required":["orderedUnits","templateDir","commitSha","slug"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      outputSchema:
        '{"json":{"type":"object","properties":{"success":{"type":"boolean"},"copiedFiles":{"type":"array","items":{"type":"object","properties":{"source":{"type":"string"},"destination":{"type":"string"},"unit":{"type":"object","properties":{"kind":{"type":"string"},"id":{"type":"string"}},"required":["kind","id"],"additionalProperties":false}},"required":["source","destination","unit"],"additionalProperties":false}},"conflicts":{"type":"array","items":{"type":"object","properties":{"unit":{"type":"object","properties":{"kind":{"type":"string"},"id":{"type":"string"}},"required":["kind","id"],"additionalProperties":false},"issue":{"type":"string"},"sourceFile":{"type":"string"},"targetFile":{"type":"string"}},"required":["unit","issue","sourceFile","targetFile"],"additionalProperties":false}},"message":{"type":"string"},"error":{"type":"string"}},"required":["success","copiedFiles","conflicts","message"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
    },
    'intelligent-merge': {
      id: 'intelligent-merge',
      description: 'Use AgentBuilder to intelligently merge template files',
      inputSchema:
        '{"json":{"type":"object","properties":{"conflicts":{"type":"array","items":{"type":"object","properties":{"unit":{"type":"object","properties":{"kind":{"type":"string"},"id":{"type":"string"}},"required":["kind","id"],"additionalProperties":false},"issue":{"type":"string"},"sourceFile":{"type":"string"},"targetFile":{"type":"string"}},"required":["unit","issue","sourceFile","targetFile"],"additionalProperties":false}},"copiedFiles":{"type":"array","items":{"type":"object","properties":{"source":{"type":"string"},"destination":{"type":"string"},"unit":{"type":"object","properties":{"kind":{"type":"string"},"id":{"type":"string"}},"required":["kind","id"],"additionalProperties":false}},"required":["source","destination","unit"],"additionalProperties":false}},"templateDir":{"type":"string"},"commitSha":{"type":"string"},"slug":{"type":"string"},"targetPath":{"type":"string"},"branchName":{"type":"string"}},"required":["conflicts","copiedFiles","templateDir","commitSha","slug"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      outputSchema:
        '{"json":{"type":"object","properties":{"success":{"type":"boolean"},"applied":{"type":"boolean"},"message":{"type":"string"},"conflictsResolved":{"type":"array","items":{"type":"object","properties":{"unit":{"type":"object","properties":{"kind":{"type":"string"},"id":{"type":"string"}},"required":["kind","id"],"additionalProperties":false},"issue":{"type":"string"},"resolution":{"type":"string"}},"required":["unit","issue","resolution"],"additionalProperties":false}},"error":{"type":"string"}},"required":["success","applied","message","conflictsResolved"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
    },
    'validation-and-fix': {
      id: 'validation-and-fix',
      description: 'Validate the merged template code and fix any issues using a specialized agent',
      inputSchema:
        '{"json":{"type":"object","properties":{"commitSha":{"type":"string"},"slug":{"type":"string"},"targetPath":{"type":"string"},"templateDir":{"type":"string"},"orderedUnits":{"type":"array","items":{"type":"object","properties":{"kind":{"type":"string","enum":["mcp-server","tool","workflow","agent","integration","network","other"]},"id":{"type":"string"},"file":{"type":"string"}},"required":["kind","id","file"],"additionalProperties":false}},"copiedFiles":{"type":"array","items":{"type":"object","properties":{"source":{"type":"string"},"destination":{"type":"string"},"unit":{"type":"object","properties":{"kind":{"type":"string"},"id":{"type":"string"}},"required":["kind","id"],"additionalProperties":false}},"required":["source","destination","unit"],"additionalProperties":false}},"conflictsResolved":{"type":"array","items":{"type":"object","properties":{"unit":{"type":"object","properties":{"kind":{"type":"string"},"id":{"type":"string"}},"required":["kind","id"],"additionalProperties":false},"issue":{"type":"string"},"resolution":{"type":"string"}},"required":["unit","issue","resolution"],"additionalProperties":false}},"maxIterations":{"type":"number","default":5}},"required":["commitSha","slug","templateDir","orderedUnits","copiedFiles"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      outputSchema:
        '{"json":{"type":"object","properties":{"success":{"type":"boolean"},"applied":{"type":"boolean"},"message":{"type":"string"},"validationResults":{"type":"object","properties":{"valid":{"type":"boolean"},"errorsFixed":{"type":"number"},"remainingErrors":{"type":"number"}},"required":["valid","errorsFixed","remainingErrors"],"additionalProperties":false},"error":{"type":"string"}},"required":["success","applied","message","validationResults"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
    },
  },
  allSteps: {
    'clone-template': {
      id: 'clone-template',
      description: 'Clone the template repository to a temporary directory at the specified ref',
      inputSchema:
        '{"json":{"type":"object","properties":{"repo":{"type":"string","description":"Git URL or local path of the template repo"},"ref":{"type":"string","description":"Tag/branch/commit to checkout (defaults to main/master)"},"slug":{"type":"string","description":"Slug for branch/scripts; defaults to inferred from repo"},"targetPath":{"type":"string","description":"Project path to merge into; defaults to current directory"}},"required":["repo"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      outputSchema:
        '{"json":{"type":"object","properties":{"templateDir":{"type":"string"},"commitSha":{"type":"string"},"slug":{"type":"string"},"success":{"type":"boolean"},"error":{"type":"string"}},"required":["templateDir","commitSha","slug"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      isWorkflow: false,
    },
    'analyze-package': {
      id: 'analyze-package',
      description: 'Analyze the template package.json to extract dependency information',
      inputSchema:
        '{"json":{"type":"object","properties":{"templateDir":{"type":"string"},"commitSha":{"type":"string"},"slug":{"type":"string"},"success":{"type":"boolean"},"error":{"type":"string"}},"required":["templateDir","commitSha","slug"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      outputSchema:
        '{"json":{"type":"object","properties":{"name":{"type":"string"},"version":{"type":"string"},"description":{"type":"string"},"dependencies":{"type":"object","additionalProperties":{"type":"string"}},"devDependencies":{"type":"object","additionalProperties":{"type":"string"}},"peerDependencies":{"type":"object","additionalProperties":{"type":"string"}},"scripts":{"type":"object","additionalProperties":{"type":"string"}},"success":{"type":"boolean"},"error":{"type":"string"}},"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      isWorkflow: false,
    },
    'discover-units': {
      id: 'discover-units',
      description: 'Discover template units by analyzing the templates directory structure',
      inputSchema:
        '{"json":{"type":"object","properties":{"templateDir":{"type":"string"},"commitSha":{"type":"string"},"slug":{"type":"string"},"success":{"type":"boolean"},"error":{"type":"string"}},"required":["templateDir","commitSha","slug"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      outputSchema:
        '{"json":{"type":"object","properties":{"units":{"type":"array","items":{"type":"object","properties":{"kind":{"type":"string","enum":["mcp-server","tool","workflow","agent","integration","network","other"]},"id":{"type":"string"},"file":{"type":"string"}},"required":["kind","id","file"],"additionalProperties":false}},"success":{"type":"boolean"},"error":{"type":"string"}},"required":["units"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      isWorkflow: false,
    },
    'order-units': {
      id: 'order-units',
      description: 'Sort units in topological order based on kind weights',
      inputSchema:
        '{"json":{"type":"object","properties":{"units":{"type":"array","items":{"type":"object","properties":{"kind":{"type":"string","enum":["mcp-server","tool","workflow","agent","integration","network","other"]},"id":{"type":"string"},"file":{"type":"string"}},"required":["kind","id","file"],"additionalProperties":false}},"success":{"type":"boolean"},"error":{"type":"string"}},"required":["units"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      outputSchema:
        '{"json":{"type":"object","properties":{"orderedUnits":{"type":"array","items":{"type":"object","properties":{"kind":{"type":"string","enum":["mcp-server","tool","workflow","agent","integration","network","other"]},"id":{"type":"string"},"file":{"type":"string"}},"required":["kind","id","file"],"additionalProperties":false}},"success":{"type":"boolean"},"error":{"type":"string"}},"required":["orderedUnits"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      isWorkflow: false,
    },
    'prepare-branch': {
      id: 'prepare-branch',
      description: 'Create or switch to integration branch before modifications',
      inputSchema:
        '{"json":{"type":"object","properties":{"slug":{"type":"string"},"commitSha":{"type":"string"},"targetPath":{"type":"string"}},"required":["slug"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      outputSchema:
        '{"json":{"type":"object","properties":{"branchName":{"type":"string"},"success":{"type":"boolean"},"error":{"type":"string"}},"required":["branchName"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      isWorkflow: false,
    },
    'package-merge': {
      id: 'package-merge',
      description: 'Merge template package.json dependencies into target project',
      inputSchema:
        '{"json":{"type":"object","properties":{"commitSha":{"type":"string"},"slug":{"type":"string"},"targetPath":{"type":"string"},"packageInfo":{"type":"object","properties":{"name":{"type":"string"},"version":{"type":"string"},"description":{"type":"string"},"dependencies":{"type":"object","additionalProperties":{"type":"string"}},"devDependencies":{"type":"object","additionalProperties":{"type":"string"}},"peerDependencies":{"type":"object","additionalProperties":{"type":"string"}},"scripts":{"type":"object","additionalProperties":{"type":"string"}},"success":{"type":"boolean"},"error":{"type":"string"}},"additionalProperties":false}},"required":["commitSha","slug","packageInfo"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      outputSchema:
        '{"json":{"type":"object","properties":{"success":{"type":"boolean"},"applied":{"type":"boolean"},"message":{"type":"string"},"error":{"type":"string"}},"required":["success","applied","message"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      isWorkflow: false,
    },
    install: {
      id: 'install',
      description: 'Install packages based on merged package.json',
      inputSchema:
        '{"json":{"type":"object","properties":{"targetPath":{"type":"string","description":"Path to the project to install packages in"}},"required":["targetPath"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      outputSchema:
        '{"json":{"type":"object","properties":{"success":{"type":"boolean"},"error":{"type":"string"}},"required":["success"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      isWorkflow: false,
    },
    'programmatic-file-copy': {
      id: 'programmatic-file-copy',
      description: 'Programmatically copy template files to target project based on ordered units',
      inputSchema:
        '{"json":{"type":"object","properties":{"orderedUnits":{"type":"array","items":{"type":"object","properties":{"kind":{"type":"string","enum":["mcp-server","tool","workflow","agent","integration","network","other"]},"id":{"type":"string"},"file":{"type":"string"}},"required":["kind","id","file"],"additionalProperties":false}},"templateDir":{"type":"string"},"commitSha":{"type":"string"},"slug":{"type":"string"},"targetPath":{"type":"string"}},"required":["orderedUnits","templateDir","commitSha","slug"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      outputSchema:
        '{"json":{"type":"object","properties":{"success":{"type":"boolean"},"copiedFiles":{"type":"array","items":{"type":"object","properties":{"source":{"type":"string"},"destination":{"type":"string"},"unit":{"type":"object","properties":{"kind":{"type":"string"},"id":{"type":"string"}},"required":["kind","id"],"additionalProperties":false}},"required":["source","destination","unit"],"additionalProperties":false}},"conflicts":{"type":"array","items":{"type":"object","properties":{"unit":{"type":"object","properties":{"kind":{"type":"string"},"id":{"type":"string"}},"required":["kind","id"],"additionalProperties":false},"issue":{"type":"string"},"sourceFile":{"type":"string"},"targetFile":{"type":"string"}},"required":["unit","issue","sourceFile","targetFile"],"additionalProperties":false}},"message":{"type":"string"},"error":{"type":"string"}},"required":["success","copiedFiles","conflicts","message"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      isWorkflow: false,
    },
    'intelligent-merge': {
      id: 'intelligent-merge',
      description: 'Use AgentBuilder to intelligently merge template files',
      inputSchema:
        '{"json":{"type":"object","properties":{"conflicts":{"type":"array","items":{"type":"object","properties":{"unit":{"type":"object","properties":{"kind":{"type":"string"},"id":{"type":"string"}},"required":["kind","id"],"additionalProperties":false},"issue":{"type":"string"},"sourceFile":{"type":"string"},"targetFile":{"type":"string"}},"required":["unit","issue","sourceFile","targetFile"],"additionalProperties":false}},"copiedFiles":{"type":"array","items":{"type":"object","properties":{"source":{"type":"string"},"destination":{"type":"string"},"unit":{"type":"object","properties":{"kind":{"type":"string"},"id":{"type":"string"}},"required":["kind","id"],"additionalProperties":false}},"required":["source","destination","unit"],"additionalProperties":false}},"templateDir":{"type":"string"},"commitSha":{"type":"string"},"slug":{"type":"string"},"targetPath":{"type":"string"},"branchName":{"type":"string"}},"required":["conflicts","copiedFiles","templateDir","commitSha","slug"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      outputSchema:
        '{"json":{"type":"object","properties":{"success":{"type":"boolean"},"applied":{"type":"boolean"},"message":{"type":"string"},"conflictsResolved":{"type":"array","items":{"type":"object","properties":{"unit":{"type":"object","properties":{"kind":{"type":"string"},"id":{"type":"string"}},"required":["kind","id"],"additionalProperties":false},"issue":{"type":"string"},"resolution":{"type":"string"}},"required":["unit","issue","resolution"],"additionalProperties":false}},"error":{"type":"string"}},"required":["success","applied","message","conflictsResolved"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      isWorkflow: false,
    },
    'validation-and-fix': {
      id: 'validation-and-fix',
      description: 'Validate the merged template code and fix any issues using a specialized agent',
      inputSchema:
        '{"json":{"type":"object","properties":{"commitSha":{"type":"string"},"slug":{"type":"string"},"targetPath":{"type":"string"},"templateDir":{"type":"string"},"orderedUnits":{"type":"array","items":{"type":"object","properties":{"kind":{"type":"string","enum":["mcp-server","tool","workflow","agent","integration","network","other"]},"id":{"type":"string"},"file":{"type":"string"}},"required":["kind","id","file"],"additionalProperties":false}},"copiedFiles":{"type":"array","items":{"type":"object","properties":{"source":{"type":"string"},"destination":{"type":"string"},"unit":{"type":"object","properties":{"kind":{"type":"string"},"id":{"type":"string"}},"required":["kind","id"],"additionalProperties":false}},"required":["source","destination","unit"],"additionalProperties":false}},"conflictsResolved":{"type":"array","items":{"type":"object","properties":{"unit":{"type":"object","properties":{"kind":{"type":"string"},"id":{"type":"string"}},"required":["kind","id"],"additionalProperties":false},"issue":{"type":"string"},"resolution":{"type":"string"}},"required":["unit","issue","resolution"],"additionalProperties":false}},"maxIterations":{"type":"number","default":5}},"required":["commitSha","slug","templateDir","orderedUnits","copiedFiles"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      outputSchema:
        '{"json":{"type":"object","properties":{"success":{"type":"boolean"},"applied":{"type":"boolean"},"message":{"type":"string"},"validationResults":{"type":"object","properties":{"valid":{"type":"boolean"},"errorsFixed":{"type":"number"},"remainingErrors":{"type":"number"}},"required":["valid","errorsFixed","remainingErrors"],"additionalProperties":false},"error":{"type":"string"}},"required":["success","applied","message","validationResults"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
      isWorkflow: false,
    },
  },
  stepGraph: [
    {
      type: 'step',
      step: {
        id: 'clone-template',
        description: 'Clone the template repository to a temporary directory at the specified ref',
      },
    },
    {
      type: 'step',
      step: {
        id: 'mapping_9763e03b-8c53-4ab1-b675-96ebb9826f94',
        mapConfig:
          'async ({ getStepResult }) => {\n  const cloneResult = getStepResult(cloneTemplateStep);\n  if (shouldAbortWorkflow(cloneResult)) {\n    throw new Error(`Critical failure in clone step: ${cloneResult.error}`);\n  }\n  return cloneResult;\n}',
      },
    },
    {
      type: 'parallel',
      steps: [
        {
          type: 'step',
          step: {
            id: 'analyze-package',
            description: 'Analyze the template package.json to extract dependency information',
          },
        },
        {
          type: 'step',
          step: {
            id: 'discover-units',
            description: 'Discover template units by analyzing the templates directory structure',
          },
        },
      ],
    },
    {
      type: 'step',
      step: {
        id: 'mapping_12005b63-8929-4d58-b04e-0f9aace60b9f',
        mapConfig:
          'async ({ getStepResult }) => {\n  const analyzeResult = getStepResult(analyzePackageStep);\n  const discoverResult = getStepResult(discoverUnitsStep);\n  if (shouldAbortWorkflow(analyzeResult)) {\n    throw new Error(`Failure in analyze package step: ${analyzeResult.error || "Package analysis failed"}`);\n  }\n  if (shouldAbortWorkflow(discoverResult)) {\n    throw new Error(`Failure in discover units step: ${discoverResult.error || "Unit discovery failed"}`);\n  }\n  return discoverResult;\n}',
      },
    },
    {
      type: 'step',
      step: {
        id: 'order-units',
        description: 'Sort units in topological order based on kind weights',
      },
    },
    {
      type: 'step',
      step: {
        id: 'mapping_9748160d-0d6f-4b5e-a80e-a581de4ca07f',
        mapConfig:
          'async ({ getStepResult, getInitData }) => {\n  const cloneResult = getStepResult(cloneTemplateStep);\n  const initData = getInitData();\n  return {\n    commitSha: cloneResult.commitSha,\n    slug: cloneResult.slug,\n    targetPath: initData.targetPath\n  };\n}',
      },
    },
    {
      type: 'step',
      step: {
        id: 'prepare-branch',
        description: 'Create or switch to integration branch before modifications',
      },
    },
    {
      type: 'step',
      step: {
        id: 'mapping_7fd28d2e-7016-4189-ae79-e63b7d455f31',
        mapConfig:
          'async ({ getStepResult, getInitData }) => {\n  const cloneResult = getStepResult(cloneTemplateStep);\n  const packageResult = getStepResult(analyzePackageStep);\n  const initData = getInitData();\n  return {\n    commitSha: cloneResult.commitSha,\n    slug: cloneResult.slug,\n    targetPath: initData.targetPath,\n    packageInfo: packageResult\n  };\n}',
      },
    },
    {
      type: 'step',
      step: {
        id: 'package-merge',
        description: 'Merge template package.json dependencies into target project',
      },
    },
    {
      type: 'step',
      step: {
        id: 'mapping_87226e2b-903a-4224-8599-dfa980e7ba09',
        mapConfig:
          'async ({ getInitData }) => {\n  const initData = getInitData();\n  return {\n    targetPath: initData.targetPath\n  };\n}',
      },
    },
    {
      type: 'step',
      step: {
        id: 'install',
        description: 'Install packages based on merged package.json',
      },
    },
    {
      type: 'step',
      step: {
        id: 'mapping_56698d76-6b37-4e45-8c93-284160c53ee4',
        mapConfig:
          'async ({ getStepResult, getInitData }) => {\n  const cloneResult = getStepResult(cloneTemplateStep);\n  const orderResult = getStepResult(orderUnitsStep);\n  const installResult = getStepResult(installStep);\n  const initData = getInitData();\n  if (shouldAbortWorkflow(installResult)) {\n    throw new Error(`Failure in install step: ${installResult.error || "Install failed"}`);\n  }\n  return {\n    orderedUnits: orderResult.orderedUnits,\n    templateDir: cloneResult.templateDir,\n    commitSha: cloneResult.commitSha,\n    slug: cloneResult.slug,\n    targetPath: initData.targetPath\n  };\n}',
      },
    },
    {
      type: 'step',
      step: {
        id: 'programmatic-file-copy',
        description: 'Programmatically copy template files to target project based on ordered units',
      },
    },
    {
      type: 'step',
      step: {
        id: 'mapping_d9db151b-3d76-44e4-9402-eb14982b12c9',
        mapConfig:
          'async ({ getStepResult, getInitData }) => {\n  const copyResult = getStepResult(programmaticFileCopyStep);\n  const cloneResult = getStepResult(cloneTemplateStep);\n  const initData = getInitData();\n  return {\n    conflicts: copyResult.conflicts,\n    copiedFiles: copyResult.copiedFiles,\n    commitSha: cloneResult.commitSha,\n    slug: cloneResult.slug,\n    targetPath: initData.targetPath,\n    templateDir: cloneResult.templateDir\n  };\n}',
      },
    },
    {
      type: 'step',
      step: {
        id: 'intelligent-merge',
        description: 'Use AgentBuilder to intelligently merge template files',
      },
    },
    {
      type: 'step',
      step: {
        id: 'mapping_5455a414-d312-4fe3-97af-61d4c8eb470f',
        mapConfig:
          'async ({ getStepResult, getInitData }) => {\n  const cloneResult = getStepResult(cloneTemplateStep);\n  const orderResult = getStepResult(orderUnitsStep);\n  const copyResult = getStepResult(programmaticFileCopyStep);\n  const mergeResult = getStepResult(intelligentMergeStep);\n  const initData = getInitData();\n  return {\n    commitSha: cloneResult.commitSha,\n    slug: cloneResult.slug,\n    targetPath: initData.targetPath,\n    templateDir: cloneResult.templateDir,\n    orderedUnits: orderResult.orderedUnits,\n    copiedFiles: copyResult.copiedFiles,\n    conflictsResolved: mergeResult.conflictsResolved\n  };\n}',
      },
    },
    {
      type: 'step',
      step: {
        id: 'validation-and-fix',
        description: 'Validate the merged template code and fix any issues using a specialized agent',
      },
    },
    {
      type: 'step',
      step: {
        id: 'mapping_925f73c5-a66d-4d60-94a2-12c9c0ece601',
        mapConfig:
          'async ({ getStepResult }) => {\n  const cloneResult = getStepResult(cloneTemplateStep);\n  const analyzeResult = getStepResult(analyzePackageStep);\n  const discoverResult = getStepResult(discoverUnitsStep);\n  const orderResult = getStepResult(orderUnitsStep);\n  const prepareBranchResult = getStepResult(prepareBranchStep);\n  const packageMergeResult = getStepResult(packageMergeStep);\n  const installResult = getStepResult(installStep);\n  const copyResult = getStepResult(programmaticFileCopyStep);\n  const intelligentMergeResult = getStepResult(intelligentMergeStep);\n  const validationResult = getStepResult(validationAndFixStep);\n  const branchName = prepareBranchResult.branchName;\n  const allErrors = [\n    cloneResult.error,\n    analyzeResult.error,\n    discoverResult.error,\n    orderResult.error,\n    prepareBranchResult.error,\n    packageMergeResult.error,\n    installResult.error,\n    copyResult.error,\n    intelligentMergeResult.error,\n    validationResult.error\n  ].filter(Boolean);\n  const overallSuccess = cloneResult.success !== false && analyzeResult.success !== false && discoverResult.success !== false && orderResult.success !== false && prepareBranchResult.success !== false && packageMergeResult.success !== false && installResult.success !== false && copyResult.success !== false && intelligentMergeResult.success !== false && validationResult.success !== false;\n  const messages = [];\n  if (copyResult.copiedFiles?.length > 0) {\n    messages.push(`${copyResult.copiedFiles.length} files copied`);\n  }\n  if (copyResult.conflicts?.length > 0) {\n    messages.push(`${copyResult.conflicts.length} conflicts skipped`);\n  }\n  if (intelligentMergeResult.conflictsResolved?.length > 0) {\n    messages.push(`${intelligentMergeResult.conflictsResolved.length} conflicts resolved`);\n  }\n  if (validationResult.validationResults?.errorsFixed > 0) {\n    messages.push(`${validationResult.validationResults.errorsFixed} validation errors fixed`);\n  }\n  const comprehensiveMessage = messages.length > 0 ? `Template merge completed: ${messages.join(", ")}` : validationResult.message || "Template merge completed";\n  return {\n    success: overallSuccess,\n    applied: validationResult.applied || copyResult.copiedFiles?.length > 0 || false,\n    message: comprehensiveMessage,\n    validationResults: validationResult.validationResults,\n    error: allErrors.length > 0 ? allErrors.join("; ") : void 0,\n    errors: allErrors.length > 0 ? allErrors : void 0,\n    branchName,\n    // Additional debugging info\n    stepResults: {\n      cloneSuccess: cloneResult.success,\n      analyzeSuccess: analyzeResult.success,\n      discoverSuccess: discoverResult.success,\n      orderSuccess: orderResult.success,\n      prepareBranchSuccess: prepareBranchResult.success,\n      packageMergeSuccess: packageMergeResult.success,\n      installSuccess: installResult.success,\n      copySuccess: copyResult.success,\n      mergeSuccess: intelligentMergeResult.success,\n      validationSuccess: validationResult.success,\n      filesCopied: copyResult.copiedFiles?.length || 0,\n      conflictsSkipped: copyResult.conflicts?.length || 0,\n      conflictsResolved: intelligentMergeResult.conflictsResolved?.length || 0\n    }\n  };\n}',
      },
    },
  ],
  inputSchema:
    '{"json":{"type":"object","properties":{"repo":{"type":"string","description":"Git URL or local path of the template repo"},"ref":{"type":"string","description":"Tag/branch/commit to checkout (defaults to main/master)"},"slug":{"type":"string","description":"Slug for branch/scripts; defaults to inferred from repo"},"targetPath":{"type":"string","description":"Project path to merge into; defaults to current directory"}},"required":["repo"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
  outputSchema:
    '{"json":{"type":"object","properties":{"success":{"type":"boolean"},"applied":{"type":"boolean"},"branchName":{"type":"string"},"message":{"type":"string"},"validationResults":{"type":"object","properties":{"valid":{"type":"boolean"},"errorsFixed":{"type":"number"},"remainingErrors":{"type":"number"}},"required":["valid","errorsFixed","remainingErrors"],"additionalProperties":false},"error":{"type":"string"},"errors":{"type":"array","items":{"type":"string"}},"stepResults":{"type":"object","properties":{"cloneSuccess":{"type":"boolean"},"analyzeSuccess":{"type":"boolean"},"discoverSuccess":{"type":"boolean"},"orderSuccess":{"type":"boolean"},"prepareBranchSuccess":{"type":"boolean"},"packageMergeSuccess":{"type":"boolean"},"installSuccess":{"type":"boolean"},"copySuccess":{"type":"boolean"},"mergeSuccess":{"type":"boolean"},"validationSuccess":{"type":"boolean"},"filesCopied":{"type":"number"},"conflictsSkipped":{"type":"number"},"conflictsResolved":{"type":"number"}},"required":["filesCopied","conflictsSkipped","conflictsResolved"],"additionalProperties":false}},"required":["success","applied","message"],"additionalProperties":false,"$schema":"http://json-schema.org/draft-07/schema#"}}',
};
