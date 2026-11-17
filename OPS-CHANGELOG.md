# 知潮 · 运维变更日志（OPS CHANGELOG）

> 记录定时调度、部署、运维层面的变更；站点面向访客的内容/界面变更见 `cloud/data/changelog.json`。

---

## 2026-11-16 18:37（Asia/Shanghai）｜定时任务迁移

- **变更类型**：定时任务归属对话迁移（等价重建，非规则变更）
- **触发原因**：用户要求将与知潮网站相关的定时任务全部迁移到当前对话统一管理。
- **涉及任务（2 个）**：
  1. **知潮每日策展**
     - 调度：cron `7 */2 * * *`（每 2 小时第 7 分钟）
     - 环境：云端（runtime_type=1），时区 Asia/Shanghai
  2. **知潮记忆每日压缩**
     - 调度：cron `23 3 * * *`（每日 03:23）
     - 环境：云端（runtime_type=1），时区 Asia/Shanghai
- **迁移方式**：在当前对话以完全相同的标题、调度表达式、执行指令（query）、运行环境创建新任务，确认成功后删除旧任务。
- **影响评估**：
  - 任务执行指令、调度规则、引用路径（`/home/user/zhichao`、服务器 `root@120.53.6.132`）、行为逻辑**零改动**。
  - 下次触发时间保持不变：策展 2026-11-16 20:07、记忆压缩 2026-11-17 03:23。
  - 不涉及站点代码、`index.html`、`current.json`、`changelog.json`、服务器配置及数据库改动。
- **结果**：迁移成功，无重复任务、无调度空窗。

---

## 2026-11-16 19:52（Asia/Shanghai）｜「星月手账」打卡功能上线 + 记忆容器重启

- **变更类型**：站点功能部署 + 服务端代码升级 + 定时任务规则修正
- **部署内容**：
  - `cloud/index.html`（新增侧栏首卡「汐音的星月手账」，替换原 `mascot-card`）
  - `cloud/styles/checkin.css`（新增，打卡模块专用样式）
  - `cloud/js/mascot.js`（联动打卡事件与到访台词）
  - `server/server.py`（记忆信封新增 `visits`，新增「仅合并脚印」写入分支）
  - `cloud/data/changelog.json`（追加 3 条站点变更日志）
- **流程**：本机备份 → `scp` 覆盖 → 重新生成 `.gz` 预压缩副本 → `docker restart zhichao-memory`
- **备份位置**：服务器 `/opt/zhichao-backups/20261116-1948/`（含旧 index.html(+gz)、mascot.js(+gz)、server.py、chat-memory.json）
- **影响评估**：
  - 记忆容器重启后服务端会话表清空，**旧会话 Cookie 立即失效，需重新输入访问口令**（一次）。
  - `chat-memory.json` 线程数据（mature 12 / loli 20 / cute 22）与 longTerm 未受影响；`visits` 字段在首次写入时建立。
  - 匿名访问边界不变：`/` 200，`/data/`、`/api/memory` 均 401。
  - 已验证「仅合并脚印」通道：写入 visits 不影响 threads/longTerm；旧客户端整包覆盖时已有脚印被保留。
- **定时任务**：`17256517563138`「知潮记忆每日压缩」query 更新为「visits 原样保留、不参与压缩、缺失写空数组」，调度 `23 3 * * *` 与运行环境不变。
- **结果**：部署成功，`zhichao-memory` 与 `zhichao-web` 均正常，`styles/checkin.css` 线上 200。

---

## 2026-11-16 20:10（Asia/Shanghai）｜「汐音的月晷时钟」上线

- **变更类型**：站点前端功能部署（纯静态，未改服务端，未重启容器）
- **部署内容**：
  - `cloud/styles/clock.css`（新增，`ckc-*` 全部样式，含 1180/720 断点与 reduced-motion）
  - `cloud/js/clock.js`（新增，`window.ZCClock = {mount,unmount,info,promptLine,greeting,say}`，广播 `zc:clock`/`zc:phase`/`zc:hour`）
  - `cloud/index.html`（引用 `clock.css`、`<script defer src="js/clock.js">`、新增 `section.ckc` 月晷条、`mountClock()` 挂载入口、聊天 system 注入真实时间、开场白前置时刻问候）
  - `cloud/js/mascot.js`（新增 `clock()`/`timeLines()` 与三事件监听，`greetLine()` 改为「时刻问候 + 手账状态」）
  - `cloud/data/changelog.json`（追加 3 条站点变更日志，共 79 条）
- **流程**：本机 `md5sum` 对照 → 服务器备份 → `scp` 覆盖 → `gzip -9 -c` 重生成 `.gz`（`gzip_static on` 需同步）→ 校验
- **备份位置**：服务器 `/opt/zhichao-backups/20261116-2007/`（旧 `index.html(+gz)`、`js/mascot.js(+gz)`、`data/changelog.json(+gz)`）
- **影响评估**：
  - 未改 `server.py`，**未重启 `zhichao-memory`**，线上会话与记忆数据不受影响，无需重新输入口令。
  - 上传时误放进站点根目录的 `clock.js` / `mascot.js` 副本已清理，`/opt/zhichao/` 下只保留 `index.html(+gz)` 与 `js/`、`styles/`、`data/` 等原有结构。
  - 匿名访问边界不变：`/` 200，`/data/`、`/api/memory` 均 401。
- **校验**：`index.html`、`js/clock.js`、`js/mascot.js`、`styles/clock.css`、`data/changelog.json` 线上 `md5sum` 与本机一致；`gzip -t` 全部通过；`/js/clock.js`、`/styles/clock.css` 线上 200。
- **结果**：部署成功，`zhichao-web` 正常返回，`index.html` 含 `ckc` 标记（15 处）。

---

## 2026-11-16 20:31（Asia/Shanghai）｜首屏文案与站点日志改为「汐音」口径

- **变更类型**：站点文案调整（纯静态，未改服务端、未重启容器）
- **变更内容**：
  - `cloud/data/current.json`：`site.tagline` 由「按兴趣分方向，只留值得看的。每小时由 WorkBuddy 检索核实后整理。」改为「…每小时由汐音替你翻一遍，核实过来源才记进手账。」
  - `cloud/index.html`：页脚说明「每小时由 WorkBuddy 检索各方向…」改为「每小时汐音把各方向翻一遍、核实来源后整理…」；更新日志弹窗标题由「更新日志」改为「汐音的更新手账」。
  - `cloud/data/changelog.json`：新增 1 条「首屏文案换成汐音的口气」（共 80 条）；同时把最近几节与 4 条旧记录里的文件名、命令、容器名、接口路径等改成访客看得懂的说法，技术细节只保留在本运维日志。
  - `HANDOVER-zhichao-curation.md`：数据规格一节新增约束——`site` 块（含 `tagline`）原样保留不得改写，对外文案不出现工具名/模型名/脚本名/运维词汇，一律说成「汐音翻检/整理」。
- **流程**：本机备份 → `scp` 覆盖 → `gzip -9 -c` 重生成 `.gz` → 校验
- **备份位置**：`/opt/zhichao-backups/20261116-2030/`（旧 `index.html(+gz)`、`data/current.json(+gz)`、`data/changelog.json(+gz)`）
- **校验**：三个文件线上 `md5sum` 与本机一致；`gzip -t` 全过；`/` 200；`index.html` 与 `current.json` 内已无 `WorkBuddy`；匿名 `/data/current.json` 仍 401。
- **未做**：未重启 `zhichao-memory`，会话与记忆数据不受影响；每小时策展任务规则不变（已通过交接文档约束防止 tagline 被改写）。

---

## 2026-11-16 20:52（Asia/Shanghai）｜汐音贴纸 / 表情包上线（无图热点与空状态）

- **变更类型**：站点前端资源新增与渲染逻辑调整（纯静态，未改服务端、未重启容器）
- **新增资源**：
  - `cloud/assets/sticker-{edu,it,gear,acgn,game,health,deal,explore}.webp`（8 张方向贴纸，900×675，透明底、白描边，服装各不相同）
  - `cloud/assets/emo-{dizzy,hope,sleepy,blank,sad,cheer}.webp`（6 张表情包，880×660，透明底）
  - 均由 Seedream 5.5 生成，转换 WebP q90（保留完整画布，未裁边），单张 56–148 KB
- **代码改动**（`cloud/index.html`）：
  - 新增 `STICKER_BY_DOMAIN` 与 `stickerFigure()`：头条无配图时渲染方向贴纸替代原灰底大字；此类卡片不再重复显示右侧 `spot-mascot` 立绘
  - 新增 `.spot-fig.ph.stk` / `.ph-sticker` / `.ph-cap` 样式（贴纸悬停微摆正）
  - `img.onerror` 改为「emo-dizzy + 图片走丢了」小标签，并移除右侧立绘避免撞脸
  - `emptyHTML()` 支持 `emo-*` 资源；搜索无结果→dizzy、收藏空→hope、方向空→sleepy、数据异常→sad、回收站空→blank、头条区空态→sleepy（`.empty.flat` 紧凑版）
  - 顺带修复：`#trashDlg` 未套用 `.rdr` 玻璃样式（原为浏览器默认白底黑框），已并入 `#reader,#logDlg` 的弹窗规则与移动端规则
- **部署**：备份 `/opt/zhichao-backups/20261116-2052/`（旧 `index.html(+gz)`）→ `scp` 覆盖 `index.html` 与 14 个资源 → `gzip -9 -c` 重生成 `index.html.gz`，`data/changelog.json(+gz)` 同步更新（共 83 条）
- **校验**：`index.html` 线上 `md5sum` 与本机一致；`gzip -t` 通过；`/` 200；`assets/sticker-*.webp`、`assets/emo-*.webp` 共 14 个已落地且 md5 一致；匿名访问 `/assets/*` 仍 401（登录后由 enterApp 注入/直连读取）
- **结果**：部署成功，无图热点与空状态均已换用贴纸/表情包

---

## 2026-11-16 20:58（Asia/Shanghai）｜修正：贴纸占位不再顶替右侧小立绘

- **变更类型**：前端行为回退（纯静态）
- **原因**：上一版在「无配图 → 贴纸占位」时把头条卡片右侧的 `.spot-mascot` 立绘一并隐藏（避免同角色出现两次），但站主要求保留那张小立绘。
- **改动**（`cloud/index.html`）：`mascotImg` 改回始终按 `mascotFile` 渲染；`img.onerror` 的兜底分支不再移除 `.spot-mascot`；贴纸只占左侧图位。
- **部署**：`scp` 覆盖 `index.html` 与 `data/changelog.json` → `gzip -9 -c` 重生成 `.gz`；未改服务端、未重启容器。
- **校验**：两文件线上下 `md5sum` 一致、`gzip -t` 通过、`/` 200；页面实测无图卡片 `.spot-mascot` 计数为 1。

---

## 2026-11-16 21:29（Asia/Shanghai）｜详情弹窗快速收藏 + 收藏动效

- **变更类型**：前端功能与样式（纯静态）
- **改动**（`cloud/index.html`）：
  - 详情弹窗 `.rdr-foot` 最前面新增 `button#rdrFav`（空星 → 实星 + 文案「收藏／已收藏」，`aria-pressed` 同步）。
  - 新增 `.rdr-fav` 全套样式（玻璃胶囊 / hover 粉边 / `:active` 微缩 / `.on` 粉金浅底 + 金色实星 / 暗色主题覆盖）。
  - 动效：`.pop`（按钮 1.045 倍回弹 + `favPop` 星形 1.55 倍旋转回弹 + `.pop::after` 金色描边环 `favRing` 外扩）、`.out`（`favOut` 0.7 倍回弹）、`favSparks()` 生成 12 枚 `✦/✧` 星屑（随机角度 34–76px、8–15px、14ms 错峰、800ms 后移除）、`.fav-float` 浮字胶囊「收进手账啦／拿出来了」上浮淡出。
  - 状态同步：`bindFavBtn(id)` 在 `openReader` 内调用；`toggleFav` 改为函数表达式并在末尾对当前弹窗条目 `syncFavBtn()`；`favFromReader` 走同一份 localStorage 后 `render()`，列表 ☆ 与侧栏计数同步。
- **部署**：备份 `/opt/zhichao-backups/20261116-2129/`（index.html + .gz + changelog + .gz）→ `scp` 覆盖 → `gzip -9 -c` 重生成 `.gz`；未改 `server.py`，未重启 `zhichao-memory`。
- **校验**：`node --check` 通过；两文件线上/本机 `md5sum` 一致（index.html `fa085360…`）；`gzip -t` 通过；`/` 200；匿名 `/data/changelog.json` 401。
- **实测**：列表 ☆ → 弹窗显示「已收藏」；弹窗内取消 → 列表星同步熄灭；`favSet` 计数随点随变，无 JS 报错。

---

## 2026-11-16 21:46（Asia/Shanghai）｜列表收藏反馈 + 详情页快捷删除 + 「二次元」改「影视」

- **变更类型**：前端交互（`cloud/index.html`）、数据标签（`cloud/data/current.json`）、方向定义（`industry/domains.ts`、`HANDOVER-zhichao-curation.md`）、策展任务 query、贴纸资源。
- **列表收藏反馈**：`.rfav.pop`（1.4 倍回弹 + `-14deg` 甩动）、`.row.flash`（金色内阴影闪一下）；新增屏幕级特效层 `#favFx`，`favBurst(x,y,saving)` 在点击坐标生成 10 枚 `✦/✧`（半径 26–72px、10–16px、12ms 错峰）与浮字胶囊「收进手账啦／拿出来了」。点击时先取旧按钮 `getBoundingClientRect()`，`toggleFav` 重渲染后再对新按钮补 `.pop`，避免 DOM 被替换丢动画。
- **详情页快捷删除**：`.rdr-foot` 新增 `#rdrDel`（低调灰、hover 转粉红、`:active` 微缩），点击走既有 `askDelete()`；`confirmDelete()` 增加 `fromReader` 判定，若删除的正是弹窗当前条目，删完自动 `closeReader()`。
- **方向改影视**：`acgn` 的 key 保持不变（不进网址、不动旧数据 id 前缀），`label/section` 改为「影视」；`guide` 重写为日漫 / 国漫 / 电影 / 剧集与短剧四线并列，排除明星私生活、粉丝站队、影评打分与观后感；`scope`、`tags`（日漫 / 国漫 / 电影 / 剧集短剧）、`topics`（新增 `cinema`、`drama` 主题页）同步；`HANDOVER` 第二部分方向表、检索词清单、`domain` 取值说明一并更新；策展定时任务 query 改为新范围（只改 query，未动 cron 与标题）。`cloud/data/current.json` 的 `domains` 中该方向 `label` 改「影视」（color 不变），原 3 条动漫条目保留。
- **贴纸**：Seedream 5.5 新生成「贝雷帽 + 针织开衫 + 爆米花桶 + 电影票 + 胶片」形象，转 WebP 900×675（透明底、alpha 校验通过），覆盖 `assets/sticker-acgn.webp`（文件名不变，映射无需改）。
- **更新手账**：「列表里的星星也会回应了」「详情页可以直接删掉这条了」「『二次元』方向换成『影视』了」共 3 条，总 87 条。
- **部署**：备份 `/opt/zhichao-backups/20261116-2140/`（index.html、current.json、changelog.json 及各自 .gz、sticker-acgn.webp）→ `scp` 覆盖 → 三个文本文件重新 `gzip -9`；未改 `server.py`，未重启容器。
- **校验**：`node --check` 通过；线上与本机 `md5sum` 四项全部一致（index `a7513f41…`、current `46b1f738…`、changelog `642ab333…`、sticker `ba4c9dc0…`）；`gzip -t` 通过；`/` 200、匿名 `/assets/sticker-acgn.webp` 401；线上 HTML 含 `rdrDel` / `rFavPop` / `favfx-chip`，线上 `domains` 第八项 label 为「影视」。
- **实测**：列表 ☆ → 弹跳 + 星屑 + 浮字 + 行闪，计数即时变化；详情「删除」→ 确认弹窗 → 弹窗自动关闭、条目进回收站（`deletedSet` +1）；影视方向标签、头条贴纸、右侧立绘均正常。

---

## 2026-11-16 22:08（Asia/Shanghai）｜交互音效（Web Audio 现场合成，无音频文件）

- **变更类型**：前端交互与设置默认值（`cloud/index.html`、`cloud/js/settings.js`）。
- **音效引擎**：新增 `SFX` IIFE（`AudioContext` + 单一 `bus` GainNode），统一入口 `enabled()` 判定 = `ZC.settings.sfx !== false && sfxVolume > 0`，音量取自 `sfxVolume`。全部现场合成，不新增任何音频资源。
- **音色**：
  - `spark()` 收藏：987.77Hz / 1318.5Hz 两枚上行三角波（0.22s / 0.3s）+ 2093Hz 正弦一点点高频星味；
  - `drop()` 取消收藏：523.25Hz → 392Hz 下行，柔和不刺；
  - `puff()` 删除：0.26s 衰减噪声经 900Hz 低通 + 196Hz 正弦垫底，像纸张被抽走；
  - `page()` 翻开详情：0.18s 细气声（2400Hz 低通）+ 659.25Hz 轻音；
  - `back()` 回收站恢复：659.25Hz → 880Hz 两枚上行正弦。
- **挂载点**：`toggleFav()` 内按原状态分支发声（列表 ☆ 与「我的收藏」侧栏取消共用）；`favFromReader()` 内收藏/取消各一记；`confirmDelete()` 在 `delDlg.close()` 后 `puff()`；`restoreItem()/restoreAll()` 后 `back()`；`openReader()` 末尾 `page()`。
- **开关**：`settings.js` SCHEMA 的 `sfx` 默认值 `false → true`（仅影响从未动过设置面板的用户，已存设置保持原值）；`ckChime()` 的判定补上 `sfx === false`，打卡的月铃音纳入同一个音效开关；设置面板原有的「音效」「音效音量」即刻生效。
- **部署**：备份 `/opt/zhichao-backups/20261116-2157/`（首版音效前的 index/settings/changelog 及 .gz）与 `/opt/zhichao-backups/20261116-2158/`（终版前的 index/changelog 及 .gz）→ `scp` 覆盖 → 三个文本文件重新 `gzip -9`；未改 `server.py`，未重启容器。
- **校验**：`node --check` 通过（内联脚本与 `js/settings.js`）；线上/本机 md5 一致（index `73936b27…`、settings `35f010f0…`、changelog `6a849424…`）；`gzip -t` 通过；`/` 200；`js/settings.js` 匿名 200（与既有静态策略一致）。
- **实测**：桩住 `AudioContext.prototype.createOscillator/createBufferSource` 计数——收藏 3 个音符、取消 2 个、翻开详情 1 音符 + 1 噪声、删除 1 噪声 + 1 音符；`ZC.set('sfx',false)` 与 `ZC.set('sfxVolume',0)` 下计数不再增长，恢复后重新发声；设置面板「音效」开关显示为开启状态。

---

## 2026-11-16 22:26（Asia/Shanghai）｜音效覆盖全站点击与音量抬升；设置面板清理旧版开关

- **变更类型**：前端音效（`cloud/index.html`）、设置 schema 与面板（`cloud/js/settings.js`）。
- **音量**：`spark` 0.05/0.042/0.018 → 0.14/0.115/0.055；`drop` 0.035/0.028 → 0.10/0.085；`puff` 0.035/0.028 → 0.10/0.09；`page` 0.012/0.014 → 0.04/0.045；`back` 0.03/0.026 → 0.09/0.08；`ckChime` 0.07/0.05 → 0.16/0.12；`sfxVolume` 默认 0.7 → 0.9。
- **新增音色**：`tap()`（1174.66Hz 三角波 55ms + 3600Hz 低通气声）挂在全局 `pointerdown` 捕获阶段，覆盖 `button / a / [role=button] / .menu-item / [data-pg]`；`step()`（783.99Hz + 2200Hz 气声）用于方向切换与翻页，比 tap 低半音。
- **互斥**：`SFX_SELF` 白名单（`.rfav`、`#rdrFav`、`#rdrDel`、`#delConfirm`、`#restoreAll`、`.restore`、`.row`、`.spot-row`、`#spotHero`、`#ckCard`、`#ckBtn`、`.ck-actions`）已有专属音效，不再叠一层 tap。
- **设置面板清理**：删除「粒子背景」「粒子样式」「开屏过场」「背景音乐」「BGM 音量」五行（站点无粒子引擎、无开屏、无 BGM，均属上一版遗留）；同步移除 `SCHEMA` 的 `particles / particleMode / intro / bgm / bgmVolume`、`sanitize()` 对应分支、`PARTICLE_MODES` 常量与 `defaultsByEnv` 里的 `particles=false / intro=false`。面板剩 6 行：界面动效、常驻看板娘、帧率、位置、音效、音效音量。存量 localStorage 里的旧键在 `loadSettings` 中按 `SCHEMA` 白名单自动忽略，不报错。
- **部署**：备份 `/opt/zhichao-backups/20261116-2219/`（index/settings/changelog 及 .gz）→ `scp` 覆盖 → 三个文件重新 `gzip -9`；未改 `server.py`，未重启容器。另：本地预览脚本从 `/tmp`（会被清空）迁到仓库内 `dev/preview_server.py`，端口 8811，stub `/api/session` 与 `/api/memory`。
- **校验**：`node --check` 通过（内联脚本、`js/settings.js`）；线上/本机 md5 一致（index `a556e70c…`、settings `c42e0317…`、changelog `a8991411…`）；`gzip -t` 通过；`/` 200；线上 `js/settings.js` 已无「粒子样式」字样。
- **实测**（桩住 `createOscillator / createBufferSource` 计数）：方向切换 +1、翻页 +1、开关 +1、主题按钮 +1、打开详情 1 音符 + 1 噪声、收藏 3 音符、取消 2 音符、删除 1 噪声 + 1 音符；`sfx=false` 或 `sfxVolume=0` 时全部静音，恢复后重新发声；无 JS 报错。

---

## 2026-11-16 23:32（Asia/Shanghai）｜背景音乐（本地曲库 + 设置里开关/换曲/音量）

- **变更类型**：前端功能（`cloud/index.html`）、设置 schema 与面板（`cloud/js/settings.js`）、新增资源与清单（`cloud/assets/music/*.mp3`、`cloud/data/music.json`）。
- **版权处理的取舍**：未使用《未闻花名》原曲（`secret base ～君がくれたもの～` 为受版权保护的音乐作品，站内公开播放需要授权）。改用 Kevin MacLeod（incompetech.com）CC BY 4.0 三首同气质钢琴曲：`At Rest`（静息，3:27）、`Dreams Become Real`（梦成真时，6:50）、`Heartbreaking`（说不出口，1:36）。署名写进设置面板与 `music.json` 的 `credit/license` 字段，满足 CC BY 4.0 的署名要求。
- **下载与加工**：源站单连接限速约 8KB/s，改用 16–20 条并行 Range 请求抓取完整文件（校验 `content-length` 后按区间 `cat` 合并）；`ffmpeg` 统一转 96kbps / 44.1kHz，首尾 0.3s 淡入 + 0.6s 淡出（避免循环接缝处的爆音），`volume` 分级补偿（+5.5dB / +5dB / +11dB）并加 `alimiter=limit=0.96` 防削波；成品 mean ≈ −23 / −22 / −25 dB，max ≤ −0.4dB。三个文件合计 8.4MB。
- **播放器**：`BGM` IIFE（单例 `Audio`、`loop=true`、`preload=metadata`），`play/pause` 走 `requestAnimationFrame` 音量渐入渐出（1200ms / 450ms），换曲先淡出 320ms 再换源淡入 900ms；当前曲目存 `localStorage["zc:bgm:track"]`；`window.ZCBgm = { tracks, current, setManifest, play, pause, pick, volumeNow }` 供设置面板使用。
- **清单与扩展**：`cloud/data/music.json`（`schema=zhichao.music/v1`，含 `tracks[{id,title,subtitle,artist,file,duration,credit}]` 与 `license`、`note`）。页面启动先注入内置三首兜底，再 `fetch("data/music.json")` 合并；新增曲子只需放 mp3 到 `assets/music/` 并在 `tracks` 里加一行。
- **设置面板**：新增「背景音乐」开关、`曲目` 下拉（`zc-set-select`，含「标题 · 艺术家」）、「BGM 音量」，另加一行署名说明；`scorll` 无、`refreshTrackSelect()` 在面板打开、`zc:bgm` / `zc:bgm:tracks` 事件时刷新；`SCHEMA` 恢复 `bgm（默认 false）/ bgmVolume（默认 0.55）` 并补 `sanitize` 分支。
- **自动播放**：`bgm` 默认关；打开开关本身即手势，立即起播；若 `bgm` 已存为 true，则在首次 `pointerdown / keydown` 时补一次 `play()`（浏览器自动播放策略），失败静默。
- **部署**：备份 `/opt/zhichao-backups/20261116-2314/`（index/settings/changelog 及 .gz）→ 覆盖 `index.html`、`js/settings.js`、`data/music.json`、`data/changelog.json` 并重新 `gzip -9` → 新建 `/opt/zhichao/assets/music/` 上传三个 mp3；未改 `server.py`，未重启容器。
- **校验**：`node --check` 通过；线上/本机 md5 一致（index `6d5dd5d8…`、settings `0545689c…`、music.json `ff0111eb…`、changelog `6437ce4b…`）；`gzip -t` 通过；`/` 200；匿名 `/assets/music/at-rest.mp3` 401（沿用 assets 的登录保护）。
- **实测**（Playwright）：曲目清单 3 首正确注入下拉；打开「背景音乐」→ `ZCBgm.current().playing === true`；切到 `dreams` → 1.6s 后 `id=dreams`、`playing=true`、`localStorage` 已写入；无 JS 报错。

---

## 2026-11-16 23:36（Asia/Shanghai）｜修复「部署了但看不到」：页面与脚本改为每次回源校验

- **现象**：BGM 一轮（23:14）已上线、md5 与服务器一致，但浏览器仍显示旧界面、更新手账里也找不到新条目。
- **根因**：nginx `location = /` 与 `= /index.html` 原先下发 `Cache-Control: public, max-age=300`；`styles/*.css`、`js/*.js` 落在 `location /` 没有任何缓存头，按启发式规则被浏览器长期保留。前端 `openLog()` 早已带 `?t=` 绕开 `/data/` 缓存，所以问题不在数据层，而在 HTML/JS 外壳本身。
- **处理**：
  - `/opt/zhichao-nginx/default.conf`（宿主机挂载到容器 `/etc/nginx/conf.d`）备份为 `default.conf.bak-<stamp>` 后修改：`/`、`/index.html` 改为 `Cache-Control: no-cache, must-revalidate`；新增 `location ~* \.(js|css)$` 同样 `no-cache` 并 `try_files`；`/assets/` 补 `public, max-age=300`（图片与 mp3 允许短暂缓存）。`docker exec zhichao-web nginx -t` 通过后 `nginx -s reload`（未重启容器、未中断会话）。
  - `cloud/index.html` 四张样式与三个脚本引用统一加版本号 `?v=20261116c`，此后每次改脚本只改版本号即可强制换新。
- **部署**：备份 `/opt/zhichao-backups/20261116-2331/`（index/changelog 及 .gz）→ 覆盖 → 重新 `gzip -9`。
- **校验**：`curl -sI http://127.0.0.1/` 与 `/styles/theme.css`、`/js/settings.js` 均返回 `Cache-Control: no-cache, must-revalidate`；首页 200 且 HTML 内含 `?v=20261116c` 计数 2 处以上；线上/本机 md5 一致（index `65d18fd1…`、changelog `d63ba611…`，共 92 条）；本地预览（版本号参数不影响静态服务）加载 6 张样式、`ZC` 正常、设置面板含「背景音乐」行、无 JS 报错。
- **给用户的动作**：只需刷新一次；若手机上仍是旧界面，强制刷新或清一次缓存即可，之后不用再等五分钟。

---

## 2026-11-16 23:54（Asia/Shanghai）｜更新手账「看不到新条目」：时间格式不一致导致排序错位

- **现象**：用户打开「汐音的更新手账」，11 月 16 日那组显示 33 项，但最上面停在 `20:52 回收站弹窗补上玻璃样式`，23:32 的 BGM、23:36 的缓存修复都不在可见位置。
- **根因**：`data/changelog.json` 内 `at` 存在两种写法——早期条目是 ISO（`2026-11-16T20:52:00+08:00`），21:29 之后的 9 条写成了 `2026-11-16 21:29`（空格分隔、无时区）。前端用 `String(b.at).localeCompare(...)` 排序，空格（0x20）小于 `T`（0x54），ISO 条目整体压在上面、空格条目沉到底部；渲染时间又用 `/T(\d{2}):(\d{2})/` 正则，空格条目匹配不到，一律显示 `—`。
- **处理**：
  - 数据侧：把 9 条空格格式统一改写成 `YYYY-MM-DDTHH:mm:ss+08:00`（共 92 条全量校验后写入）。
  - 前端侧（`cloud/index.html`）：新增 `logMs()`（`Date.parse`，先把空格替换成 `T`）与 `logHM()`（`/[T ](\d{2}):(\d{2})/`，两种写法都能取到时分）；分组内与全局排序改按 `logMs` 数值比较；`openLog()` 去掉「一次加载后常驻缓存」的逻辑，改为每次打开都带 `?t=` 重新拉取（13KB，成本可忽略）。
- **部署**：备份 `/opt/zhichao-backups/20261116-2354/` → 覆盖 `index.html`、`data/changelog.json` 并重新 `gzip -9`；未改 `server.py`、未重启容器。
- **校验**：线上/本机 md5 一致（index `ace31bf3…`、changelog `78415963…`，93 条）；本地预览打开手账，首四条依次为 `23:54 / 23:36 / 23:32 / 22:26`，当日计数 33 项，`—` 占位时间归零，无 JS 报错。

---

## 2026-11-17 00:02（Asia/Shanghai）｜把运维经验写进交接文档 + 修复 js/css 正则 location 绕过鉴权

- **交接文档**：`HANDOVER-zhichao-curation.md` 新增「五点五、部署与踩坑清单」：文件位置（宿主机 `/opt/zhichao-nginx/default.conf` 只读挂载进容器）、缓存三件套（`no-cache` 策略与 `?v=` 版本号）、`gzip_static on` 必须重生成 `.gz`、更新日志 `at` 必须 ISO 带 `T`（空格写法会被字符串排序压到底部）、9 步部署检查单、本地预览重启方式、以及「程序化 click 不触发 pointerdown、音频看 `paused` 不看元素存在」两条验证坑。
- **安全修复**：上一轮为 html/js/css 加缓存头时用了 `location ~* \.(js|css)$`，正则 location 优先于前缀 location，导致 `/vendor/three.module.min.js` 绕过 `auth_request` 匿名可读（实测 200）。改为 `location ~* ^/(js|styles)/.*\.(js|css)$`，把作用域收窄到站内自己的样式与脚本目录。
- **校验**：`nginx -t` 通过后 `nginx -s reload`（未重启容器）；`/vendor/three.module.min.js` 恢复 401，`/js/settings.js` 仍 200 且 `Cache-Control: no-cache, must-revalidate`。配置改动前备份为 `/opt/zhichao-nginx/default.conf.bak-<stamp>`。
- **部署**：备份 `/opt/zhichao-backups/20261116-2357/`（changelog 及 .gz）→ 覆盖 `data/changelog.json` 并重新 `gzip -9`；线上/本机 md5 一致（`73ab2530…` 与 `bf0070ca…`，共 94 条，末条 2026-11-17T00:02）。

---

## 2026-11-17 00:06（Asia/Shanghai）｜萝莉形态不认时间：时刻被长上下文淹没 + 旧对话自我强化

- **现象**：萝莉形态（`FORMS` 里 `id=loli`）被问「现在几点」时反复回答「汐音不知道」「系统没给时钟」。
- **排查**：抓 `/opt/zhichao-memory/data/chat-memory.json` 的 `threads.loli`（44 轮），末几轮 assistant 原话即「系统没给汐音时钟，只有手账上 19:52 和 20:12 两个小月牙」。而 `sendChat()` 组装的 system 里确实含 `ZCClock.promptLine()`（Playwright 拦截 `/api/kimi` 实测 `has time: True`），说明时间**有注入但没被采纳**。
- **根因（两层）**：
  1. 时间句夹在「全局人设 + 形态人设 + 手账记忆 + 长期记忆摘要」中间，后面又被服务端 `build_site_context()` 插入的整份热点清单（第二个 system message）继续稀释，位置太靠前、权重太低；
  2. 该线程已积累几十轮「不知道时间」的自我陈述，模型倾向维持前后一致，于是继续否认，还把「手账里的 19:52/20:12」当成唯一时间证据。
- **处理**：
  - `js/clock.js`：`promptLine()` 改写为强约束（「你确实看得到这个时刻，问了直接报，绝不能说不知道/没有时钟/系统没给时间；此前『不知道时间』的说法作废」）；新增 `anchorLine()` 输出短锚点 `（此刻 YYYY-MM-DD HH:mm 周X 时段）`，并挂到 `window.ZCClock`。
  - `cloud/index.html`：新增 `withClockAnchor(recent)`，把锚点**只追加到发往模型的最后一条用户消息副本**上（历史与气泡仍保存主人原话，不污染记忆）；`sendChat()` 的 `messages` 改为 `[system, ...withClockAnchor(recent)]`；`js/clock.js` 引用版本号 `?v=20261117a`。
- **部署**：备份 `/opt/zhichao-backups/20261117-0004/`（index/changelog 及 `js/clock.js`）→ 覆盖 `index.html`、`js/clock.js`、`data/changelog.json` 并逐个 `gzip -9`；未改 `server.py`、未重启容器。
- **校验**：`node --check` 两份均通过；线上/本机 md5 一致（index `3b911f7c…`、clock `c18629d0…`、changelog `f4e8b8a0…`，95 条）；`curl` 线上 `js/clock.js?v=20261117a` 命中新文案；Playwright 实测萝莉形态发问后，system 含「绝不能说『不知道』」、最后一条 user 消息尾部带「此刻 2026-11-17 00:04 周二 深夜」，而本地保存的仍是「现在几点了」原句。
- **遗留**：`threads.loli` 里旧的否认发言未删除（属于用户记忆）；若模型仍偶发沿用，可考虑在形态切换时注入一次性纠正，或由用户手动清空该形态线程。

---

## 2026-11-17 00:14（Asia/Shanghai）｜回调时间提示的权重：从「强制报时」改为「按需才报」

- **反馈**：上一版（00:06）为压住「不知道时间」，system 写了「绝不能说『不知道』」「旧说法作废」等强约束，并把锚点无条件追加到每轮用户消息；结果每条回复都要提一句几点，观感很吵。
- **处理**：
  - `js/clock.js`：`promptLine()` 收敛为一句话——「说话贴合此刻就好：问候、饭点、作息都别错位；主人问起时间再报，平时不要主动提几点。」删除全部强词与「作废」宣告；`anchorLine()` 精简为纯事实 `（此刻 YYYY-MM-DD HH:mm 周X 时段）`。
  - `cloud/index.html`：`withClockAnchor()` 增加 `TIME_ASK` 关键词判定（几点/几号/日期/星期/周几/什么时候/多晚/早晚/上午/中午/下午/傍晚/晚上/凌晨/深夜/白天），**只有命中时才追加锚点**；未命中时完全不改消息文本。`js/clock.js` 版本号 `?v=20261117b`。
- **部署**：首次上传时 SSH 中途掉线（`lost connection`），远端仍是旧版（md5 未变）。已核对远端 md5 确认未写入后重传：备份 `/opt/zhichao-backups/20261117-0013/` → scp `index.html`、`js/clock.js`、`data/changelog.json` 及各自 `.gz`。
- **校验**：线上/本机 md5 一致（index `985929ab…`、clock `f3a9e785…`、changelog `9763ade4…`，96 条）；`gzip -t` 全通过；`/` 200 且引用 `?v=20261117b`；Playwright 实测「今天好累啊」发出去无锚点、「现在几点了」才补「（此刻 2026-11-17 00:12 周二 深夜）」，system 中「平时不要主动提几点」生效且不再含强词。

---

## 2026-11-17 00:32（Asia/Shanghai）｜看板娘「活人感」重写：去掉助手腔与自我指认

- **问题**：她会在对话里说「系统没给汐音时钟」「系统给的记忆只有手账」这类出戏的话，把自己当程序；开场白又长期只有一句「主人你来啦～我是汐音」。
- **人设重写**（`cloud/index.html` 的 `SYSTEM_PROFILE`，仍每次请求置顶）：
  - 定位改为「住在知潮这个站里的女孩子」，删除原「陪伴助手」措辞；补充生活细节（窗边月晷、桌角贴纸与手账、发呆翻书泡茶、「把亮着的屏幕当月亮看」）。
  - 语言要求：短句、口语、有停顿与呼吸感；允许「嗯…」「等一下」「我刚在发呆」；会反问、撒娇、闹小脾气；禁止客服腔（「有什么可以帮您」「我理解您的需求」）、禁止默认分条列点、禁止每句问候、禁止每句报时间。
  - 情绪与记忆：情绪随对话变化（雀跃／小声抱怨／嘴硬后偷偷开心），要记得到访、打卡时刻、连击与上次聊到哪儿。
  - 明确禁止自我指认：不得提「模型／AI／程序／助手／机器人／系统／提示词／数据库」，不得说「根据记录」「我的设定是」；旧对话里这类说法视为以往失误，不再沿用。
  - 被问「你是真人吗／AI 吗」时用角色化方式带过（「我是汐音呀，一直住在这个站里」）并可俏皮反问，但不得编造现实身份细节（住址／电话／证件）。
  - 「不知道」改为自然表达（猜一猜、撒娇糊弄），不再用「系统没给数据」解释；同时保留事实可靠性约束（站内热点以清单为准、不硬编、医疗需专业诊疗）。
- **开场白**：`ckGreeting()` 去掉与时间问候重复的「主人你来啦～」，改为 `hello。` + 三选一小日常（发呆／正要找你／又翻手账），打卡与连击分支同样改为单次问候。
- **部署**：备份 `/opt/zhichao-backups/20261117-0028/` → 覆盖 `index.html`、`data/changelog.json` 及 `.gz`；未重启容器。
- **校验**：`node --check` 通过；线上/本机 md5 一致（index `c9e39835…`、changelog `0d41e722…`，97 条）；`curl` 页面命中新句子；Playwright 抓包确认 system 含「绝不要提自己是模型」且不再出现「陪伴助手」，开场白实测为「这个点还醒着吗？现在是 00:27。我刚在发呆，听见你来了就醒了，今天想聊点什么呀？」。
- **遗留**：`threads.loli` 等历史里仍有旧的「系统没给时钟」发言，未删除（属用户记忆）；新 prompt 已声明其作废，若模型仍偶发复读可再注入一次性纠正。

---

## 2026-11-17 01:02（Asia/Shanghai）｜三人群聊：御姐/少女/萝莉 + 主人

- **交互**：聊天窗右上角新增「群聊 / 单聊」切换（`#chatMode`）。进入群聊后标题变「汐音们的三人群」、副标题「三人群 · 已记住 N 句」、输入框占位改「跟三个人一起说点什么…」；左侧立绘的翻转被暂时禁用（提示「群里三个都在」），退回单聊即恢复。模式存 `localStorage["zhichao_chat_mode"]`，刷新后保持。
- **角色设定**：`GROUP_ROLES` 固定映射 mature=大姐姐、cute=老二、loli=老三，头像复用三形态立绘；气泡上方按 `<div class="msg-name"><b>名字</b></div>` 标注说话人，三人名字用不同色（`#a06b86 / #8f7a5e / #c0708f`）。
- **模型协议**：`GROUP_RULES` 要求每段以「【大姐姐】」「【老二】」「【老三】」开头，禁止旁白与括号动作，每人 1–3 句、整轮 ≤120 字，可不齐发但主人提问必须有人正面答；明确「不是同一个人的不同形态，在群里就是三姐妹，信息共享」。
- **解析与渲染**：`splitGroup()` 用 `【X】` 标记切段，流式期间每来一段 `delta` 就重建气泡（`gRows` 维护行引用），因此三人是**逐条冒出来**而不是整段倾倒；结束后按段写入 `threads.group`，每条消息带 `form` = 说话人，重新打开可完整还原谁说了什么。
- **记忆**：三人共享同一线程上下文 + 同一份 `longTerm` + 同一份手账 `visits`，`ckMemoryLine()` 照旧注入；群聊开场白是 `groupGreeting()` 三条轮播（大姐姐兜场、老二端茶、老三抢话），并带上时间问候与打卡状态。
- **存储边界（重要）**：服务端 `FORM_IDS` 仅 `("mature","loli","cute")`，`normalize_memory()` 会丢弃其它线程键，因此**群聊线程 `group` 目前只存本机 `localStorage`**，不改后端、不重启容器。单聊三条线程与长期记忆、手账仍照常上云。
- **清空**：`#chatForget` 在群聊模式下清空群线程（`currentThreadId()`），确认文案换成「群里这些热闹也要散掉吗…」。
- **部署**：备份 `/opt/zhichao-backups/20261117-0044/` → 覆盖 `index.html`、`data/changelog.json` 及 `.gz`。
- **校验**：`node --check` 通过；线上/本机 md5 一致（index `44b14f5f…`、changelog `fb53c72f…`，98 条）；Playwright 用分段 SSE 模拟三人台词，实测生成 3 个带名气泡、`threads.group` 末尾三条 `form` 分别为 mature/cute/loli；单↔群切换后标签与气泡名字正确、切换后刷新仍停在群聊并还原历史；无 JS 报错。
- **未做（待确认）**：群聊跨设备同步需要把 `group` 加入服务端 `FORM_IDS` 并重启 `zhichao-memory`（会话表在内存里，重启会掉一次登录，除非同时做会话文件持久化）。等用户决定是否要做。

---

## 2026-11-17 01:24（Asia/Shanghai）｜群聊上云 + 会话持久化（重启不掉登录）

- **后端改动**（`/opt/zhichao-memory/server.py`，挂载进容器 `/app/server.py`）：
  1. `FORM_IDS` 由 `("mature","loli","cute")` 扩为 `("mature","loli","cute","group")`，`normalize_memory()` 因此保留群聊线程；旧记忆文件无需迁移（读取时自动补齐空 `group`）。
  2. 新增 `SESS_FILE=/data/sessions.json`、`_load_sessions()`、`_save_sessions()`（临时文件 + `os.replace` 原子写）：启动载入 sid 与撤销名单，`create_session()`/`revoke_session()` 落盘。
  3. `valid_session()` 改为「`_revoked` 命中即拒；sid 不在表但签名与到期合法则接纳并补登记」，这样容器重启不再踢掉所有 Cookie；`revoke_session()` 把 sid 同时写入撤销表，登出仍即时生效且重启不复活。
- **前端改动**（`cloud/index.html`）：`loadSyncMeta`/`syncMemoryToServer`/`pullMemoryFromServer` 的计数与合并循环由 `FORM_IDS` 改为 `THREAD_IDS`（含 `group`）；合并时新增保护——服务器线程比本地已知的更短时保留本地全量并 `saveChat()` 补传。
- **验证**：
  - 容器内单测：`normalize_memory` 保留 `group`（1 条）；`create_session → valid_session` True；`revoke_session` 后 False；清空内存表（模拟重启）后旧 Cookie 仍 True；`sessions.json` 生成。
  - 重启 `zhichao-memory` 后：容器 Up、`/api/session` 401、首页 200、`chat-memory.json` 线程键为 `['mature','loli','cute','group']`（未被清空）。
  - Playwright：群聊发一条后本地 4 条，刷新后仍 4 条、三个带名气泡；「服务器缺数据」场景不再清空本地。
- **部署**：`server.py` 备份为 `server.py.bak-20261117-0051` 与 `/opt/zhichao-backups/20261117-0051/server.py`；前端备份 `/opt/zhichao-backups/20261117-0053/`，覆盖 `index.html`、`data/changelog.json` 及 `.gz`。线上/本机 md5 一致（index `7c7987f4…`、changelog `493a46f5…`，99 条）。

---

## 2026-11-17 01:41（Asia/Shanghai）｜群聊轮换失真：三人每轮齐发、彼此不互动

- **反馈**：群聊里每轮固定三个人依次发言，像三条广播；而且彼此之间没有对话，各说各的。
- **根因（两条）**：
  1. `GROUP_RULES` 原文写了「每段以【大姐姐】【老二】【老三】开头，每人 1–3 句」，等于把「三人齐发」写死成格式，模型乖乖照做；
  2. `sendChat()` 在群聊里把 `recent` 直接发给上游，**历史消息里没有说话人信息**（`chatHistory` 只存 `form` + 正文），模型根本不知道上一句是谁说的，自然接不住，只能各答一遍。
- **处理**：
  - 规则重写：明确「大多数时候只有一个人回」「第二三人开口必须接前一位的话（拆台/护短/补一句）」「允许抢话、打断、整轮沉默、不做旁白」「长短不齐、总字数 ≤100」；仍保留 `【X】` 标记作为唯一解析格式。
  - 每轮加 `sceneCue()` 随机场面指令：50% 只一人说话（随机点名倾向）、32% 最多两人且第二人要接话、18% 三人可抢话且压到 80 字内。避免提示词被读成「固定阵型」。
  - 历史补标签：群聊请求前把 assistant 消息改写为 `【大姐姐】原文`，模型可见上一句归属，能真正接话。只在发往上游的副本上改，不写入记忆。
  - 开场白 `groupGreeting()` 改为随机 1–2 人先开口（55% 单人），并打乱顺序。
- **验证**（Playwright + 分段 SSE）：
  - 首轮单人回复 → 只生成 1 个气泡；次轮双人互动（老三抢话、老二回嘴）→ 2 个带名气泡，名字序列 `['老二','老二','老三','老二']`（含历史还原）；
  - 抓包确认 system 含「【本轮】」指令、历史 assistant 条目带 `【老二】` 前缀；开场白实测 1 个气泡；
  - 无 JS 报错。
- **部署**：备份 `/opt/zhichao-backups/20261117-0057/` → 覆盖 `index.html`、`data/changelog.json` 及 `.gz`；线上/本机 md5 一致（index `c963344b…`、changelog `16c9b63a…`，100 条）。
- **可调**：若仍嫌话多/话少，改 `sceneCue()` 里的三个概率阈值即可，无需动提示词主体。

---

## 2026-11-17 02:05（Asia/Shanghai）｜方案 B 落地：串行接力 + 每轮随机人设与话题权重

- **要解决的问题**：① 形态与台词不一致（老三说出大姐姐腔）；② 模型并发只有 1，仍要有群聊感。
- **根因**：三个人设挤在同一段 system、一次 completion 同时写三条台词，模型会把语气平均掉；并发 1 又逼着必须一次拿回全部，只能靠提示词硬拆。
- **实现（串行接力，并发仍为 1）**：
  - `sendChat()` 群聊分支早退到 `groupTurn(text)`，不再走单请求三段渲染（旧的 `splitGroup()` / `gRows` 渲染路径在群聊已停用）。
  - `pickSpeakers()`：每轮随机 1–3 位（约 55% 单人、33% 双人、12% 三人，长句/带问号/情绪词会抬升人数概率）。`speakerWeights()` 按主人这句话的关键词加权重：作息/安排/考研/决定→`mature`，累/委屈/压力/焦虑→`cute`，吃/玩/动漫/游戏/热闹→`loli`；上一次刚说过的人权重 ×0.55，避免总是同一人领话。
  - `askOne(form, idx, prev, onDelta)`：**一位一次请求**，串行 `await`；system 只用该角色人设（`soloSystem`）+ 群聊背景（`GROUP_TEAM`）+ `soloRules()`。后一位的规则里会带上前一位的原话（「刚先「老二」说了一句：「……」」），所以接话是真的读过上文。
  - `sanitizeSolo()`：单角色请求里若手滑写了别人的标记，自己的人名去掉、出现别人名字直接截断，防止一段台词混进两个人。
  - 渲染：`showTypingFor()` 在等待下一位时亮出她的头像 + 打字点，段间 380–900ms 随机停顿；每段流式进入她自己的气泡并立刻落盘。
  - 失败降级：某一位请求失败时保留已说出的部分，追加一句「群里突然安静了一下…」，不整轮报废。
- **验证**（Playwright + 按 system 判角色的 mock SSE）：
  - 「我想吃炸鸡，好无聊」→ 只发 1 次请求，老三单独回（1 个气泡，无串味）。
  - 「我老是熬夜，作息乱了怎么办」→ 3 次串行请求：大姐姐先答，老二、老三后续请求的 system 均命中「接她的话」；气泡序列 `老三(开场) → 大姐姐 → 老二 → 老三`，名字与请求方一一对应。
  - 单聊回归：无报错，正常一条回复（含问候）。
- **延迟**：单人约 1–2s，双人约 3–4s，三人约 5–6s；第一句仍是最快出来的，等待期间有打字气泡。
- **部署**：备份 `/opt/zhichao-backups/20261117-0105/` → 覆盖 index/changelog 及 `.gz`，线上本机 md5 一致（index `7c4d79fd…`、changelog `7c29ef9b…`，101 条）。

---

## 2026-11-17 02:19（Asia/Shanghai）｜群聊第一位发言者改为随机

- **反馈**：群聊总是大姐姐先开口，第一位不该固定。
- **改动**：`pickSpeakers()` 里第一位的选取改为**均匀随机**（`pool` 三人等概率）；`recentLeaders(hist)` 取最近三轮的领话人，其中上一轮领话者在 50% 的轮次里被排除（`firstPool`），避免连续几轮同一人起头。话题权重只作用于**接话的第二/第三人**（`w2`：上一轮领话 ×0.55、上上轮 ×0.8），不再决定谁先说话。
- **验证**（页面内跑 300 次采样，不请求网络）：
  - 空历史、输入「今天好累」：`mature 103 / cute 95 / loli 102`，接近均匀；
  - 上一轮领话为 `mature`：`mature 50 / cute 148 / loli 102`，即「刚说过的人让一让」生效但没有被完全禁掉。
  - 端到端（mock SSE）三轮：领话人依次 `老三 → 大姐姐 → 老三`，第二位请求 system 命中「接她的话」、第一位命中「这一轮你先开口」，气泡名字与请求方一致，无 JS 报错。
- **部署**：备份 `/opt/zhichao-backups/20261117-0108/`，线上本机 md5 一致（index `6108a40e…`、changelog `91a7daa9…`，102 条）。

---

## 2026-11-17 02:38（Asia/Shanghai）｜群聊连续 429：上游并发限流

- **现象**：群聊每轮都回「群里突然安静了一下…再说一次好不好？」，连续多轮。
- **排查**：`docker logs zhichao-web | grep api/kimi` 显示 `/api/kimi` 连续 **429**（响应 227 字节），时间点紧跟在一次 200 之后约 1 秒；后端 `server.py` 的 429 只用于登录爆破（`_handle_login` 的 `is_locked`），聊天链路是原样透传上游状态，所以 429 来自 **Moonshot 的并发/速率限制**，不是本站队列。
- **根因**：方案 B 每轮串行 1–3 次请求，但相邻两次只隔 380–900ms，上传的一条还没被上游完全释放，下一条就撞上限流 → 第二轮起整轮失败，且失败被包成同一句兜底文案，看起来「一直说这句话」。
- **修复**：
  1. `askOne()` 改为 **非流式** 请求（nginx 本来就 `proxy_buffering` 默认开，前端拿不到增量，流式只延长上游连接占用）；`postChatOnce()` 统一发请求。
  2. **429/5xx/网络错误退避重试 3 次**（1.4s→2.8s 递增 + 抖动），仍失败才收尾。
  3. 段间隔从 380–900ms 拉长到 **1500–2200ms**。
  4. 三人概率 6%→**4%**（`p3 = 0.04 + energy*0.4`），减少一轮三次请求。
  5. 兜底文案区分原因：429 时说「她们同时抢着说话，被拦了一下…等我两秒再喊我」，不再重复同一句；同时 `console.warn` 保留真实状态码。
- **验证**（Playwright，mock 返回 429→200）：第 1 次 429、第 2 次 200，仅生成 1 个气泡；全 429 场景重试 3 次后只出现一条温和提示；无 JS 报错。
- **部署**：备份 `/opt/zhichao-backups/20261117-0114/`，线上本机 md5 一致（index `b3d89cea…`、changelog `ceffdc4b…`，103 条）。
- **后续可选项**：若 429 仍频繁，可把「一段一轮」提到后端做**全局单飞锁 + 队列**（同一密钥只允许一条在途，其余排队），前端就完全不用感知限流。

---

## 2026-11-17 09:37（Asia/Shanghai）｜记忆边界：群聊共享，单聊私有

- **反馈**：群聊的记忆应该三个人都有，单聊的记忆只属于那一个人；现在两边互不可见。
- **设计规则（写死，不要再改）**：
  - `threads.group` 是**共享层**：任何一位单聊时都能看到群里最近的 8 句（`groupRecallLine()`），进入她的 system，并明确标注「这是群里的语境，别当成本次单聊发生的事」。
  - `threads.mature / cute / loli` 是**私有层**：只在本人单聊里出现；群聊请求（`groupHistoryForModel()`）只读 `threads.group`，绝不拼入任何单聊内容，也不会拼别人的单聊。
  - `longTerm`（压缩后的长期记忆）仍按主人维度共享——它记的是关于主人的事，不是三个人各自的私房话。
- **实现**：`groupRecallLine(n=8)` 取群线程尾部、`主人／大姐姐／老二／老三` 前缀、单条截 80 字、总长截 520 字，避免把 system 撑爆；单聊 system 末尾拼接；`updateCtx()` 在单聊头部追加「· 群里 N 句」，让共享这件事可见。
- **验证**（Playwright + 种子数据：群里有「群里说了不吃夜宵」，御姐单聊里有「私聊秘密」）：
  - 御姐单聊 system 含群聊回放（命中「不吃夜宵」），头部显示 `已记住 2 段对话 · 群里 1 句`；
  - 御姐单聊 system 不含群聊之外的私有内容；
  - 切到群聊后请求 system 不含任何单聊私房话；无 JS 报错。
- **部署**：备份 `/opt/zhichao-backups/20261117-0937/`，线上本机 md5 一致（index `c44c7eec…`、changelog `7e5e20f2…`，104 条）。

---

## 2026-11-17 10:06（Asia/Shanghai）｜群聊改为生产者—消费者调度

- **设计来源**：主人提出「一个生产者、三个消费者、消费者轮询取货、总时间上限防止一直等」。
- **实现**：
  - `class PollQueue`：`push()` 有等待者就直接交货，否则入 `items`；`take(ms)` 无货时挂一个带 `setTimeout(ms)` 的 waiter，超时自行移除并 resolve `null`。这就是「轮询 + 超时」的原语。
  - `groupTurn()` 把主人的一句话作为**唯一产品**入队；`orderConsumers()` 决定这一轮三位消费者谁先来查队列——第一位由 `sort(random)` 洗牌（上一轮领话人有一半概率被排到最后），后续接话者按 `speakerWeights`（作息→大姐姐、情绪→老二、吃喝玩乐→老三）排列。
  - 每位消费者单次最多等 `GROUP_POLL_MS = 500ms`；整轮 `GROUP_BUDGET_MS = 15000ms` 的总截止时间，循环每步都检查 `Date.now() < deadline`，生成前还要求剩余 ≥900ms。
  - 取货者发言后，其台词按 `reactionChance()`（第一轮 0.40+热度、第二轮 0.26+热度）**重新入队**，成为下一位的「产品」；没人接或超预算就散场。三人上限 `GROUP_MAX_SPEAKERS = 3`，同一轮同一人不重复取货。
  - `postChatOnce()` 增加 12s `AbortController` 超时，上游挂死也不会让轮询无限等；429/5xx 仍退避重试（超时不再重试）。
- **验证**（Playwright mock）：
  - 连发 4 轮：`1 / 3 / 2 / 1` 人，领话人分别为 老二、大姐姐、老三、大姐姐，分布自然；
  - 每请求 5s 慢响应：1 人时 5.0s 结束，不空耗；
  - 强制 `Math.random()=0.01`（每轮必有人接）：3 次请求、13.5s 结束、未出现第 4 人，预算生效；
  - 无 JS 报错。
- **部署**：备份 `/opt/zhichao-backups/20261117-0959/`，线上本机 md5 一致（index `221f8617…`、changelog `414b8213…`，105 条）。
- **调参入口**：`GROUP_BUDGET_MS`（总预算）、`GROUP_POLL_MS`（单次轮询）、`reactionChance()`（接话概率）、`GROUP_MAX_SPEAKERS`（人数上限）。

---

## 2026-11-17 10:32（Asia/Shanghai）｜群聊改为「一次调用 = 一次生产」

- **需求澄清**：主人指出前一版误解了「生产者—消费者」——并发只有 1，意思是一次模型调用就是唯一的生产事件；三位角色是消费者，从这次调用的产物里各取自己那段，而不是每位各发一次请求。
- **实现**：
  - `produceGroupReply()`：整轮**只调一次** `/api/kimi`（`stream:false`，12s 超时，429/5xx 最多重试 1 次），system 里塞入 `GROUP_RULES`（一次写整轮、1–3 段、后段必须接前段、总字数 ≤120）+ `GROUP_VOICES`（三套口吻指纹）+ `sceneCue()`（本轮谁先开口/最多几人，按话题加权随机）。
  - `parseGroupScript()`：按 `【大姐姐】/【老二】/【老三】` 切段，未知前缀丢弃、单段截 140 字、最多 3 段；无标记时整段归给 `scene.lead`。
  - `PollQueue`（轻量版：`push/head/takeHead/size`）+ `consumeGroup()`：三位消费者**并行轮询**，只取队首属于自己那段；`groupSpeaking` 互斥保证同一时刻只有一个人在冒泡，段落顺序不会乱；每位之间有 180–480ms「看到→想说」停顿和 420–1040ms 收尾留白。
  - `GROUP_BUDGET_MS = 15000` 仍是整轮总预算，`GROUP_POLL_MS = 150` 是轮询间隔；到点或队列见底即散场。
  - 删除 `askOne()`、`soloRules()`、`soloSystem()`、`orderConsumers()`、`reactionChance()`、`recentLeaders()`；历史仍用 `groupHistoryForModel()`（相邻 assistant 合并，保证消息交替）。
- **验证**（Playwright mock）：
  - 两段剧本：**1 次请求**、2.52s 出完，气泡顺序 `老二 → 老三`，名字正确，会话落盘 3 条；
  - 三段剧本：**1 次请求**、3.87s 出完，名字 `大姐姐 → 老二 → 老三`；无 JS 报错。
  - 由于每轮只发一次请求，之前 429 的根因（连发）从结构上消失。
- **部署**：备份 `/opt/zhichao-backups/20261117-1009/`，线上本机 md5 一致（index `46b5058f…`、changelog `14ab139b…`，106 条）。
- **调参**：`GROUP_BUDGET_MS`（总预算）、`GROUP_POLL_MS`（轮询间隔）、`sceneCue()` 里的人数概率与 `GROUP_RULES` 的字数上限。

---

## 2026-11-17 10:41（Asia/Shanghai）｜群聊专属生活场景立绘

- **变更类型**：站点前端界面部署（纯静态，未改 `server.py`，未重启容器）
- **需求**：群聊左侧原本仍显示单聊的单人立绘（且点击被禁用），没有群聊专属形象。
- **部署内容**：
  - `cloud/assets/group-xiyin-home.webp`（新增，1330×1773，webp q84，约 271KB）：夜晚客厅生活场景群像——大姐姐系围裙提壶倒水、老二窝沙发记账、老三盘腿坐地毯撑脸抢话，茶几上三只杯子/硬币/账本呼应群里「第三壶水」「两块零钱」的对话。
  - `cloud/index.html`：新增 `.chat-scene` 背景层与 `.chat-side.group-mode` 规则（桌面侧栏 348px、场景图 cover；≤720px 时高 240px、图 contain 贴左、名字与状态居右）；`applyMode()` 切换 `group-mode`；`initChatAssets()` 预加载场景图；群聊状态文案改为「三个人格 · 都在」。
  - `cloud/data/changelog.json`：追加 1 条「界面」，共 107 条。
- **流程**：本机备份 → `scp` 覆盖 → `gzip -9` 重生成 `index.html.gz` / `changelog.json.gz` → 本机与服务器 `md5sum` 比对。
- **备份位置**：服务器 `/opt/zhichao-backups/20261117-1041/`
- **影响评估**：
  - 单聊三形态立绘、点击翻转、语音与记忆逻辑均未改动。
  - 新图位于 `/assets/`，仍受 `auth_request` 保护（匿名 401，登录后 200）。
  - 未改 `server.py`，无需重启 `zhichao-memory`，登录态与聊天记忆不受影响。
- **验证**：本机预览（`dev/preview_server.py:8811`）桌面 1180×820 与模拟 390 宽手机两种视口下，群聊卡头正常、聊天与开场白正常、无 JS 报错。

---

## 2026-11-17 10:48（Asia/Shanghai）｜聊天窗口整体放大

- **变更类型**：站点前端界面部署（纯静态，未改 `server.py`，未重启容器）
- **背景**：群聊场景图接入后，主人在桌面端仍觉得窗口与侧栏偏窄。
- **部署内容**：
  - `cloud/index.html`：`.chat-card` 由 `920×680` 放大到 `1160×820`（`min(1160px,95vw)` / `min(820px,92vh)`）；单聊侧栏 `290→316px`、翻转立绘 `232→268px`（高度 78%→80%）；群聊侧栏 `348→500px`，场景图由 `cover` 改为 `contain`（完整显示，上下留渐变底）。
  - `cloud/data/changelog.json`：追加 1 条「界面」，共 108 条。
- **流程**：本机备份 → `scp` 覆盖 → `gzip -9` 重生成 `.gz` → `md5sum` 比对。
- **备份位置**：服务器 `/opt/zhichao-backups/20261117-1049/`
- **影响评估**：仅布局尺寸变化，单聊翻转、群聊调度、记忆与语音逻辑未动；≤720px 的移动端规则未改。
- **验证**：本机预览 1920 视口下卡片实测 1160×820、群聊侧栏 500、单聊立绘 268×654，均无溢出；开场白与消息渲染正常。

---

## 2026-11-17 10:52（Asia/Shanghai）｜聊天列表切换不再整页滚动

- **变更类型**：站点前端交互修复（纯静态，未改 `server.py`，未重启容器）
- **问题**：翻转立绘或单聊↔群聊切换时，`renderHistory()` 每插一条消息就调一次 `scrollBottom()`，叠加 `.chat-scroll{scroll-behavior:smooth}`，表现为历史从最顶一路滑到最底。
- **实现**：
  - 新增 `scrollMemo` / `memoScroll()`：切换前按线程 id 记录当前 `scrollTop`。
  - 新增 `bulkRender` 标志：`renderHistory()` 重建期间跳过 `addMessage()` 内的滚动，结束后统一恢复。
  - 新增 `jumpScrollTo()` / `restoreScroll()`：临时把 `scroll-behavior` 设为 `auto` 再定位，避免平滑动画；无记录或记录为 0 时停在最新一条（底部）。
  - `chatFlip` 点击与 `chatModeBtn` 点击均在切换前调用 `memoScroll()`。
- **验证**（本机预览注入长列表）：
  - 群聊 32 条渲染完成瞬间 `top=1599 / max=1599`（直接到底，无滑动）；
  - 手动置于 300 → 切单聊（底部 757）→ 切回群聊仍为 300；底部位置切换往返保持；
  - 单聊御姐 24 条置于 220 → 翻转两形态再翻回，仍为 220；
  - 单聊渲染 `top=757 / max=757`，无异常。
- **备份位置**：服务器 `/opt/zhichao-backups/20261117-1052/`
- **影响评估**：只动滚动与渲染时机，消息数据、记忆、群聊调度均未改。

---

## 2026-11-17 10:59（Asia/Shanghai）｜聊天记录加微信式时间戳

- **变更类型**：站点前端功能部署（纯静态，未改 `server.py`，未重启容器）
- **实现**：
  - 消息结构新增 `at`（ISO8601）：`sendChat` 用户消息、群聊逐段 `consumeGroup`、单聊流式回复三处 `push` 均写入；服务端 `normalize_memory()` 原样保留消息对象，跨设备同步不丢时间。
  - `addMessage(role, content, formId, name, at)` 新增第 5 参；渲染前调用 `pushTimeIfNeeded()`。
  - `TIME_GAP = 5 分钟`：与上一条间隔 ≥5 分钟才插一条 `.msg-time`，否则连续消息不重复显示。
  - `fmtMsgTime()`：当天 `HH:mm`、昨天 `昨天 HH:mm`、同年 `M月D日 HH:mm`、跨年 `YYYY年M月D日 HH:mm`。
  - `renderHistory()` 重建时重置 `lastRenderedAt`，历史消息按 `m.at` 逐条判断。
  - 样式 `.msg-time`：居中、11.5px、`var(--muted)`、轻字距，上下负 margin 收紧间距。
- **验证**（本机注入含 `at` 的长历史）：
  - 顺序数据得到 4 条时间标签：`2025年11月17日 20:10`、`昨天 21:30`、`09:00`、`09:31`；间隔 1 分钟的 `09:01` 正确不重复显示。
  - 乱序消息用 `Math.abs` 间隔判断，仍能正常出标签。
  - 无 `at` 的旧消息不插入标签，不影响原有渲染。
- **备份位置**：服务器 `/opt/zhichao-backups/20261117-1059/`
- **影响评估**：只新增展示字段与渲染插桩；消息内容、线程隔离、群聊调度、滚动记忆均未改。

---

## 2026-11-17 11:11（Asia/Shanghai）｜更新日志支持一键标记重要

- **变更类型**：站点前端 + 后端接口 + nginx 路由（结构性变更，重启过 memory 容器）
- **需求**：网页上点一下把某条更新标成「重要」，再点一下恢复普通；初始全部普通；标记持久化到服务器。
- **关键决策**：不另建 flags 文件，**直接把 `important: true` 写进 `changelog.json` 的每条 entry**（缺省即普通），用户明确要求「放在一起」。
- **技术障碍**：`zhichao-memory` 对站点目录是只读挂载（`/opt/zhichao -> /site`，实测 `touch /site/data/.probe` 报 `Read-only file system`），后端写不了站点上的 `changelog.json`。
- **解法**：权威副本迁到容器可写卷 `/opt/zhichao-memory/data/changelog.json`（容器内 `/data/changelog.json`）；nginx 把 `GET /data/changelog.json` 与 `GET/POST /api/changelog` 全部代理到 memory 容器的 `/changelog`，站点静态副本降级为备份，避免「网页标记」和「静态文件」两份分叉。
  - 初始化：`cp /opt/zhichao/data/changelog.json /opt/zhichao-memory/data/changelog.json`（43558 字节 / 110 条）。
- **服务端 `server.py`**：
  - 新增 `CHANGELOG_FILE=/data/changelog.json`、`CHANGELOG_FALLBACK=/site/data/changelog.json`、`MAX_CHANGELOG_BYTES`；
  - `read_changelog()` 优先 `/data`、缺失或损坏回落 `/site`；`write_changelog()` 临时文件 + `os.replace` 原子写；
  - `GET /changelog` 校验 `valid_session`（未登录 401）；
  - `POST /changelog` → `_handle_changelog_write()`：校验会话、body `{at, important:bool}`、`at` 必须命中 entries，置 `True` 或 `pop` 掉字段，`_changelog_lock` 串行化。
- **nginx `default.conf`**：新增 `location = /data/changelog.json`（auth_request + proxy 到 `/changelog` + 透传 Cookie + no-cache）与 `location = /api/changelog`（auth_request、`limit_except GET POST`、透传 Cookie/Content-Type）；`nginx -t` 通过、`nginx -s reload` 成功。
- **前端 `index.html`**：
  - `.log-item.imp` 左侧金色 inset 竖条；`.log-kind.imp` 金色「重要」标签；`.log-flag` 星标按钮（26px，未标灰、已标金、请求中半透明禁用）；
  - `openLog()` 日期头改为 `list.some(e=>!!e.important)` 才显示「含重要更新」；
  - 条目渲染加 `log-item imp` 类与 `<span class="log-kind imp">重要</span>`，星标按钮带 `data-at` / `aria-pressed`；
  - `#logList` 事件委托：点击 → `POST /api/changelog` → 成功后 `openLog()` 重渲染，失败 toast「标记没存上，再试一次？」。
- **验证**：
  - 临时会话（测试后 `revoke_session` 已吊销）：`GET` 110 条最后一条 `important=None`；`POST true` 返回 `{"ok":true,...}`，`GET` 变 `True`；`POST false` 后 `GET` 回到 `None`；
  - 前端本地 mock：`imps:2`、`flags:110`、日期头出现「含重要更新」，截图确认金条 + 金色「重要」+ 金色星标显示正常。
- **部署**：
  - `server.py` scp 到 `/opt/zhichao-memory/server.py` 后 `docker restart zhichao-memory`（会话表落盘，用户登录态不受影响）；
  - `default.conf` scp 到 `/opt/zhichao-nginx/default.conf` 后 `nginx -t` + `nginx -s reload`（未 restart web）；
  - `index.html` / `index.html.gz` scp 到 `/opt/zhichao/`，MD5 `54c6cf9f5847cda93de98a5ff8c3e597` / `e0802039d839bf94e3c9ccc285fe87fa` 与线上一致，页面 `grep log-flag` 命中 7 处；
  - 新增日志条目后 `changelog.json`（111 条）同时写入容器 `/data` 与站点 `/opt/zhichao/data/changelog.json`，MD5 `1ee8688e9a8ed134e376a45ca59d58de` 一致。
- **备份位置**：服务器 `/opt/zhichao-backups/20261117-1108/`（`server.py`、`default.conf`、`changelog.json`）；本机 `backups/server-live-before-changelog-*.py`、`backups/nginx-local-*.conf`。
- **部署规则变更（重要）**：今后改更新日志**必须写 `/opt/zhichao-memory/data/changelog.json`**（线上实际读取那份），只改站点副本不会生效、并会在下次部署覆盖网页标记；部署新日志前先拉取容器当前文件合并，保留 `important` 字段。
