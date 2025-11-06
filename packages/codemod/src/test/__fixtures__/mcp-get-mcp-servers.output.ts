// @ts-nocheck

import { Mastra } from '@mastra/core';

const mastra = new Mastra({});

const servers = await mastra.listMCPServers();
