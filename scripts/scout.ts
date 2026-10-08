import { db } from '../src/db/index';
import { layaPredict } from '../src/lib/providers/laya-decision';
import { repoVectors } from '../src/lib/repo-vectors';
import { generateEmbeddings } from '../src/lib/embeddings';
import { PROJECT_SELECT, projectFromRow } from '../src/lib/connected-projects';
import { createNeedDrivenIntelligence } from '../src/lib/need-driven-intelligence';
import type { ProjectNeed } from '../src/lib/need-driven-intelligence';

async function main() {
  const repoId = process.argv[2];
  const requirement = process.argv.slice(3).join(' ');

  if (!repoId || !requirement) {
    console.error('Usage: npx tsx scripts/scout.ts <repo_id> "<natural language requirement>"');
    process.exit(1);
  }

  console.log(`\n🔍 Scouting candidates for repo ${repoId}...`);
  console.log(`💡 Requirement: "${requirement}"\n`);

  // 1. Load project context
  const projectResult = await db.execute({
    sql: `${PROJECT_SELECT} WHERE up.repo_id = ? LIMIT 1`,
    args: [Number(repoId)],
  });

  if (projectResult.rows.length === 0) {
    console.error('Project not found in database.');
    process.exit(1);
  }
  const project = projectFromRow(projectResult.rows[0]);

  // 2. Initialize pipeline
  const run = createNeedDrivenIntelligence({
    database: db,
    vectorStore: repoVectors,
    embed: generateEmbeddings,
  });

  // We hack the pipeline slightly by passing our ad-hoc need into it.
  // In a real API, we'd expose a `runAdHocRequirement` method on the pipeline.
  // For now, we'll just mock the extraction step by inserting the need temporarily or 
  // bypassing it to run classification.
  
  // Since we want to use the deterministic pipeline, let's just use Laya to extract intents 
  // from the requirement, then run the retrieval and Laya screening.
  
  console.log('🧠 Extracting search intents from requirement...');
  const intentRes = await layaPredict({
    state: { requirement, project: project.name },
    questions: {
      intents: { type: 'choice', instructions: 'Extract 3-5 short search keywords for this requirement. Return as comma separated.' }
    }
  });

  const intents = (intentRes.answers.intents?.choice ?? requirement).split(',').map((s: string) => s.trim());
  
  const customNeed: ProjectNeed = {
    id: 'custom-ad-hoc',
    title: requirement,
    currentState: 'N/A',
    desiredOutcome: requirement,
    priority: 'high',
    constraints: [],
    evidence: ['User provided requirement'],
    searchIntents: intents,
    signature: 'custom-' + Date.now()
  };

  const deps = {
    database: db,
    vectorStore: repoVectors,
    embed: generateEmbeddings,
  };

  const projectConstraintsHash = 'custom-cli-hash';
  const catalogGeneration = new Date().toISOString().slice(0, 10);

  console.log('🔍 Retrieving candidate pool...');
  const { retrieveCandidatesForNeed, classifyAndRank } = await import('../src/lib/need-driven-intelligence');
  
  const retrieval = await retrieveCandidatesForNeed({
    need: customNeed,
    project,
    projectConstraintsHash,
    catalogGeneration,
    deps,
  });

  console.log(`🔎 Found ${retrieval.candidateIds.length} candidate IDs (${retrieval.mode}). Ranking...`);

  const classified = await classifyAndRank({
    project,
    need: customNeed,
    candidateIds: retrieval.candidateIds,
    deps,
    candidatesPerNeed: 5,
  });

  console.log('\n======================================================');
  console.log('✅ Final Candidates for your requirement');
  console.log('======================================================\n');
  
  for (const c of classified) {
    console.log(`Repository: ${c.fullName} (${c.htmlUrl})`);
    console.log(`Fit: ${c.classification} [Score: ${c.score}]`);
    console.log(`Evidence & Laya Decisions:\n  - ${c.evidence.join('\n  - ')}`);
    console.log(`Stats: ${c.stargazersCount} ⭐ | Archived: ${c.archived ? 'Yes' : 'No'} | Lang: ${c.language}`);
    console.log(`Description: ${c.description}`);
    console.log('------------------------------------------------------');
  }
  
  process.exit(0);
}

main().catch(console.error);
