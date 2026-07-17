import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './styles.css';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

function App() {
  const [url, setUrl] = useState('');
  const [markdown, setMarkdown] = useState('');
  const [status, setStatus] = useState('Paste a public GitHub repository URL to begin.');
  const [busy, setBusy] = useState(false);

  async function generate(event) {
    event.preventDefault();
    if (!url.trim()) return setStatus('Enter a public GitHub repository URL.');
    setBusy(true); setMarkdown(''); setStatus('Reading repository files from GitHub…');
    try {
      const infoResponse = await fetch(`${API_BASE}/repo-info?url=${encodeURIComponent(url.trim())}`);
      const info = await infoResponse.json();
      if (!infoResponse.ok) throw new Error(info.error || 'Could not fetch repository information.');
      setStatus(`Analyzing ${info.repository.fullName} and writing your README…`);
      const response = await fetch(`${API_BASE}/generate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ context: info }) });
      if (!response.ok) { const error = await response.json(); throw new Error(error.error || 'README generation failed.'); }
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let result = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        result += decoder.decode(value, { stream: true }); setMarkdown(result);
      }
      result += decoder.decode(); setMarkdown(result); setStatus('README generated. Review it before committing.');
    } catch (error) { setStatus(error.message || 'Something went wrong.'); }
    finally { setBusy(false); }
  }

  async function copy() {
    try { await navigator.clipboard.writeText(markdown); setStatus('README copied to clipboard.'); }
    catch { setStatus('Could not copy automatically. Select the Markdown and copy it manually.'); }
  }
  function download() {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'README.md' });
    link.click(); URL.revokeObjectURL(link.href);
  }

  return <main>
    <header><a className="brand" href="/">README <span>Forge</span></a><p>AI-assisted documentation for public repositories.</p></header>
    <section className="hero"><p className="eyebrow">GITHUB → CONTEXT → README</p><h1>Turn source code into a <em>credible</em> README.</h1><p className="lede">README Forge examines a public repository’s tree and key source files, then streams a professional Markdown draft for your review.</p>
      <form onSubmit={generate}><label htmlFor="repo-url">Public GitHub repository URL</label><div className="input-row"><input id="repo-url" value={url} onChange={(e) => setUrl(e.target.value)} type="url" placeholder="https://github.com/owner/repository" required disabled={busy} /><button disabled={busy}>{busy ? 'Generating…' : 'Generate README'}</button></div></form>
      <p className="status" role="status" aria-live="polite">{status}</p>
    </section>
    <section className="workspace" aria-label="Generated README workspace"><div className="panel"><div className="panel-head"><h2>Markdown</h2><div><button className="small" onClick={copy} disabled={!markdown}>Copy</button><button className="small" onClick={download} disabled={!markdown}>Download .md</button></div></div><pre>{markdown || '# Your generated README will appear here'}</pre></div>
    <div className="panel preview"><div className="panel-head"><h2>Live preview</h2><span>{markdown ? 'Streaming' : 'Waiting'}</span></div><article>{markdown ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown> : <p>Your formatted documentation will appear here as Claude writes it.</p>}</article></div></section>
    <footer>Uses public GitHub API data and Claude. Always verify generated documentation before publishing.</footer>
  </main>;
}
createRoot(document.getElementById('root')).render(<App />);
