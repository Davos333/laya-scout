export async function embedOllama(
  texts: string[],
  url = 'http://192.168.20.252:11434',
  model = 'nomic-embed-text'
): Promise<number[][]> {
  const result = await fetch(`${url}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      input: texts
    })
  });
  
  if (!result.ok) {
    throw new Error(`Ollama embed failed: ${result.statusText}`);
  }
  
  const data = await result.json() as { embeddings: number[][] };
  return data.embeddings;
}
