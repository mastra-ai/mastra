import fs from 'fs-extra'
import path from 'node:path'
import process from 'process'; 

import React from 'react';
import {Text} from 'ink';

async function init (f: any) {
  try {
    await fs.outputJson(f, {config: ''})

    // const data = await fs.readJson(f)

    console.log(`writing bfconfig.json`) // => JP
  } catch (err) {
    console.error(err)
  }
}

export default function Init() {
  init(path.join(process.cwd(), 'bfconfig.json'))
	return <Text>This should write to bfconfig.json</Text>;
}

