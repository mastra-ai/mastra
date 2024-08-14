import React from 'react';
import {Text} from 'ink';

import {execa, ExecaError} from 'execa';

async function startNextDevServer() {
	function log(message: any, isError = false) {
		const timestamp = new Date().toISOString();
		const formattedMessage = `[${timestamp}] ${message}\n`;

		if (isError) {
			process.stderr.write(formattedMessage);
		} else {
			process.stdout.write(formattedMessage);
		}
	}

	log('Starting Next.js dev server...');

	try {
		// TODO: get output re-colorized
		// TODO: fix cwd so it works from project directory, not just from the cli directory
		const nextServer = execa(
			`PROJECT_DIRECTORY=${process.cwd()} npm run dev -- -p 3456`,
			{
				cwd: './node_modules/@arkw/admin',
				all: true,
				buffer: false,
				env: process.env,
				shell: true,
			},
		);

		nextServer.all.on('data', (data: any) => {
			const output = data.toString().trim();
			log(output);

			if (output.includes('compiled successfully')) {
				log('Next.js dev server is ready!');
			}
		});

		process.on('SIGINT', async () => {
			log('Stopping Next.js dev server...');
			await nextServer.kill();
			process.exit();
		});

		await nextServer;
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

startNextDevServer().catch(console.error);

export default function Dev() {
	return <Text>This should open up the Next.js dev server on port 3456</Text>;
}
