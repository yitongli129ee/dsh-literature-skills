// dsh-literature-skills — 把随包携带的三个文献调研技能安装到 ~/.dsh/skills/。
// 安装这个插件（dsh plugin add）并重启后，三个 SKILL.md 目录即落到技能目录，
// agent 即可按名调用。幂等：已存在的技能目录不会覆盖（保留用户本地修改）。
import { homedir } from 'node:os';
import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const name = 'dsh-literature-skills';

function log(ctx, level, message) {
  const logger = ctx && ctx.logger;
  if (logger && typeof logger[level] === 'function') {
    logger[level](message);
  } else {
    // eslint-disable-next-line no-console
    console[level === 'warn' ? 'warn' : 'log'](message);
  }
}

export function apply(ctx) {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = join(here, 'skills');
  const dst = join(homedir(), '.dsh', 'skills');
  try {
    if (!existsSync(src)) {
      log(ctx, 'warn', `[dsh-literature-skills] bundled skills/ not found at ${src}`);
      return;
    }
    mkdirSync(dst, { recursive: true });
    let installed = 0;
    for (const entry of readdirSync(src, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const target = join(dst, entry.name);
      if (existsSync(target)) continue; // 幂等：不覆盖已有技能
      cpSync(join(src, entry.name), target, { recursive: true });
      installed += 1;
    }
    log(ctx, 'info', `[dsh-literature-skills] ${installed} skill(s) installed into ${dst}`);
  } catch (error) {
    log(ctx, 'warn', `[dsh-literature-skills] install failed: ${error && error.message ? error.message : error}`);
  }
}
