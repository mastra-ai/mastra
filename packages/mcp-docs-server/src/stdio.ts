import { prepare } from './prepare-docs/prepare';

if (process.env.REBUILD_DOCS_ON_START === 'true') {
  await prepare();
}

const { server } = await import(`./index`);

void server.start({
  transportType: 'stdio',
});
