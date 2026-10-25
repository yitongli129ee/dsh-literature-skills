---
name: academic-literature-research
description: Fully automated literature research — turn keywords, a topic, or a DOI into papers, abstracts, and full-text PDFs across Google Scholar, IEEE Xplore, CNKI (知网), Wanfang (万方), and Sci-Hub. Use when the user asks to research a topic, find papers, get an abstract, or download a paper/thesis PDF (Chinese or English), or mentions Scholar / IEEE / CNKI / 知网 / 万方 / Sci-Hub / DOI.
whenToUse: When the user gives keywords/topic/DOI and wants literature found, abstracts extracted, or PDFs downloaded; or when they name Google Scholar, IEEE Xplore, CNKI, Wanfang, or Sci-Hub.
---

# Automated literature research (Scholar · IEEE · CNKI · Wanfang · Sci-Hub)

Pipeline: **keywords / DOI → search hits → abstract → full-text PDF**.
It drives a **controllable Chrome** over the DevTools Protocol (CDP) through the local
Clash proxy. Institutional access (深圳大学城图书馆) covers IEEE / CNKI / Wanfang.

## 0. Prerequisites (verify once)

| Thing | Value |
|---|---|
| Node (bundled) | `C:\Users\Administrator\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe` |
| Python (bundled) | `...\dependencies\python\python.exe` (add `pypdf` if needed) |
| Chrome/Edge | auto-detected by `scripts\launch-chrome.ps1` (or pass `-ChromePath`) |
| Proxy | optional — ask the user. If they have one, pass `-Proxy http://127.0.0.1:7890` (example) |

Launch the controllable Chrome (auto-detects the browser; proxy optional; CDP on 9222):

```powershell
pwsh -File "<skill>\scripts\launch-chrome.ps1"                            # no proxy
pwsh -File "<skill>\scripts\launch-chrome.ps1" -Proxy http://127.0.0.1:7890  # with proxy
```

Verify: `node "<skill>\scripts\cdp.mjs" tabs` lists the `about:blank` page.
**Never reuse the user's normal Chrome window** — it has no CDP.

## 1. The CDP primitive

All page work goes through `scripts/cdp.mjs`:

```
node cdp.mjs tabs
node cdp.mjs read  [tabMatch]
node cdp.mjs nav   "<url>" [tabMatch]
node cdp.mjs eval  "<jsExpression>" [tabMatch]
node cdp.mjs click "<cssSelector>" [tabMatch]
node cdp.mjs set   "<cssSelector>" "<value>" [tabMatch]
```

- `tabMatch` = substring of a tab URL (`cnki`, `wanfang`, `ieeexplore`, `scholar`, `sci-hub`).
- `nav` waits `CDP_WAIT_MS` (default 12000) then prints `STATE / TEXT / LINKS`.
- **Never `eval` while the page is navigating** — the execution context is destroyed and
  the call hangs. Pattern: `set`/`click` → exit → `read` after a sleep.

## 2. Google Scholar (English + Chinese papers, via proxy)

```
node cdp.mjs nav "https://scholar.google.com/scholar?hl=en&q=<urlencoded>" scholar
```

- Result blocks are `<div class="gs_r gs_or gs_scl">`; parse title / link / meta.
- `[PDF]` entries are often open-access — download them directly (§7).
- If a search returns related-but-not-exact hits, retry with the exact title in quotes,
  or resolve the DOI/metadata first with Crossref (§6).

## 3. IEEE Xplore (English full text, institutional)

1. `node cdp.mjs nav "https://doi.org/<DOI>" ieeexplore` → redirects to
   `https://ieeexplore.ieee.org/document/<arnumber>`.
2. When the page shows `Access provided by: …`, the **HTML full text** (SECTION I–V +
   REFERENCES) is present. Save it:
   `node cdp.mjs eval "document.body.innerText" ieeexplore`
3. The `Abstract:` block gives the abstract.
4. PDF: `https://ieeexplore.ieee.org/stamp/stamp.jsp?tp=&arnumber=<arnumber>`.

## 4. CNKI 知网 (Chinese theses / journals)

> CNKI shows a **Tencent slider CAPTCHA**. The **user must drag it once** in the
> controllable Chrome window. After it passes, the session stays verified.

1. Search:
   `node cdp.mjs nav "https://kns.cnki.net/kns8s/defaultresult/index?kw=<urlencoded>" cnki`
   - If a CAPTCHA page appears, bring the window to front and ask the user to solve it.
2. If the query gets garbled (`%uXXXX` in the URL), use the homepage box instead:
   ```
   node cdp.mjs nav "https://www.cnki.net/" cnki
   node cdp.mjs set "textarea#txt_SearchText" "<query>" cnki
   node cdp.mjs click ".search-btn" cnki
   ```
3. Read the result table; each title points to
   `https://kns.cnki.net/kcms2/article/abstract?v=...` (extract from the row's `<a>`).
4. Detail page — expand the abstract, then read it:
   ```
   node cdp.mjs eval "(()=>{const a=document.querySelector('#ChDivSummaryMore');if(a){a.click();return 'ok';}return 'no more';})()" cnki
   node cdp.mjs eval "document.body.innerText" cnki
   ```
   Metadata present: 关键词, DOI, 分类号, 导师, 学科专业, 出版信息.
5. PDF: the detail page has `PDF下载` / `CAJ下载`; click the PDF link to download.

## 5. Wanfang 万方 (Chinese theses / journals)

1. Search:
   `node cdp.mjs nav "https://s.wanfangdata.com.cn/paper?q=<urlencoded>" wanfang`
2. Parse results — each item has:
   - `<span class="title">…</span>` (title, clickable)
   - `<span class="title-id-hidden">thesis_Dxxxxxxxx</span>` (id)
   - `<div class="abstract-area">摘要：…</div>` (snippet)
   - theses show `整篇下载 / 分章下载`
3. Detail: `https://d.wanfangdata.com.cn/thesis/<id-after-underscore>`
   (e.g. `thesis_D03536917` → `https://d.wanfangdata.com.cn/thesis/D03536917`).
4. The **web abstract is truncated** (ends with `…`), no expand button — the full
   abstract lives in the PDF. Download it (§7) and extract.
5. Full-text download: `https://f.wanfangdata.com.cn/download/pc/thesis/<id-after-underscore>`
   → info page says 「下载还未开始，请点击此处」; find and click the `点击此处` link.
   It debits credits (e.g. 30) from the institutional account.

## 6. Keyless metadata APIs (fastest for abstract/DOI/authors)

- Crossref: `https://api.crossref.org/works?query.title=<q>&rows=5&select=title,author,DOI,container-title,issued`
- arXiv: `http://export.arxiv.org/api/query?search_query=all:<q>`
- PubMed: `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=<q>`
- Semantic Scholar: often 429 from shared IPs — use only with an API key.

Fetch via `node cdp.mjs nav "<url>" proxy` or the `web_fetch` tool.

## 7. PDF download + text extraction

- Chrome sends downloads to `%USERPROFILE%\Downloads` even when CDP `downloadPath`
  is set — **check the default Downloads folder**.
- Extract text:
  ```
  $py -m pip install pypdf -i https://pypi.tuna.tsinghua.edu.cn/simple
  $py "<skill>\scripts\pdf-extract.py" "<pdf>" "<out.txt>" 30
  ```
- **Chinese filenames passed to Python argv get mojibake'd** — copy to an ASCII name first:
  `Copy-Item "<中文>.pdf" "thesis_<id>.pdf"`
- Find the abstract in the extracted text: search for `摘 要` / `摘要` / `Abstract` / `关键词`.

## 8. Sci-Hub (paywalled English PDFs by DOI)

**Verified working:** `sci-hub.ru` / `sci-hub.st` (with a robot check); `sci-hub.se` may be
down (`ERR_CONNECTION_CLOSED`). Use the proxy.

1. Resolve the DOI first (Crossref / IEEE page / publisher).
2. Navigate to the mirror:
   ```
   node cdp.mjs nav "https://sci-hub.ru/<DOI>" sci-hub
   ```
3. If it shows 「你是机器人吗？」 (robot check with 「不是」), click the answer — it is a
   `DIV.answer`; click once or twice and wait, the article page then loads:
   ```
   node cdp.mjs eval "(() => { const els=[...document.querySelectorAll('*')].filter(e=>e.textContent&&e.textContent.trim()==='不是'); if(!els.length) return 'NOT_FOUND'; els[els.length-1].click(); return 'CLICKED'; })()" sci-hub
   ```
4. The article page embeds the PDF in `<embed>`/`<iframe>` — extract its `src`:
   ```
   node cdp.mjs eval "JSON.stringify([...document.querySelectorAll('embed,iframe')].map(e=>e.src||e.getAttribute('src')))" sci-hub
   ```
   Example: `/storage/2024/8992/.../xiao2022.pdf#navpanes=0&view=FitH`.
5. Build the absolute URL: `https://<mirror-origin>` + src (drop the `#…` fragment), then
   download through the proxy:
   ```
   curl.exe -L -x http://127.0.0.1:7897 -o paper.pdf "https://sci-hub.ru/storage/.../xiao2022.pdf"
   ```
6. No PDF → DOI not in Sci-Hub; fall back to IEEE/publisher/institutional access.

## 9. End-to-end recipe

1. `launch-chrome.ps1` → `cdp.mjs tabs` to verify.
2. **Crossref** for DOI + authors + venue (keyless, fast).
3. **Google Scholar** for the exact record + `[PDF]` open-access links.
4. English full text: **IEEE** (institutional) → else **Sci-Hub** by DOI.
5. Chinese thesis/abstract: **CNKI** (user solves CAPTCHA) or **Wanfang** (credit-based,
   easier). Fetch detail page → abstract → download PDF.
6. `pdf-extract.py` → save `.txt`, pull the abstract.
7. Deliver: abstract inline + PDF/TXT as files (`present`).

## 10. Pitfalls (learned the hard way)

- CDP `Runtime.evaluate` value is **nested twice**: `msg.result.result.value`.
- Don't `eval` during navigation (hangs) — navigate, disconnect, sleep, reconnect.
- CNKI slider CAPTCHA needs a human; the session then stays verified.
- CNKI `%uXXXX` in the URL means the query was `escape()`d — use the search box instead.
- Wanfang titles are `<span class="title">`, not `<a>`; IDs in `.title-id-hidden`.
- Wanfang web abstract is truncated; the full one is in the PDF.
- Chrome downloads land in `%USERPROFILE%\Downloads` — check there.
- Chinese paths in Python argv → mojibake; copy to ASCII first.
- `import importlib.util` must be imported explicitly (bare `import importlib` lacks `.util`).
- The controllable Chrome is a **fresh profile** — CNKI/Wanfang may ask for CAPTCHA once;
  IEEE works via institutional IP; logins persist in the temp profile across runs.
