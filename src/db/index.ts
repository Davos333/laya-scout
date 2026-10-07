import { getCloudflareContext } from '@opennextjs/cloudflare';

import { createD1Client, type D1DatabaseLike, type DbClient } from './client';
import { getLibsqlClient } from '@/lib/providers/libsql-client';

let _client: DbClient | undefined;
function getClient(): DbClient {
  if (!_client) {
    if (process.env.LIBSQL_URL) {
      _client = getLibsqlClient(process.env.LIBSQL_URL, process.env.LIBSQL_AUTH_TOKEN);
      return _client;
    }
    const { env } = getCloudflareContext();
    const database = (env as { DB?: D1DatabaseLike }).DB;
    if (!database) throw new Error('Cloudflare D1 binding DB is unavailable');
    _client = createD1Client(database);
  }
  return _client;
}

export const db = new Proxy({} as DbClient, {
  get(_, prop) {
    const client = getClient();
    const value = Reflect.get(client, prop);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
