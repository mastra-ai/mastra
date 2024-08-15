import fs from 'fs-extra';
import path from 'node:path';
import process from 'process';

import React from 'react';
import {Text} from 'ink';
import {execa, ExecaError} from 'execa';

function init(configFilePath: string) {
	try {
		// Check to make sure a package.json file exists..
		const packageJsonPath = path.join(process.cwd(), 'package.json');
		if (!fs.pathExistsSync(packageJsonPath)) {
			console.log('No package.json file found in the current directory');
			return false;
		}

		// Check to make sure `@arkw/core` is installed.
		const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
		if (!packageJson.dependencies || !packageJson.dependencies['core']) {
			console.log(
				'Please install @arkw/core before running this command (npm install @arkw/core)',
			);
			return false;
		}

		// Check if a config file already exists.
		// const configFilePath = path.join(process.cwd(), 'arkw.config.ts');
		if (fs.pathExistsSync(configFilePath)) {
			console.log(
				'Arkwright configuration file (arkw.config.ts) already exists',
			);
			return false;
		}

		const config = generateBoilerplateConfig();
		fs.outputFileSync(configFilePath, config);

		return config;
	} catch (err) {
		console.error(err);
		return false;
	}
}

async function migrate(createOnly = false) {
	function log(message: any, isError = false) {
		const timestamp = new Date().toISOString();
		const formattedMessage = `[${timestamp}] ${message}\n`;

		if (isError) {
			process.stderr.write(formattedMessage);
		} else {
			process.stdout.write(formattedMessage);
		}
	}
	console.log('Migrating database...');
	try {
		// TODO: get this working in project dir rather than cli dir
		// TODO: prompt user for db URL or create sqllite db

		const INJECT_DB_URL = `FUTURE_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/arkwright?schema=public"`;

		const PRISMA_BIN = `./node_modules/core/node_modules/prisma/node_modules/.bin`;

		const PRISMA_SCHEMA = `node_modules/core/src/prisma/schema.prisma`;

		const CREATE_ONLY = createOnly ? `--create-only` : ``;

		const migrateCommand = execa(
			`${INJECT_DB_URL} ${PRISMA_BIN}/prisma migrate dev ${CREATE_ONLY} --schema=${PRISMA_SCHEMA} --name initial_migration`,
			{
				env: process.env,
				shell: true,
				all: true,
			},
		);

		migrateCommand.all.on('data', (data: any) => {
			const output = data.toString().trim();
			log(output);
		});

		await migrateCommand;
	} catch (error: any) {
		if (error instanceof ExecaError) {
			console.log(error);
		}
		log(`Error: ${error.message}`, true);
		if (error.stderr) {
			log(`stderr: ${error.stderr}`, true);
		}
	} finally {
	}
}

export default function Init() {
	const config = init(path.join(process.cwd(), 'arkw.config.ts'));

	// TODO: merge output from migrate better with config file text results
	migrate();

	if (config) {
		return <Text>Arkwright configuration file written to arkw.config.ts</Text>;
	}

	return <Text>An Error occurred</Text>;
}

// TODO: Move this to core
function generateBoilerplateConfig() {
	return `
import { Config, createFramework } from 'core';
import { MailchimpIntegration } from 'future-mailchimp'

export const config: Config = {
  name: 'kepler',
  //logConfig: {}, // TODO: Add this
  systemActions: [],
  systemEvents: [],
  plugins: [
    new MailchimpIntegration({
      config: {
        CLIENT_ID: process.env.MAILCHIMP_CLIENT_ID!,
        CLIENT_SECRET: process.env.MAILCHIMP_CLIENT_SECRET!,
        REDIRECT_URI: ''
      }
    }),
  ],
  db: {
    provider: 'postgres',
    uri: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres?schema=future',
  },
};
  `;
}
