---
name: academic-web-research
description: Fetch academic literature through the configured Clash proxy — Google Scholar, CNKI (知网), and open-access article pages/abstracts — and download PDFs, while keeping token usage minimal. Use when the user asks to search or read papers, abstracts, or download PDFs from Google Scholar, CNKI, arXiv, Semantic Scholar, Crossref, PubMed, or journal sites.
whenToUse: When the user wants literature/abstracts/papers from Google Scholar or CNKI, or wants a PDF downloaded. Prefer targeted web_fetch of a specific URL over broad web_search.
---

# Academic web research (Scholar + CNKI + PDF) via proxy

This machine reaches the internet through a local Clash proxy (Japan node):

- Proxy: `http://127.0.0.1:7897` (Clash "verge-mihomo" mixed-port).
- `web_fetch` and `web_source` already route through it automatically
  (env `DSH_WEB_SEARCH_PROXY` is set). No per-call flag needed.
- `web_search`'s backend is keyless Wikipedia by default — fine for quick
  lookups, but for papers it is usually better to `web_fetch` a search URL
  directly (this is also the cheapest-token path).

## Google Scholar (foreign — goes through proxy)

Search and read results via `web_fetch` on the Scholar search URL:

```
https://scholar.google.com/scholar?q=<url-encoded query>&hl=en
```

- Read titles/snippets/links from the returned HTML.
- To read a specific paper, `web_fetch` its result URL (publisher page,
  arXiv, Semantic Scholar, etc.).
- `web_source` can be used when you need the raw HTML markers (e.g. to
  distinguish a "PDF" link from the title link), but prefer `web_fetch`.

## CNKI / 知网 (China — Clash routes it DIRECT)

`web_fetch` the CNKI search or abstract page directly:

```
https://kns.cnki.net/kns8s/defaultresult/index?kw=<query>
```

- CNKI abstract pages are server-rendered; `web_fetch` returns the text.
- Full text usually requires login. If the user already has a CNKI tab open
  in their browser, ask them (or drive the browser) rather than scraping.

## Literature & abstracts (free APIs — minimal tokens)

Prefer these machine-readable endpoints; each returns clean JSON/text:

- Crossref (verified 200): `https://api.crossref.org/works?query.title=<query>&rows=5&select=title,abstract`
- arXiv API: `http://export.arxiv.org/api/query?search_query=all:<query>`
- PubMed E-utilities: `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=<query>`
- Semantic Scholar: often 429 from this shared IP — prefer Crossref/arXiv/PubMed, or add a free S2 API key.

Fetch these with `web_fetch`; parse the JSON/text you need only.

(Google Scholar direct `web_fetch` is verified working through this proxy — 200 + full results page.)

## Downloading PDFs

`web_fetch` returns text only — it cannot download binaries. Use `pwsh` +
curl with the proxy flag for foreign hosts:

```powershell
curl.exe -L -x http://127.0.0.1:7897 -o "C:\...\paper.pdf" "<pdf-url>"
```

- Foreign PDFs (arXiv, journal sites): keep `-x http://127.0.0.1:7897`.
- CNKI / Chinese hosts: the proxy flag is harmless (Clash sends CN DIRECT),
  so you can keep it for all downloads.

## Token discipline

- One targeted `web_fetch` beats several `web_search` calls.
- Set `rows`/`maxResults` low (3–5) and read only the fields you need.
- Prefer JSON APIs (Crossref/S2) over scraping HTML pages when possible.
