# 知潮 · 分工契约（CONTRACTS）

> 两个角色，一份工作流。凡是与本文冲突的旧约定，以本文为准。
> 更新本文件 = 结构或规则变更，必须同步写 `OPS-CHANGELOG.md`。

## 一、角色

| 角色 | 负责 | 唯一可写的目录 |
|---|---|---|
| **A 形象设计师** | 设定文档、立绘、表情差分、时装、场景图、开场视频、配音 | `design/` |
| **B 开发运维** | 全部前端与后端代码、素材落地与适配、部署、三端同步、数据校验 | `cloud/`、`server/`、`backend/`、`scripts/`、`dev/`、`docs/` |

设计侧**不写代码、不跑预览、不做部署**；开发侧**不改设计源文件**。

## 二、素材取用（`design/` 不入库）

```
design/（只在本机，不进 git）── 按需取用 + 转 webp ──▶ cloud/assets/ ── 部署 ──▶ 服务器
```

- `design/` 是设计源，**只存在于本机**。`.gitignore` 的 `3c` 段已排除 `design/art/`、`design/audio/`、`design/video/`，不要用 `git add -f` 强行入库。
- 开发侧需要素材时**主动从 design 取**，按页面用途裁剪并**转成 webp** 再放 `cloud/assets/`：立绘、贴纸、表情、场景、分层件统一 webp（透明通道保留）；视频、音频照原格式。
- 转格式与裁剪是**落地工序，由开发做**；设计师只交付原始设计稿，不负责压 webp、不负责改路径。
- **禁止反向**：不得从 `cloud/assets/` 覆盖 `design/`，也不得在 `cloud/assets/` 里直接改图（会与设计源漂移）。
- 代码里引用的永远是 `cloud/assets/` 下的 webp，禁止直接引用 `design/` 路径（线上没有这个目录）。

## 三、数据文件铁律（最容易出事的地方）

`cloud/data/current.json`、`changelog.json`、`music.json` 由每日策展与更新日志写入，**数据流永远是 云端/服务器 → 本地**。

- 允许：从线上拉取最新数据到本地，用于本地预览。
- **禁止**：把本地的 `data/*.json` 推回线上。本地那份大概率是旧的，一推就会把当天的热点和日志覆盖掉。
- 部署时如必须带 data，只允许推 `music.json`（人工配置，不由脚本写）；`current.json` / `changelog.json` 一律排除。

## 四、本地开发工作流（日终一次同步）

原来的问题是"每改一点就在云端改 → 同步本地 → 推服务器"，一天来回多次，时间全花在搬运上。改成：

**白天只在本地 `E:\知潮` 改，云端与服务器完全不碰。**

| 阶段 | 动作 | 频率 |
|---|---|---|
| 白天 | 在 `E:\知潮` 改代码/资源，`docker compose up -d` 起本地站验证，随时 `git commit` | 随意，多次 |
| 日终 | 本地跑一遍验证 → `git commit` → 一次性同步到云端 → 部署服务器 | **每天 1 次** |
| 次日开工 | 只把线上新增的 `data/*.json` 拉回本地 | 每天 1 次 |

前提（三条，缺一条这套流程就会崩）：

1. **云端 `/home/user/zhichao` 不再作为编辑目标**，只做部署中转。谁在云端直接改了代码，日终同步都会冲突或覆盖。
2. **本地是唯一开发源**，`git` 是唯一回滚手段。改动前确认 `git status` 干净或已提交。
3. **本地必须有预览闸门**。`docker compose up -d` 起本地站（http://127.0.0.1:8811/）+ 截图确认，过了才允许日终部署；否则白天改崩的东西会一次性全推上去。

**本地环境与线上同构（唯一一套）**：`docker compose up -d` 起两个容器 —— `zhichao-web`（nginx，挂 `cloud/` 与 `server/default-live.conf`）与 `zhichao-memory`（Python，跑 `server/server-live.py`）。代码、nginx 配置、鉴权、聊天代理与线上完全相同，不存在“本地简化版”。密钥放 `E:\知潮\.env`（已 gitignore），本地口令 `zhichao`。

## 五、两条独立通道：代码走 git，数据走定时任务

这是两件事，绝不能混。

| 通道 | 内容 | 起点 | 终点 | 触发方式 |
|---|---|---|---|---|
| **代码** | `cloud/`（不含 data）、`server/`、`js/`、`styles/`、`assets/`、文档 | 本地 `E:\知潮` | 云电脑 + 服务器 | 人工：本地 `git push`，两端各自 `git pull` |
| **数据** | `cloud/data/` 下的 `current.json`、`changelog.json`、`music.json` 及对应 `.gz` | 云电脑 `/home/user/zhichao/cloud/data` | 服务器 `/opt/zhichao/data` | 定时任务「知潮每日策展」`7 */2 * * *` → `node scripts/push-lighthouse.ts` → scp + 线上复核 |

**铁律：数据不经过 git，代码不经过定时任务。**

日终（或任一部署窗口）按此执行：

```
1. git status / git diff       确认改了什么，应只有代码、没有 data
2. docker compose up -d        本地起站（nginx + 后端，与线上同一套）
3. 浏览器/截图确认              闸门，不过就回滚
4. git add -A && git commit    留下回滚点
5. git push                    推到远端（github / origin）
6. 云电脑 git pull             只拿代码；数据由定时任务自理，不干预
7. 服务器 git pull / 部署脚本   只拿代码；改后端的 restart zhichao-memory，改 nginx 的 reload
8. 写 OPS-CHANGELOG.md         结构/配置/部署变更必须写，未写视为未完成
```

数据通道完全自理：定时任务每 2 小时读 `industry/domains.ts`、`cloud/data/current.json`、`.data/published.json`，产出新条目后 scp 到 `/opt/zhichao/data/current.json` 并线上复核。**任何人不许手工往服务器推 data，也不许把 data 提交进 git**——两条路同时写同一个文件必然互相覆盖。

## 六、禁止事项

1. 不拆 `index.html` 的页面分区（HTML 结构仅 27 KB，拆了只涨请求数）。样式和脚本**必须外链**：新增功能写进 `styles/*.css` 或 `js/*.js`，**禁止再往 `index.html` 里写内联 `<style>`/`<script>`**。
2. 设计侧不得提交任何 `.js` / `.css` / `.html` 改动。
3. 开发侧不得修改 `design/spec/` 里的设定（文案落地时按原文引用）。
4. 不得手工复制同一份共享文件到多个目录；共享一律引用单一真源。
5. 部署权只有开发运维一人，设计师不参与发布。
