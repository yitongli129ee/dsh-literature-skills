#!/usr/bin/env node
// cdp.mjs — Chrome DevTools Protocol helper for automated literature harvesting.
// Requires a Chrome launched with --remote-debugging-port (see launch-chrome.ps1).
//
// Usage:
//   node cdp.mjs tabs
//   node cdp.mjs read [tabMatch]
//   node cdp.mjs nav <url> [tabMatch]
//   node cdp.mjs eval "<jsExpression>" [tabMatch]
//   node cdp.mjs click "<cssSelector>" [tabMatch]
//   node cdp.mjs set "<cssSelector>" "<value>" [tabMatch]
//
// Env:
//   CDP_PORT      default 9222
//   CDP_WAIT_MS   default 12000  (wait after navigate before reading)
//   CDP_MAX_TEXT  default 12000  (max chars of body text printed)

const PORT = Number(process.env.CDP_PORT || 9222);
const WAIT = Number(process.env.CDP_WAIT_MS || 12000);
const MAX_TEXT = Number(process.env.CDP_MAX_TEXT || 12000);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getTabs() {
  const r = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  return await r.json();
}

function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pend = new Map();
  ws.addEventListener('message', (ev) => {
    let m;
    try { m = JSON.parse(ev.data); } catch { return; }
    if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
  });
  return new Promise((res, rej) => {
    ws.addEventListener('open', () => res({
      ws,
      send(method, params = {}) {
        return new Promise((resolve) => {
          const i = ++id;
          pend.set(i, resolve);
          ws.send(JSON.stringify({ id: i, method, params }));
        });
      },
      async evalv(expr) {
        const r = await this.send('Runtime.evaluate', {
          expression: expr,
          returnByValue: true,
          awaitPromise: true,
        });
        // NOTE: CDP wraps the value twice: msg.result.result.value
        if (r && r.result && r.result.result) return r.result.result.value;
        if (r && r.error) return 'CDP_ERROR: ' + JSON.stringify(r.error);
        return undefined;
      },
    }));
    ws.addEventListener('error', rej);
  });
}

function pickTab(tabs, match) {
  const pages = tabs.filter((t) => t.type === 'page' && t.url && !t.url.startsWith('chrome://'));
  if (match) {
    const hit = pages.find((t) => t.url.includes(match) || (t.title || '').includes(match));
    if (hit) return hit;
  }
  return pages.find((t) => t.url && t.url.startsWith('http')) || pages[0];
}

async function readPage(c) {
  console.log('STATE:', await c.evalv('JSON.stringify({href:location.href,title:document.title,ready:document.readyState,textLen:(document.body?document.body.innerText.length:-1)})'));
  console.log('=== TEXT ===');
  console.log((await c.evalv(`document.body ? document.body.innerText.slice(0, ${MAX_TEXT}) : ''`)) || '(empty)');
  console.log('=== LINKS ===');
  console.log(await c.evalv(`JSON.stringify([...document.querySelectorAll('a[href]')].map(a=>({t:a.innerText.trim().replace(/\\s+/g,' ').slice(0,120),h:a.href})).filter(x=>x.t&&x.h.startsWith('http')).slice(0,80))`) || '[]');
}

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  if (!cmd) {
    console.error('usage: tabs | read | nav | eval | click | set');
    process.exit(1);
  }
  if (cmd === 'tabs') {
    const tabs = await getTabs();
    for (const t of tabs) if (t.type === 'page') console.log(t.url, '|', t.title);
    return;
  }

  const arg1 = argv[1];
  const arg2 = argv[2];
  const arg3 = argv[3];
  let tabMatch;
  if (cmd === 'nav') tabMatch = arg2;
  else if (cmd === 'read') tabMatch = arg1;
  else if (cmd === 'eval') tabMatch = arg2;
  else if (cmd === 'click') tabMatch = arg2;
  else if (cmd === 'set') tabMatch = arg3;

  const tabs = await getTabs();
  const tab = pickTab(tabs, tabMatch);
  if (!tab) { console.error('no page tab'); process.exit(1); }
  const c = await connect(tab.webSocketDebuggerUrl);
  try {
    if (cmd === 'read') {
      await readPage(c);
    } else if (cmd === 'nav') {
      await c.send('Page.enable');
      await c.send('Page.navigate', { url: arg1 });
      await sleep(WAIT);
      await readPage(c);
    } else if (cmd === 'eval') {
      const r = await c.evalv(arg1);
      console.log(typeof r === 'string' ? r : JSON.stringify(r));
    } else if (cmd === 'click') {
      console.log(await c.evalv(`(() => { const el = document.querySelector(${JSON.stringify(arg1)}); if (!el) return 'NO_ELEMENT'; el.click(); return 'CLICKED'; })()`));
    } else if (cmd === 'set') {
      console.log(await c.evalv(`(() => {
        const el = document.querySelector(${JSON.stringify(arg1)});
        if (!el) return 'NO_ELEMENT';
        const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        setter.call(el, ${JSON.stringify(arg2)});
        el.dispatchEvent(new Event('input', {bubbles:true}));
        el.dispatchEvent(new Event('change', {bubbles:true}));
        return 'SET:' + el.value;
      })()`));
    } else {
      console.error('unknown command', cmd);
    }
  } finally {
    c.ws.close();
  }
}

main().catch((e) => { console.error('ERR', (e && e.message) || e); process.exit(1); });
