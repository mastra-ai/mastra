import { MilvusClient } from '@zilliz/milvus2-sdk-node';

async function connect() {
  const address = '127.0.0.1:19530';
  const username = 'your-milvus-username'; // optional username
  const password = 'your-milvus-password'; // optional password
  const ssl = false; // secure or not

  // connect to milvus
  const client = new MilvusClient({ address, ssl, username, password });
  console.log(await client.getVersion());
}

export { connect };
