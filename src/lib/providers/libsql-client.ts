import { createClient, type Client as LibsqlClientRaw } from '@libsql/client';
import type { DbClient } from '@/db/client';

function normalizeValue(value: any): any {
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
}

export function createLibsqlClient(client: LibsqlClientRaw): DbClient {
  return {
    async execute(statement) {
      const sql = typeof statement === 'string' ? statement : statement.sql;
      const args = typeof statement === 'string' ? [] : (statement.args ?? []).map(normalizeValue);
      const result = await client.execute({ sql, args });
      return {
        rows: result.rows as unknown as Record<string, unknown>[],
        columns: result.columns,
        rowsAffected: result.rowsAffected,
        lastInsertRowid: result.lastInsertRowid ? Number(result.lastInsertRowid) : null,
      };
    },
    async batch(statements) {
      const results = await client.batch(
        statements.map(stmt => ({
          sql: stmt.sql,
          args: (stmt.args ?? []).map(normalizeValue)
        }))
      );
      return results.map(result => ({
        rows: result.rows as unknown as Record<string, unknown>[],
        columns: result.columns,
        rowsAffected: result.rowsAffected,
        lastInsertRowid: result.lastInsertRowid ? Number(result.lastInsertRowid) : null,
      }));
    }
  };
}

export function getLibsqlClient(url: string, authToken?: string): DbClient {
  const client = createClient({ url, authToken });
  return createLibsqlClient(client);
}
