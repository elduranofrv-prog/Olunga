const MODEL = 'claude-sonnet-4-6';
const ANTHROPIC_VERSION = '2023-06-01';
const MAX_CONTEXT_CHARS = 110_000;

function compactContext(context) {
  const safe = {
    repository: context.repository,
    fileTree: context.tree.slice(0, 500).map(({ path, size }) => ({ path, size })),
    keyFiles: context.keyFiles
  };
  const serialized = JSON.stringify(safe, null, 2);
  return serialized.length > MAX_CONTEXT_CHARS ? `${serialized.slice(0, MAX_CONTEXT_CHARS)}\n[Context truncated]` : serialized;
}

export async function streamReadme(context, onText) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured on the server.');
  const prompt = `Create a polished, accurate README.md for the public GitHub repository described below. Return ONLY Markdown, beginning with a project title. Do not invent commands, features, installation steps, environment variables, or license terms that are not supported by the context. Include concise sections that fit the project when evidence exists: overview, features, installation, usage, configuration, scripts, project structure, contributing, and license. If source context is sparse, say so rather than guessing.\n\nRepository context:\n${compactContext(context)}`;
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': ANTHROPIC_VERSION, 'anthropic-dangerous-direct-browser-access': 'false' },
    body: JSON.stringify({ model: MODEL, max_tokens: 4000, stream: true, messages: [{ role: 'user', content: prompt }] }),
    signal: AbortSignal.timeout(120_000)
  });
  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`Claude request failed (${response.status}).`);
    error.status = response.status;
    error.detail = body.slice(0, 500);
    throw error;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  while (true) {
    const { value, done } = await reader.read();
    pending += decoder.decode(value || new Uint8Array(), { stream: !done });
    const events = pending.split('\n\n');
    pending = events.pop();
    for (const event of events) {
      const data = event.split('\n').find((line) => line.startsWith('data:'))?.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const message = JSON.parse(data);
        if (message.type === 'content_block_delta' && message.delta?.type === 'text_delta') onText(message.delta.text);
        if (message.type === 'error') throw new Error(message.error?.message || 'Claude streaming error.');
      } catch (error) {
        if (error instanceof SyntaxError) continue;
        throw error;
      }
    }
    if (done) break;
  }
}
