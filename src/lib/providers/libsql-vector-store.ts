import type { DbClient } from '@/db/client';
import type { RepoVectorMatch } from '@/lib/repo-vectors';

export function createLibsqlVectorStore(db: DbClient) {
  return {
    async query(vector: number[], topK: number): Promise<RepoVectorMatch[]> {
      const vectorStr = `[${vector.join(',')}]`;
      const result = await db.execute({
        sql: `SELECT repo_id, vector_distance_cos(embedding, vector(?)) AS distance
              FROM repo_embeddings
              ORDER BY distance ASC
              LIMIT ?`,
        args: [vectorStr, topK]
      });
      return result.rows.map(row => ({
        repoId: Number(row.repo_id),
        distance: Number(row.distance)
      }));
    },
    async queryByRepoId(repoId: number, topK: number): Promise<RepoVectorMatch[]> {
      const result = await db.execute({
        sql: `SELECT repo_id, vector_distance_cos(embedding, (SELECT embedding FROM repo_embeddings WHERE repo_id = ?)) AS distance
              FROM repo_embeddings
              WHERE repo_id != ?
              ORDER BY distance ASC
              LIMIT ?`,
        args: [repoId, repoId, topK]
      });
      return result.rows.map(row => ({
        repoId: Number(row.repo_id),
        distance: Number(row.distance)
      }));
    }
  };
}
