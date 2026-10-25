# dsh-literature-skills

三个文献调研**技能（skill）**打包成一个 DSH 插件：装一个，得三个。

- **academic-web-research** — 轻量版：走代理抓谷歌学术 / 知网 / arXiv / Semantic Scholar / Crossref / PubMed 的摘要与 PDF（最省 token）。
- **academic-literature-research** — 全功能版：谷歌学术 / IEEE / 知网 / 万方 / Sci-Hub 全流程（关键词 → 搜索 → 摘要 → 全文 PDF）。
- **off-campus-literature** — 校外访问版：用你学校的 WebVPN + CARSI 身份访问知网 / IEEE / Wiley（不在校园网也能用学校权限）。

## 安装

```sh
dsh plugin --profile <profile> add github:<owner>/dsh-literature-skills
```

安装并**重启 DSH** 后，三个技能目录会落到 `~/.dsh/skills/`，agent 即可按名调用。

> 技能是「给 agent 的用法说明书 + 脚本」，不含可执行的服务端代码；插件本身只在加载时把
> 这三个目录复制进技能目录（幂等：不会覆盖你已改过的同名技能）。

## 使用

装好后直接对 agent 说，例如：

- 「用 academic-literature-research 查一下 `非对称永磁电机 磁轴偏移` 的文献，要摘要和全文」
- 「用 off-campus-literature 以我校身份查知网」

## 前置条件

- DeepSeek Harness（dsh）已安装；Node ≥ 22。
- 一台能上网的电脑，装了 Chrome 或 Edge（脚本会自动探测路径）。
- 校外访问（off-campus-literature）需要你所在学校的统一身份认证账号。

## 许可

MIT
