const GITHUB_API = 'https://api.github.com';
const MAX_FILE_BYTES = 45_000;
const MAX_SOURCE_FILES = 12;

function githubHeaders() {
  return { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'README-Forge-Demo' };
}

async function github(path) {
  const response = await fetch(`${GITHUB_API}${path}`, { headers: githubHeaders(), signal: AbortSignal.timeout(15_000) });
  if (!response.ok) {
    const error = new Error(response.status === 404 ? 'Repository was not found. It must be public.' : `GitHub request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

export function parseGithubUrl(value) {
  if (typeof value !== 'string') throw new Error('A GitHub repository URL is required.');
  const url = new URL(value.trim());
  if (!['github.com', 'www.github.com'].includes(url.hostname)) throw new Error('Please enter a github.com repository URL.');
  const parts = url.pathname.replace(/^\/+|\/+$/g, '').replace(/\.git$/, '').split('/');
  if (parts.length !== 2 || !parts.every(Boolean)) throw new Error('Use a repository URL such as https://github.com/owner/repository.');
  return { owner: parts[0], repo: parts[1] };
}

function decodeContent(file) {
  if (!file?.content || file.encoding !== 'base64') return null;
  const text = Buffer.from(file.content, 'base64').toString('utf8');
  return text.length <= MAX_FILE_BYTES ? text : `${text.slice(0, MAX_FILE_BYTES)}\n\n[File truncated for context]`;
}

export async function getRepoInfo(repoUrl) {
  const { owner, repo } = parseGithubUrl(repoUrl);
  const repository = await github(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
  const treeResponse = await github(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(repository.default_branch)}?recursive=1`);
  if (treeResponse.truncated) throw new Error('This repository tree is too large for the demo. Try a smaller public repository.');

  const tree = treeResponse.tree.filter((entry) => entry.type === 'blob').map(({ path, size }) => ({ path, size }));
  const rootSources = tree.filter(({ path, size }) => !path.includes('/') && /\.(?:js|jsx|ts|tsx|py)$/i.test(path) && size <= MAX_FILE_BYTES).slice(0, MAX_SOURCE_FILES);
  const packageFile = tree.find(({ path }) => path === 'package.json' && !path.includes('/'));
  const selected = [...(packageFile ? [packageFile] : []), ...rootSources];

  const contents = await Promise.all(selected.map(async ({ path }) => {
    const file = await github(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodeURIComponent(path)}`);
    return { path, content: decodeContent(file) };
  }));

  return {
    repository: { owner, name: repository.name, fullName: repository.full_name, description: repository.description, url: repository.html_url, defaultBranch: repository.default_branch, language: repository.language, topics: repository.topics || [], license: repository.license?.spdx_id || null },
    tree,
    keyFiles: contents.filter(({ content }) => content).map(({ path, content }) => ({ path, content }))
  };
}
