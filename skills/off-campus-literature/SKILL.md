---
name: off-campus-literature
description: Off-campus (非校园网) access to CNKI, IEEE, and Wiley via a university WebVPN and the CARSI federation, then retrieve abstracts and full-text PDFs. Portable: works on any machine and any university, auto-detects the browser, and treats the proxy as optional. Use when the user is NOT on campus network but needs institutional access to CNKI (知网), IEEE, or Wiley, or mentions WebVPN / ivpn / CARSI / 统一身份认证 / 机构登录 / 校外访问.
whenToUse: When the user needs off-campus institutional access to CNKI/IEEE/Wiley (or mentions WebVPN / ivpn / CARSI / 统一身份认证 / 机构登录 / 校外访问), or wants literature fetched under their university identity instead of the default library.
---

# Off-campus literature access (WebVPN + CARSI, portable)

Turn off-campus requests into institutional access to CNKI / IEEE / Wiley, then run
**search → abstract → full-text PDF**. Self-contained: ships its own scripts, auto-detects
the browser, and makes the proxy optional.

## 0. Pre-flight self-check — ASK FIRST, never assume

Before doing anything, ask the user (if they haven't already told you):

1. **Browser**: Chrome or Edge installed? Where? Auto-detect:
   ```powershell
   Get-ChildItem "$env:ProgramFiles\Google\Chrome\Application\chrome.exe","${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe","$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe","$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName
   ```
   `scripts\launch-chrome.ps1` runs this automatically.

2. **Proxy**: do they need to cross the GFW / a proxy to reach the campus VPN or the
   databases?
   - **Yes** → ask for `address:port` (e.g. `http://127.0.0.1:7890`); pass `-Proxy`.
   - **No** (just off-campus, no firewall) → **skip the proxy entirely** — no Clash step,
     launch without `-Proxy`.

3. **University**: which school? Get their **WebVPN portal** and **CARSI IdP name**.

Only then proceed. The concrete example below is 哈尔滨工业大学 (HIT) + proxy
`http://127.0.0.1:7897` (Clash) — substitute with whatever the user answers.

## 1. Launch a controllable browser

```
pwsh -File scripts\launch-chrome.ps1                       # no proxy
pwsh -File scripts\launch-chrome.ps1 -Proxy http://127.0.0.1:7890
```
- Auto-detects Chrome/Edge, uses the **real profile** (logins carry over), CDP on 9222.
- **Chrome 136+ requires an explicit `--user-data-dir`** or it silently ignores the port —
  the script always passes it.
- To persist across reboots, register a startup shortcut that runs this script (see §6).

## 2. CDP primitive

`node scripts\cdp.mjs {tabs|read|nav|eval|click|set}` (optional tabMatch).
- `nav` waits `CDP_WAIT_MS` (default 12000) then prints STATE/TEXT/LINKS.
- Never `eval` while navigating (hangs): navigate → disconnect → sleep → reconnect.

## 3. CNKI via WebVPN

1. Open `http://<cnki-rewritten>.vpn.<uni>.edu.cn:1080/`
   (worked: `http://www-cnki-net.vpn.hit.edu.cn:1080/`).
2. If redirected to `ids-.../authserver/login` → the user must log in (统一身份认证).
   Bring the window to front and ask.
3. After login CNKI shows 「<大学> 个人登录」 and full text is available.

Rewrite rule: `www.cnki.net` → `www-cnki-net.vpn.<uni>.edu.cn:1080`
(dots→dashes + `.vpn.<uni>.edu.cn:1080`).

## 4. IEEE / Wiley via CARSI

1. `node scripts\cdp.mjs nav "https://ds.carsi.edu.cn/resource/resource.php" carsi`
   — first visit → CARSI login (IdP discovery).
2. Pick the IdP (their university):
   ```
   node scripts\cdp.mjs set "#show" "<大学名>" carsi
   node scripts\cdp.mjs eval "(()=>{const a=[...document.querySelectorAll('a.dropdown-item')].find(e=>e.innerText&&e.innerText.includes('<大学名>'));if(a){a.click();return 'ok';}return 'no';})()" carsi
   node scripts\cdp.mjs eval "(()=>{const b=document.querySelector('button.btn1');if(b){b.click();return 'ok';}return 'no';})()" carsi
   ```
   User logs in once on the **direct** `ids.<uni>.edu.cn` CAS if needed.
3. Find the resource id in `resource.php` (search the DB name), then:
   `node scripts\cdp.mjs nav "https://ds.carsi.edu.cn/resource/gotoResource.php?id=resource:NN" carsi`
   (worked: IEEE=`resource:6`, Wiley=`resource:601`).
4. Verify identity on the landing page (IEEE: `Access provided by: <大学>`; Wiley: header).

## 5. Search → abstract → full text

- IEEE: `node scripts\cdp.mjs nav "https://doi.org/<DOI>" ieee` → `Abstract:` + full HTML
  (SECTION I–V) when `Access provided by: …`; PDF via
  `ieeexplore.ieee.org/stamp/stamp.jsp?tp=&arnumber=<num>`.
- CNKI thesis: search → `kcms2/article/abstract?v=…` → click 「更多」 → abstract; PDF via
  `PDF下载` (one-off slider CAPTCHA).
- Wiley: open an article → PDF/full text under the institutional session.
- PDF text: `python scripts\pdf-extract.py <pdf> <out.txt> 30` (copy to an ASCII name first
  — Chinese paths break Python argv).

## 6. Persist across reboots (optional)

Register a startup task that runs `scripts\launch-chrome.ps1` with the right `-Proxy`. If the
user needs a proxy, also make sure their proxy client auto-starts first. On THIS machine that
is `D:\dsh-kb\launcher\start-dsh-cdp.ps1` (starts Clash → waits for the proxy → launches Chrome).

## 7. Gotchas (learned live)

- **Two CAS hosts**: WebVPN uses `ids-...vpn.<uni>.edu.cn`, CARSI uses the direct
  `ids.<uni>.edu.cn`; cookies are per-host → each needs its own one-time login.
- CARSI IdP selector is a Bootstrap typeahead: click the `a.dropdown-item` (not the container
  `div`), then the `button.btn1`.
- Wiley SSO may show a Cloudflare 「请稍候…」 — wait ~10s and re-read.
- CDP `Runtime.evaluate` value is nested: `msg.result.result.value`.
- Never `eval` during navigation.
- If there is no proxy and the campus VPN host is unreachable, ask the user to start their
  campus VPN client / open the WebVPN portal manually first.
