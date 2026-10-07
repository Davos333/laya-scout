import { describe, expect, it } from 'vitest';
import { layaPredict } from '@/lib/providers/laya-decision';
import benchmarkData from './fixtures/benchmark-corpus.json';
import pLimit from 'p-limit';

describe('LAIYA Benchmark', () => {
  it('should correctly classify candidate repositories against human ground truth', async () => {
    let correct = 0;
    let falsePositives = 0;
    let falseNegatives = 0;
    
    const limit = pLimit(5);
    
    const results = await Promise.all(
      benchmarkData.needs.flatMap((need) => 
        need.candidates.map((candidate) => limit(async () => {
          const state = {
            project_intent: "Benchmark Evaluation Project",
            need: need.title,
            outcome: need.desired_outcome,
            candidate_name: candidate.repo,
            candidate_desc: candidate.notes,
            candidate_topics: ""
          };
          
          try {
            const response = await layaPredict({
              state,
              questions: {
                solves_need: {
                  type: 'noul',
                  instructions: 'Does this repository address the stated need and desired outcome?'
                }
              }
            });
            return {
              repo: candidate.repo,
              need: need.title,
              expected: candidate.expected_fit,
              noul: response.answers.solves_need?.noul ?? 0.5
            };
          } catch (e) {
            console.error(`Error processing ${candidate.repo}:`, e);
            return null;
          }
        }))
      )
    );
    
    let strictlyEvaluatedCount = 0;
    console.log('\n--- LAIYA Benchmark Breakdown ---');

    for (const res of results) {
      if (!res) continue;
      
      const { expected, noul, repo, need } = res;
      
      if (expected === 'high') {
        strictlyEvaluatedCount++;
        if (noul >= 0.6) {
          correct++;
        } else {
          falseNegatives++;
          console.warn(`[FALSE NEGATIVE] Laya scored ${repo} as ${noul} (Expected: High) for need: ${need}`);
        }
      } else if (expected === 'low') {
        strictlyEvaluatedCount++;
        if (noul <= 0.4) {
          correct++;
        } else {
          falsePositives++;
          console.warn(`[FALSE POSITIVE] Laya scored ${repo} as ${noul} (Expected: Low) for need: ${need}`);
        }
      } else {
        // Medium - neutral classification
        console.log(`[NEUTRAL/MEDIUM] Laya scored ${repo} as ${noul} (Expected: Medium) for need: ${need}`);
      }
    }
    
    const accuracy = strictlyEvaluatedCount > 0 ? (correct / strictlyEvaluatedCount) : 0;
    
    console.log('\n--- LAIYA Final Results ---');
    console.log(`Total Candidates Evaluated (High/Low only): ${strictlyEvaluatedCount}`);
    console.log(`Accuracy: ${(accuracy * 100).toFixed(1)}%`);
    console.log(`False Positives: ${falsePositives}`);
    console.log(`False Negatives: ${falseNegatives}`);
    console.log('---------------------------\n');
    
    // We expect at least 65% accuracy against the ground truth labels for our zero-shot baseline
    expect(accuracy).toBeGreaterThan(0.65);
  }, 120_000); // 2 minute timeout
});
