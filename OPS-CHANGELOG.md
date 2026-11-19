# 知潮 · 运维变更日志（OPS CHANGELOG）

> 记录定时调度、部署、运维层面的变更；站点面向访客的内容/界面变更见 `cloud/data/changelog.json`。

---

## 2026-11-18 12:41（Asia/Shanghai）｜翻页音效音量提升约 3 倍

- **变更类型**：前端部署（index.html + changelog，无新素材文件）
- **触发原因**：用户反馈纸张沙沙声音量太小，几乎听不见。
- **改动清单**（均乘设置里的 `sfxVolume`，默认 0.9）：
  1. `SFX.flip` 峰值 0.085 → 0.26（时长 0.45s 不变）。
  2. `SFX.landing` 峰值 0.055 → 0.16，时长 0.28 → 0.30s。
  3. 拖动引擎上限 `0.1*level()` → `0.3*level()`，速度系数 `speed*0.012` → `speed*0.032`；静止仍归零，松手收声逻辑不变。
- **部署**：服务器备份 `/opt/zhichao-backups/20261118-1241/`（index.html、index.html.gz、两处 changelog）→ scp 覆盖 → `gzip -9` 重生成并 `gzip -t` 通过。
- **校验**：本机与线上 index.html / .gz / changelog 逐项 md5 一致；首页 200 且命中 `rustle(at0(), .45, .26`；匿名 `/data/` 401。
- **验证方式**：本地预览实测点击翻页 flipping→read、真实 CDP 拖拽 user_fold→read 且 landing 触发；`sfxVolume=0.5 / 0.9` 与 `sfx=false` 三条路径均无报错。

---

## 2026-11-18 12:13（Asia/Shanghai）｜翻页音效重做：真实纸张沙沙声 + 拖动音效

- **变更类型**：前端部署（index.html + changelog，无新素材文件）
- **触发原因**：用户反馈 10:43 上线的翻页音效太难听（带通扫频产生哨音感），且拖动纸页时没有声音、不符合物理逻辑。
- **改动清单**：
  1. SFX 内部新增 `rustle(at,dur,gain,cutoff)`：噪声先乘随机台阶式包络（每 18~44ms 换一个 0.22~1 的起伏），再走高通 1800 + 带通 3400（Q .7），去掉所有频率扫频与闷响，输出干净的纸面沙沙声。
  2. 新增拖动引擎 `drag`：2s 循环白噪声 → 高通 2000 → 带通 3600（Q .8）→ 增益；rAF 逐帧读取 `PF.flipController.calc.getPosition()`，按帧间位移欧氏距离算 speed，`gain=min(.1, speed*.012)`，setTargetAtTime(.05) 平滑；每 8 帧带通中心在 3000~4600 随机抖动；speed=0 自动收声。
  3. 公开方法 `flip/landing/dragStart/dragStop`；mountBook 内 changeState 带 prevState 做完整状态机：flipping→flip；user_fold/fold_corner→dragStart；read→dragStop，且拖动态释放时追加 landing（含拖回取消的情况）。
  4. logDlg 监听 close 事件调 dragStop，关闭按钮/Esc 中途关闭都不会留下空转 rAF。
- **部署**：服务器备份 `/opt/zhichao-backups/20261118-1213/`（index.html、index.html.gz、两处 changelog）→ scp 覆盖 → `gzip -9` 重生成并 `gzip -t` 通过。
- **校验**：本机与线上 index.html / .gz / changelog 逐项 md5 一致；首页 200、命中 rustle；匿名 `/data/` 401；changelog 122 条、updatedAt 2026-11-18T12:13:00+08:00。
- **验证方式**：本地预览实测——点击翻页 flip 调用 1 次（flipping→read）；CDP 真实拖动时增益随速度升到 0.09、停住归零、松手 read+landing；跨书脊翻页成功、小幅拖动正确取消；拖动中 Esc 关闭无报错。

---

## 2026-11-18 10:43（Asia/Shanghai）｜手账翻页音效上线

- **变更类型**：前端部署（index.html + changelog，无新素材文件）
- **触发原因**：用户反馈更新日志翻书时没有翻页声。
- **改动清单**：
  1. SFX 模块新增 `flip()`：用白噪声经带通滤波（1500→480Hz 扫频）+ 起页高频轻擦（hush, 3200）+ 落页 196Hz 闷响，合成 0.42s 纸页沙沙声，长度贴着 700ms 翻页动画。
  2. `mountBook()` 内监听 StPageFlip 的 `changeState` 事件，进入 `flipping` 状态即调用 `SFX.flip()`；覆盖边缘热区、← → 键、触屏滑动，每次翻页只触发一次（埋点验证 calls=1/flip）。
  3. 复用既有开关：`settings.sfx=false` 或音量 0 时自动静音，不报错。
- **部署**：服务器备份 `/opt/zhichao-backups/20261118-1043/`（index.html、index.html.gz、两处 changelog）→ scp 覆盖 → `gzip -9` 重生成并 `gzip -t` 通过。
- **校验**：本机与线上 index.html / .gz / changelog 逐项 md5 一致；`http://127.0.0.1/` 200 且命中 `SFX.flip`；匿名 `/data/` 401；changelog 121 条、updatedAt 2026-11-18T10:43:00+08:00。
- **验证方式**：本地预览（8811）实测热区点击与方向键触发 changeState 序列 flipping→read，音效调用计数正确、无控制台报错；关闭 sfx 路径安全。

---

## 2026-11-17 13:10（Asia/Shanghai）｜本地与云端全量对账并统一 .gz 副本

- **变更类型**：文件同步 / 运维对账（无站点内容变更，changelog.json 不新增条目）
- **触发原因**：用户要求同步本地与云端。
- **对账结果**：本地 `cloud/` 与云端 `/opt/zhichao/` 逐文件 md5 比对——104 个同名文件**内容全部一致**（含 index.html、js、styles、assets、data、运维脚本）；差异仅两类：
  1. 本地 3 个 `.gz` 副本已过期（`data/changelog.json.gz`、`data/current.json.gz`、`js/mascot.js.gz`），解压后与源文件不一致。
  2. 云端独有 `styles/clock.css.gz`，本地缺失。
- **处理**：本地用 `gzip -9 -n` 重新生成全部 11 个 `.gz`（去掉时间戳与文件名，保证两端字节一致），补出缺失的 `styles/clock.css.gz`，整套 scp 覆盖云端并 `chown 1234:1234` / `chmod 644`。
- **备份**：云端旧 `.gz` 已备份至 `/opt/zhichao-backups/20261117-1310/`。
- **校验**：两端 11 个 `.gz` 解压后与各自源文件 md5 全部匹配（11/11 OK）；全量对账 104 文件一致、0 处内容不一致；`http://127.0.0.1/` 200、`Accept-Encoding: gzip` 的 js 200、匿名 `/data/` 401。
- **说明**：`cloud/assets/book-cover.webp`（改版前的旧封面）仅保留在本地作素材备份，未上传，属预期差异。

---

## 2026-11-17 13:02（Asia/Shanghai）｜页码改为只标正文，封面封底不显示

- **变更类型**：前端部署（index.html + changelog），本机与线上同步
- **触发原因**：用户要求页码只覆盖正文范围（内容第一页 → 最后一页），封面/封底不要出现页码。
- **改动清单**：
  1. `buildPages()` 尾部新增正文编号：遍历 `front` 与 `content` 页，赋予 `page.no`（从 1 起算），并写入 `BOOK.bodyTotal`；封面 `art`、题名 `title`、`colophon`、封底 `back` 不参与编号。
  2. `pageNoHTML(no)` 改为按 `page.no / BOOK.bodyTotal` 输出，深度色/右下角等变体分支及对应 CSS（`.bk-pageno.dark`、`.bk-pageno.corner`）一并删除。
  3. `renderSheet()` 仅 `front` 与 `content` 追加页码，其余四类页面不输出。
  4. 目录「第 N 页」改用同一套正文编号（原为物理页序号 idx+1），保证目录页码与正文页码一致。
- **部署**：服务器备份 `/opt/zhichao-backups/20261117-1302/` → scp 覆盖 index.html、index.html.gz、两处 changelog → `gzip -9` 重生成并 `gzip -t` 通过。
- **校验**：本机与线上 index.html / .gz / changelog 逐项 md5 一致；`http://127.0.0.1/` 200 且命中 `BOOK.bodyTotal`；匿名 `/data/` 401；changelog 120 条、updatedAt 2026-11-17T13:02:00+08:00。
- **验证方式**：本机预览逐页断言——`art/title/colophon/back` 无 `.bk-pageno`，`front` 为 1/26，末页 content 为 26/26；目录五个日期页码（2/9/17/23/25）与正文一致。

---

## 2026-11-17 12:58（Asia/Shanghai）｜手账页码移入书页 + 修复向后翻页失效

- **变更类型**：前端部署（index.html + 翻页库补丁 + changelog）
- **触发原因**：用户要求取消书外底部悬浮的「‹ N / 28 ›」翻页按钮，把页码直接印在每张书页的页尾。
- **改动清单**：
  1. 删除 `.book-foot` 整块标记（bkPrev/bkPage/bkNext）与对应 CSS；`.book-wrap` 下边距 42px 收回为 12px。
  2. 新增 `.bk-pageno`（页尾居中、衬线小字）：纸张页用浅灰梅色，深色页用浅色字 + 暗部阴影；封底加 `.corner` 放右下角，避开居中落款块。
  3. JS 新增 `pageNoHTML(index,dark,corner)`，`renderSheet(el,page,index)` 五类特殊页与内容页统一追加页码；`sheetFor` 透传 map 下标；删除 `updateFoot` 及其全部调用与 bkPrev/bkNext 绑定。
  4. **顺带修复**：排查中发现 `PF.flipPrev()` 在当前布局下完全失效（左边缘热区、左方向键同受影响）。根因是库内 `flipPrev` 把点击点写死为 `x:10`，未加书体左偏移（本布局 left=12），`isPointOnCorners` 判定点落在书页外而拦截。已给 `cloud/js/page-flip.min.js` 打补丁：x 改为 `getRect().left+10`，y 按 `getRect().top` 修正；引用版本号 `?v=20261117d` → `e`。
- **部署**：服务器备份 `/opt/zhichao-backups/20261117-1258/`（index.html、index.html.gz、page-flip.min.js、两处 changelog）→ scp 覆盖 → `gzip -9` 重生成并 `gzip -t` 通过 → changelog 同写 memory 卷权威路径与站点备份路径（md5 一致）。
- **校验**：本机与线上 index.html / .gz / page-flip.min.js / changelog 逐项 md5 一致；`http://127.0.0.1/` 200 且命中 `.bk-pageno`；补丁在服务端文件中可检索；匿名 `/data/` 401（鉴权正常）。
- **验证方式**：本机 `dev/preview_server.py 8811` 实测 28 页页码全部正确（1/28–28/28），公共 API/方向键/边缘热区三条向后翻页路径均恢复，标记重要重渲染后页码不丢失，控制台无报错。

---

## 2026-11-17 12:45（Asia/Shanghai）｜手账翻书改版：对开封面 / 封底 / 取消点空白退出

- **变更类型**：前端部署（index.html + 3 张新插画素材 + changelog）
- **触发原因**：用户反馈 ① 翻书第一页左侧空白难看，要求重做封面；② 翻第一页时书脊有缝；③ 点书页外空白（以及聊天页、热点详情页等）会误关弹层。封面插画由用户从生成稿中选定（前封面：御姐捏脸教训萝莉、少女写手账；封底：萝莉撒纸被拎住）。
- **基线说明**：本机 `cloud/index.html` 与线上版本存在分叉（线上早已把封面图换成 `group-xiyin-home.webp`，本机仍是旧 `book-cover.webp`）。为避免覆盖线上改动，**以服务器线上版本为基线重新落地全部改动**，改前的本机副本存 `backups/index-before-cover-redesign-20261117-1240.html`。
- **改动清单**：
  1. 首屏：删除 `.book.is-cover::before/::after` 假左半封面遮罩；`pages` 由 `[cover, front]` 改为 `[art, title, front]`；StPageFlip `showCover:false`、去掉首张 `data-density=hard`；`.book` 补深梅底色，消除奇偶页/动画途中露底。
  2. 封面：左页 `assets/book-cover-art.webp`（含 760w `-sm` 版走 srcset）+ 竖排落款 + 月牙印章；右页题名页（金线细框、星点、巨月暗纹、竖排 2026、条数/日期/提示）。
  3. 封底：末页 `assets/book-cover-back.webp` + 一句落款；总页数为奇数时自动插一页「落款页」，保证封底永远落在右页。
  4. 弹层：移除 `trashDlg / delDlg / shareDlg / reader / logDlg / chatOverlay` 六处「点背景关闭」监听，仅保留关闭按钮（dialog 与聊天窗仍可 Esc 退出）。
- **素材**：`assets-source/cover/handbook-cover-scene-20261117.jpg`、`handbook-back-scene-20261117.jpg`（原始 1536×1536）；站点用 1200×1200 webp（84/84）+ 760×760 sm（82）。原 `book-cover.webp` 保留未删。
- **部署**：服务器备份 `/opt/zhichao-backups/20261117-1252/`（index.html、index.html.gz、两处 changelog）→ scp 覆盖 → `gzip -9` 重生成 `.gz` 并 `gzip -t` 通过 → changelog 同写 `/opt/zhichao-memory/data/changelog.json`（权威）与 `/opt/zhichao/data/changelog.json`（备份，两份 md5 一致）。
- **校验**：本机与线上 `index.html` / `.gz` / 3 张素材 / changelog 逐项 md5 一致；`http://127.0.0.1/` 200、页面命中新样式类；匿名访问 `/assets/*` 仍 401（鉴权正常）。
- **验证方式**：本机 `dev/preview_server.py 8811` 实测首屏对开（无左空白、无书脊缝）、翻页连续帧、封底与落款页、以及手账/聊天/热点详情三处「点空白不退出」。

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

---

## 2026-11-17 11:26（Asia/Shanghai）｜更新日志改成可翻的书（封面 + 按天分页）

- **变更类型**：站点前端改版（`cloud/index.html`，未改 server.py / nginx）
- **需求**：更新日志做成翻书，带封面与二次元元素；按天分页，一天内容多可占多页，不同日期不共页。
- **选型**：没有引入 turn.js / stPageFlip 这类外部库，直接用 CSS 3D + DOM 测量自研。原因：站点要控体积且不依赖外网，日志数据结构（按天分组 + 星标按钮）需要与分页深度耦合，套现成库反而要改造它的翻页模型。
- **分页算法**（`buildPages`）：
  - 按 `at` 日期分组、倒序；**每个日期强制新开一页**，同一天条目超出页高才续页，续页重新画日期头并标「续」，因此不同日期永远不会同页。
  - 用隐藏测量容器 `#logMeasure`（宽度 = 纸面宽 - padding、字体一致）逐条 `append → getBoundingClientRect().height → remove`，累加高度对比预算 `纸高 - 72px` 切页，避免估算误差导致溢出。
  - 生成日期目录（`BOOK.toc`），扉页列出每个日期的起始页。
- **翻页交互**：
  - 桌面左右双页：翻下一页用 `leafNext`（右半、`transform-origin:left`、双面 `backface-visibility`），正面放当前右页、背面放下一左页，`rotateY(0→-180deg)` 0.9s；结束瞬间隐藏 leaf、步进 2 页、重绘静态页，避免闪回。回翻用 `leafPrev`（左半、`origin:right`、0→180deg）。
  - 移动端（`max-width:760px`）单页模式：隐藏右页与翻页层，步进 1 页，切页用 `animate()` 位移淡入。
  - 入口：书本左右边缘 34px 热区、底部 `‹ ›`、键盘 ←/→、手机左右滑动（阈值 46px）。
  - 封面：`assets/group-xiyin-home.webp` 夜晚客厅作底，深紫渐变 + “汐音的更新手账”标题 + 统计与日期范围；扉页为说明 + 日期目录。
- **样式**：纸面米色渐变、左右页内侧书脊阴影、中缝 `book-hinge`、`bk-day` / `bk-item` / `bk-flag` 独立命名避免与旧 `.log-*` 冲突；重要条目保留金色 inset 竖条与「重要」金标。
- **踩坑与修正**：
  - 关闭按钮原先 `right:-6px` 溢出 dialog，触发横向滚动条 → 改为书内右上角圆形按钮 + `#logDlg{overflow:visible}`。
  - 页码原在书内底部被书脊遮 → 移到书外 `bottom:-34px`，`book-wrap` 预留 40px。
  - 续页日期头原先重复显示当天总数 → 续页只显示「续」。
- **验证**（本机预览，111 条 / 5 天）：
  - 分页结果 28 页（封面 + 扉页 + 26 内容页）；目录为 11/17→第 3 页、11/16→第 8 页、11/15→第 17 页、11/12→第 23 页、11/11→第 26 页，日期边界与页号一致。
  - 翻页中途截图可见纸页绕书脊倾斜，结束后 `3 / 28`、左页 17 日首页 4 条、右页续页 4 条，`pageR.scrollHeight == clientHeight`（无溢出）。
  - 单页模式（`BOOK.single=true`）页宽撑满、无溢出。
- **部署**：`index.html` / `index.html.gz` scp 到 `/opt/zhichao/`，MD5 `c6f9bc5d68405aa3527264ea2ec18703` / `f1111e69e40b201b095befb5f37d50e1` 与线上一致；首页 200，页面 `grep bk-cover` 命中 13 处。
- **日志合并**：部署前先拉取容器 `/data/changelog.json`，发现线上已有 **7 条**被用户标为重要（11-12 13:45、11-15 11:30/20:30/23:05、11-16 20:48/20:51、11-17 10:32），追加新条目时保留原标记，未覆盖；现为 112 条 / 7 条重要，MD5 `aacdf563ced1c1e5e7cc04a8948e9c25`（容器与站点副本一致）。
- **备份位置**：服务器 `/opt/zhichao-backups/20261117-1126/`（旧 index.html、index.html.gz）；本机 `backups/index-before-logbook-*.html`。

---

## 2026-11-17 11:54｜翻书换成 StPageFlip 软页引擎（替换同日 11:26 自研版）

上一版自研翻页不合格：纸页整块 `rotateY`，没有弯曲；翻完要等 0.9s 才换内容。分页算法保留，翻页改交给成熟库。

- **库**：page-flip（StPageFlip）2.0.7，44KB，无 jQuery 依赖，放 `cloud/js/page-flip.min.js`。**刻意不放 `/vendor/`**：nginx 的 `/vendor/` 走 `auth_request`，未登录 401，库加载失败整本书就翻不动；`js/` 是公开外壳路径，稳定 200。
- **结构**：`#logBook` 内每页一个 `.bk-sheet`，封面加 `data-density="hard"`。settings：`size:'stretch'`、`showCover:true`、`usePortrait:true`、`flippingTime:700`、`drawShadow:true`、`maxShadowOpacity:0.42`、`disableFlipByClick:true`、`clickEventForward:true`，`loadFromHTML` 交给库渲染。
- **分页**：沿用按天分组 + 隐藏容器量高；页宽 = 容器宽 / 2（<760px 单页），高度预算 = 书容器高 − 86px。
- **星标**：点完就地重渲染该页（按 `page.items` 当前数据现算节点），不重建整本、不打断翻页位置。
- **三个坑**：
  1. `PF.destroy()` 会连 `#logBook` 容器一起删掉，第二次打开找不到容器 → mount 时检测并重建容器。
  2. 星标点不动：库保留一份隐藏的 `.bk-sheet` 副本，交互要落在可见的 `.stf__item` 上；且 `renderSheet` 原先复用构建时节点（状态是旧的），改成按当前数据现算。
  3. 库要 `clickEventForward:true` 才把点击转发给页内按钮。
- **验证**：25 页（封面 + 扉页 + 23 内容页）；翻页中截图可见纸面绕书脊弯成弧、底部折角与折痕阴影；`flipNext()` 后 `getCurrentPageIndex` 同帧变化、目标页立即显示；关闭重开停在上次页（2/25 保持）；窄容器 380px 自动 portrait 单页、无溢出。
- **部署**：`index.html` `2a2ce2e86c2ae81141ebebf9f5ca2141`、`index.html.gz` `75763905058ae1b8b249c3b872a68ec3`、`js/page-flip.min.js` `d437997444137c3d1ee879f2bd321b44`，线上一致；首页 200、`/js/page-flip.min.js` 200（44058 字节）。备份 `/opt/zhichao-backups/20261117-1154/`。
- **日志**：先拉容器版本再合并，新增 1 条（113 条 / 7 条重要保留），`cloud/data/changelog.json` 与 `/opt/zhichao-memory/data/changelog.json`、`/opt/zhichao/data/changelog.json` MD5 均 `b9492d2521e983d3f418920987b4da0e`。

---

## 2026-11-18 21:15（Asia/Shanghai）｜新增《汐音 · 服装与立绘风格规范》

- **变更类型**：文档新增（未改站点代码与线上文件，纯本地资产）
- **需求**：把用户确认的「灰调日系动画设定图」画风固化成文档，方便日后换装、出周边时复现一致风格。
- **产出**：`/home/user/zhichao/汐音-服装设计规范.md`（v1.0）
  - 画风量化参数表：线稿（深灰褐 1–2px @1024）、平涂、明度 78–95、一阶淡粉紫阴影、对比偏低但轮廓清晰、纯浅粉背景；
  - 图生图提示词模板（身份段 / 服装段 / 风格段 / 负向段），并记录两条关键写法：只写「极细线」会导致整体褪色丢轮廓，需同时写「轮廓锐利、边界干净」；「无渐变」与「柔和」不能并列写。
  - 参考图分工规则：图一身份、图二只给画风，禁止借人物，避免多图串角色。
  - 头像标准流程：头占高 60–70%、四周安全区 ≥6%、出图后缩 88% 居中做安全边距版。
  - 迭代记录：水彩版→粗线赛璐璐→细线薄涂→灰调定版，冷发色版为备选未采用。
- **定版依据**：`汐音-粉兔兔冬装-日系-灰调.png`（2026-11-18 用户确认）。
- **影响范围**：仅规范文档；站点立绘 `cloud/assets/mascot*.png` 未替换，上线另需备份。

---

## 2026-11-18 21:57（Asia/Shanghai）｜深色主题看板娘换成哥特礼服（夜间模式）

- **变更类型**：站点前端 + 资源新增（`cloud/index.html`、`cloud/js/mascot.js`、`cloud/assets/`）
- **需求**：用户确认哥特时装方案，要求作为「夜间模式的看板娘」应用到站点并部署。
- **画风**：沿用《汐音-服装设计规范.md》v1.0 的「灰调日系动画设定图」；哥特深色一律用雾灰紫过渡，不出现死黑色块。
- **新增资源**：
  - `assets/mascot/layer-body-night.webp`（768×768，RGBA，64.7KB）：常驻看板娘夜间单层整图。
  - `assets/mascot-night.webp`（480×360，RGBA，23.2KB）：首屏右上角横版侧卧插画，构图对齐原 `mascot.webp`。
  - 生成链：`image_edit`（灰调日系）→ `mediakit-cli image remove-image-background --scene general` 抠图 → **alpha 解混去白边**（背景采样 `#F3E9EB`，`F=(C-(1-a)B)/a`，a<0.42 置透明），否则深色底上会有浅粉描边。
- **代码改动**：
  - `js/mascot.js`：`ASSET` 增 `bodyNight`；新增 `isNightTheme()` / `bodySrc()`；`applyThemeAssets()` 用 MutationObserver 监听 `html[data-zc-theme]`，只替换 img `src`、不重建 DOM，呼吸/跟随/拖拽位置不打断；夜间移除后发层（哥特版为单层整图，长发放视差无意义）；`preload()` 预载两套；`shutdown()` 断开 observer。
  - `index.html`：首屏 `.mascot` 增 `data-src-night`；`enterApp()` 回填改为「夜间优先取 night 图，否则回落日间」；新增 `watchMascotNight` 监听，仅在 `#app` 可见（已登录、图片已回填）时才换图，避免触发受保护资源的匿名请求。
  - 版本号：`js/mascot.js?v=20261116c` → `?v=20261118a`。
- **本地验证**（`python -m http.server` + Chromium）：
  - `ZC.set('theme','dark')` 后：首屏 `assets/mascot-night.webp`、常驻 `assets/mascot/layer-body-night.webp`、后发层子节点 0；
  - 切回 `light`：首屏回 `assets/mascot.webp`、常驻回 `layer-body.webp`、后发层恢复 1 个 img；
  - 深色底截图确认无白边、黑纱半透明保留。
- **部署**：
  - `index.html` `29693d32…`、`index.html.gz` `e75af82a…`、`js/mascot.js` `26842fbe…`、`mascot.js.gz` `fb9d591c…`、`assets/mascot-night.webp` `e7301c85…`、`assets/mascot/layer-body-night.webp` `e3517eb6…`，服务器与本机 MD5 全部一致；上传后 `touch` 两个 `.gz` 保证 `gzip_static` 生效。
  - 线上复核：`/` 200；`/js/mascot.js?v=20261118a` 200 且命中 `layer-body-night`；匿名 `/assets/mascot-night.webp` 401（鉴权正常）。
- **更新手账**：条目 123 → 124，`/opt/zhichao-memory/data/changelog.json`、`/opt/zhichao/data/changelog.json`、`cloud/data/changelog.json` 三处 MD5 `26700ebe…` 一致，保留既有 `important` 标记。
- **备份**：`/opt/zhichao-backups/20261118-2155/`（旧 index.html、index.html.gz、js/mascot.js、js/mascot.js.gz）。
- **未验证**：线上登录态的真实浏览器渲染（仅校验文件部署与匿名可读性）；如需可登录后人工看一眼深色切换。

---

## 2026-11-18 23:02（Asia/Shanghai）｜聊天页三形态立绘换成知潮制服三件套

- **变更类型**：站点资源替换（`cloud/assets/chat-xiyin*.webp`，未改 HTML/JS/CSS）
- **需求**：聊天页三个形态的服装重新设计，统一为「知潮制服系统」：御姐＝主编版、少女＝编辑版、萝莉＝见习生版；少女与萝莉按要求改为暗色。
- **画风**：沿用《汐音-服装设计规范.md》v1.0 灰调日系；暗色统一用雾灰紫过渡，避开死黑。
- **设计要点**：
  - 主编版：深雾蓝黑斜裁长风衣、烟紫高领、金线腰封、月相胸针、稿纸、尖头短靴。
  - 编辑版：暗莓紫工装短外套 + 雾灰米长裙（薄纱印浅灰蓝水波纹）、奶油丝巾、`知潮 · 编辑` 工牌、采集腰包。
  - 见习生版：暗夜空蓝背带短裤裙、奶油白泡泡袖水手领、暗酒红大蝴蝶结与玛丽珍鞋、深灰蓝报童帽、月牙贴纸本。
- **生产技术**：`image_edit` 出设计稿 → `mediakit-cli image remove-image-background --scene general` 抠图 → alpha 解混去白边（`F=(C-(1-a)B)/a`，a<0.42 置透明，背景采样 ≈ `#F3E9EB`）→ trim → 按 95% 高度居中贴到 720×1080 透明画布 → WebP q85。
  - 注：直接让模型输出「透明背景」不可靠（三次请求里有两次返回 RGB 黑底/不透明图），仍以抠图 + 解混为稳定做法。
- **本地验证**（`http.server` + Chromium，登录态模拟后 `openChat()`，逐形态 `initForm()` 截图）：三套立绘透明底干净、无白边、与浅色与深色主题均正常显示；文字标签「御姐 / 萝莉 / 少女形态 · 在线」与图片对应正确。
- **部署**：三张 WebP 上传 `/opt/zhichao/assets/`，MD5 与本地一致：
  `chat-xiyin.webp 7511448e…`、`chat-xiyin-cute.webp 00c68bab…`、`chat-xiyin-girl.webp 487eee45…`。
- **更新手账**：条目 124 → 125，三处 `changelog.json` MD5 `54db6786…` 一致。
- **备份**：服务器 `/opt/zhichao-backups/20261118-2300/`（旧三张立绘）；本机 `backups/chat-xiyin*-before-nightstaff-20261118.webp`。
- **未验证**：线上登录态的聊天页实际渲染（仅校验文件与本地同构页面）。

---

## 2026-11-18 23:08（Asia/Shanghai）｜聊天页三形态统一为哥特体系（第二轮）

- **变更类型**：站点资源替换（`cloud/assets/chat-xiyin*.webp`，未改 HTML/JS/CSS）
- **需求**：用户认为三形态应统一风格——少女形态直接沿用夜间哥特立绘，御姐与萝莉也改做哥特造型。
- **产出**：
  - 御姐 → `chat-xiyin.webp`：哥特主编。修身高领长裙（雾黑灰缎面 + 月光白蕾丝领口袖口）、暗酒红交叉束腰、短黑纱披肩、尖拱蕾丝裙摆、月相胸针、黑蕾丝长手套、长柄烛台、系带高跟短靴。
  - 少女 → `chat-xiyin-cute.webp`：直接复用夜间模式同一张哥特立绘（`哥特立绘-透明.png`），持烛台站姿，与常驻看板娘夜间形象完全一致。
  - 萝莉 → `chat-xiyin-girl.webp`：哥特见习生。黑色多层蕾丝蓬蓬裙 + 白蕾丝小围裙（口袋露手账本）、暗酒红大蝴蝶结、小黑礼帽（酒红缎带 + 月牙别针）、月牙提灯、深灰蓝条纹袜、暗酒红玛丽珍鞋。
- **技术**：御姐/萝莉 `image_edit` 出稿（图一给形态身份、图二给哥特风格语言）→ mediakit 抠图 → alpha 解混去白边 → trim → 95% 高度居中贴 720×1080 → WebP q85。少女直接走解混 + 裁切，未重新生成，保证与夜间立绘同源。
- **本地验证**：Chromium 模拟登录后 `openChat()`，逐形态 `initForm()` 截图；`mature / girl / cute` 三档与三张图对应正确，透明底无白边，浅色面板下显示正常。
- **部署**：三张 WebP MD5 与本地一致——`chat-xiyin.webp 2d67c61f…`、`chat-xiyin-cute.webp 3800b394…`、`chat-xiyin-girl.webp 2b87931f…`。
- **更新手账**：125 → 126 条，三处 MD5 `2ea46370…` 一致。
- **备份**：服务器 `/opt/zhichao-backups/gothic-20261118-2306/`（上一版暗色制服三张）。
- **未验证**：线上登录态实际渲染（文件与同构页面已验证）。

---

## 2026-11-18 23:16（Asia/Shanghai）｜本地仓库 E:\AIHOT 与线上对齐

- **变更类型**：镜像同步（服务器 → 本地），不改站点。
- **做法**：本地无 git/ssh 在 PATH，改用 `C:\Windows\System32\OpenSSH\ssh.exe` / `scp.exe`，密钥 `C:\Users\31737\.ssh\id_rsa`（已验证免密）。
- **差异判定**：服务器 `find + md5sum` 清单 106 条，本地 `Get-FileHash` 清单，按「仅服务器有 / 内容不同 / 仅本地有」三类比对。
- **拉取 19 个**：`assets/book-cover-art-sm.webp`、`book-cover-art.webp`、`book-cover-back.webp`、`mascot-night.webp`、`mascot/layer-body-night.webp`、`js/page-flip.min.js`、`vendor/page-flip.min.js`、`styles/clock.css.gz`；`assets/chat-xiyin{,-cute,-girl}.webp`、`data/changelog.json{,.gz}`、`data/current.json{,.gz}`、`index.html{,.gz}`、`js/mascot.js{,.gz}`。
- **保留 29 个本地独有文件**（旧 PNG 素材、`beautify.js`/`polish.js`/`beautify.css`/`polish.css` 实验件、`index.backup-before-mascot.html`），未删除。
- **校验**：同步后重算本地清单，与服务器比对 **缺 0 / 不一致 0**；三张聊天立绘与 `changelog.json`（`2ea46370…`）均与线上一致。
- **备份**：`E:\AIHOT\.sync-backup-20261118\`（13 个被覆盖文件 + 旧 `OPS-CHANGELOG.md`）。
- **文档**：`OPS-CHANGELOG.md` 514 → 743 行，旧 31 个段落全部保留；`汐音-服装设计规范.md` 首次落到本地；`HANDOVER-zhichao-curation.md` MD5 未变。

---

## 2026-11-18 23:28（Asia/Shanghai）｜聊天立绘按主题双套 + 御姐道具整改

- **变更类型**：站点资源 + 前端逻辑（`index.html`、`assets/chat-xiyin*.webp`）
- **两个问题**：
  1. 哥特御姐与哥特少女都持烛台，道具重复，角色辨识靠不住。
  2. 浅色主题下聊天左栏显示的是暗色哥特立绘，与亮色面板冲突。
- **御姐道具整改**：基于原出稿做局部编辑（只动手部），烛台改为「右手黑羽笔 + 左手一叠卷边校样稿」，其余（服装、姿态、光色、画风）保持不动。系列内三形态道具不再重复：主编＝羽笔/校样稿、少女＝烛台、见习生＝提灯。
- **主题双套**：
  - 白天（`data-zc-theme="light"`）→ 原版浅色立绘，直接复用 `backups/chat-xiyin*-before-nightstaff-20261118.webp`（MD5 与原版一致，未重新生成，避免又一次风格漂移）。
  - 夜间（`data-zc-theme="dark"`）→ 哥特礼服三张。
  - 新增资源 `assets/chat-xiyin-day.webp`（`c62706d8…`）、`chat-xiyin-day-cute.webp`（`733a41d8…`）、`chat-xiyin-day-girl.webp`（`ccee1712…`）。
- **代码改动**：
  - `FORMS` 每项新增 `day` 字段，新增 `formSrc(f)` 按当前主题返回 `f.src`／`f.day`。
  - `initForm()`、翻转预加载 `hiddenFace.src`、消息头像 `av.src` 全部改走 `formSrc()`。
  - 新增 `watchFormTheme()`：监听 `html[data-zc-theme]`，聊天窗口开着时即时换 src（只改 src 不重建 DOM，同样避开未登录时的匿名请求）。
  - `initChatAssets()` 预加载两套图，切换不闪。
- **本地验证**：Chromium 模拟登录，`light` 下三形态逐张截图＝原版立绘；`dark` 下御姐＝哥特新道具版（羽笔+稿纸，无烛台）；无 pageerror。控制台两条 404 来自本地缺失的语音/群聊场景图，非本次资源。
- **部署**：`index.html 011476cb…`、`index.html.gz e5630ff0…`、`chat-xiyin.webp 3dcdacfb…` 与服务器一致。
- **更新手账**：126 → 127 条，三处 MD5 `cf4068d7…`。
- **备份**：服务器 `/opt/zhichao-backups/theme-20261118-2327/`（旧 index.html、index.html.gz、旧御姐图）。
- **未验证**：真实浏览器手动切主题的连续切换（本地仅脚本切属性验证）。

---

## 2026-11-18 23:45（Asia/Shanghai）｜静态资源按模块重组（本地 + 云端）

- **变更类型**：目录结构重构（`assets/` 由 60 个平铺文件改为分模块目录），涉及 `index.html`、`js/mascot.js` 引用路径。
- **动机**：顶层平铺 60 个文件，图标/立绘/贴纸/占位图混在一起，找东西靠记名字。
- **新结构**：`brand/`（图标）、`cover/`（书封）、`chat/`（三形态立绘）、`emo/`（空态表情）、`ui/`（占位与开场门）、`mascot/pose|chibi|sticker|scene/`（看板娘各相）、`music/`、`voice/`、`_archive/`（历史与本地独有，不参与引用）。
- **执行方式（可复现）**：
  1. 生成 `旧路径→新路径` 映射表（57 条），`mv` 逐条搬迁，**先改代码后换目录会 404，这里顺序是「先移文件、再改引用」在本地副本验证，最后同步线上**。
  2. `python` 按映射对 `index.html`、`js/mascot.js` 做精确字符串替换（41 处），未改任何逻辑。
  3. 校验：脚本抽取两文件里全部 `assets/` 引用（37 条，其中 3 条是 `assets/voice/<form>-` 拼接前缀），逐个 `os.path.exists` 检查，0 缺失。
  4. `gzip -9 -n` 重新生成 `index.html.gz`、`js/mascot.js.gz`。
- **本地验证**：Chromium 载入新结构，监听 `response>=400` 且 URL 含 `assets/`，**0 条 404**；首屏、星月手账、聊天页三张截图正常。
- **云端**：备份 `/opt/zhichao-backups/reorg-20261118-2337/`（26M，含整份 assets 与四个代码文件）→ 服务器按同一映射 `python shutil.move`（moved 56 / skip 1，skip 的是线上本就没有的 `book-cover.webp`）→ 上传 `index.html(.gz)`、`js/mascot.js(.gz)`。
- **一致性**：服务器 109 文件 / 本地 139（多出 30 个全是归档件），**仅服务器有 0、内容不同 0**。
- **本地仓库处理**：`E:\AIHOT\cloud\assets` 先整份备份到 `.sync-backup-20261118\assets-before-reorg`（106 文件），再从服务器整目录拉取，最后把**本地独有的 25 个旧素材**（`*_zhizhu` 系列 PNG、旧 `mascot-*.png`、`chat-xiyin*.png` 等）归入 `assets/_archive/local-legacy/`；未上线的 `js/beautify.js`、`js/polish.js`、`styles/beautify.css`、`styles/polish.css`（确认 index.html 引用数 0）与 `index.backup-before-mascot.html` 归入 `cloud/_archive/local-legacy/`。
- **数据**：顺带把 `data/current.json(.gz)`、`data/changelog.json(.gz)` 拉到最新（手账 127 条，`cf4068d7…`）。
- **文档**：`HANDOVER-zhichao-curation.md` 新增「静态资源目录结构」一节。
- **风险提示**：任何外部脚本若硬编码了旧的 `assets/xxx.webp` 平铺路径，需要同步改；站内引用已全部走新路径。


---

## 2026-11-19 09:50（Asia/Shanghai）｜新增「汐音·形象」页（九秒 CG + 六套装束陈列）

- **变更类型**：界面新增（改动集中在 `index.html` 内嵌 CSS/JS，未新增独立 js/css 文件）；新增一个静态视频资产。
- **动机**：9s《潮间编辑部小屋》CG（seedance 2.5）不做每次进门的强制开场，改放入形象页按需播放，避免主人高频回访每次被 9 秒打断；形象页作为看板娘作品集陈列六套装束。
- **内容**：
  - 左侧导航新增「汐音·形象」菜单按钮（`#artBtn`，`--c:var(--accent)`，星芒图标，样式沿用 `log-btn`）。
  - 新增 `<dialog id="artDlg">` 模态弹窗：16:9 视频播放器（`#artVideo`，`controls/playsinline/preload=metadata`，poster 复用 `assets/mascot/scene/group-xiyin-home.webp`）+ 三张昼、三张夜共六张立绘卡片（御姐/少女/萝莉 × 昼/夜，复用 `assets/chat/` 已有立绘，不复制大文件），每卡标注形态/职责与一句服装设定。
  - 打开弹窗才把 `data-src` 填充为 `src`（视频 + 六图），关闭时 `video.pause()`；未登录不发起匿名请求。
- **视频处理**：源为 HEVC 1280×720 / 9.06s，转 H.264（yuv420p, CRF23）+ AAC 96k + `+faststart` 便于网页流式，落 `cloud/assets/art/intro-cg.mp4`（1.92MB）。
- **gitignore**：`cloud/assets/art/` 整目录排除、不随仓库提交；未改动、未排除已被跟踪的 `music/`、`voice/` 等既有大文件。
- **本地校验**：7 个 `<dialog>` 全部配对、标签栈空；`artBtn/artDlg/artVideo/openArt` 引用齐全；本机 index.html md5 与服务器一致（`c474c9799b5254c00db45d4ac422c5e6`）。
- **云端**：备份 `/opt/zhichao-backups/20261119-0950/`（原 index.html/.gz）→ scp `index.html(.gz)` 与 `assets/art/intro-cg.mp4`；未改后端、未重启容器。
- **一致性校验**：本机/服务器 `index.html` md5 一致（`c474c9799b5254c00db45d4ac422c5e6`）、`.gz` 一致（`ee9e0504afacf7a07de3062529b9323b`）、视频 md5 一致（`51196626bd558fcf0798e30e09838389`）；线上主页 200、`Cache-Control: no-cache, must-revalidate`；匿名 `/assets/art/` 与 `/assets/chat/` 均 401。
- **日志**：changelog 新增 1 条（界面，128 条），权威/备份/本机三份一致；本地副本已追加同条。
- **风险提示**：视频走 `/assets/` 的 `auth_request`，仅登录可看；`art/` 目录被 gitignore，后续新增大视频同样不入库，需单独 scp 部署；本地无 git CLI，提交由用户在终端执行。


---

## 2026-11-19 10:12（Asia/Shanghai）｜形象页改 Swiper coverflow 卡组（悬停抽出 + 点卡详情）

- **变更类型**：界面交互重构（`index.html` 内嵌 CSS/JS）；新增开源库本地 vendor。
- **动机**：旧平铺网格立绘被 `cover` 裁掉头尾、形式太素；要求游戏向错位堆叠、悬停抽出、点卡弹详情，不自己造轮子，用可复用开源工具。
- **选型**：Swiper 11.2.6（MIT，原生 JS 零依赖），bundle 落 `vendor/swiper-bundle.min.js`(154008B) + `.css`(18454B)，不依赖公网 CDN；`effect:'coverflow'` 中心突出、两侧后叠错位。
- **改动**：立绘 `object-fit:contain` 全身不裁切；悬停 `translateY(-18px) scale(1.05)` + 粉边 + 深阴影 + 提亮；点卡弹 `<dialog id="artDetailDlg">` 完整立绘大图 + 名称/职责 tag + 服装设定；打开才填充 data-src，关闭暂停视频。
- **校验**：playwright+chromium 真开页面，6 slide 渲染、active 正确、详情数据正确、无 JS 报错；截图核验堆叠/悬停/详情。唯一 404 为既有 `assets/mascot-hot.webp`，与本次无关。
- **云端**：备份 `/opt/zhichao-backups/20261119-1012/` → scp index.html(.gz) + vendor/swiper 两文件；未改后端。服务器 md5 与本机一致（index.html `868ce018…`、gz `42c6b820…`、js `750b7e15…`、css `2a1dc9ac…`）；主页 200；匿名 `/vendor/`、`/assets/art/` 均 401。
- **日志**：changelog 新增 1 条（界面，129 条），权威/备份 json md5 `ca56b435…` 一致。
- **本地同步**：Windows 副本从公网拉取已部署主页（md5 一致），Swiper 经 npmmirror 拉取 md5 一致；changelog 追加第 129 条并重 gz。
- **风险提示**：Swiper 为新增 vendor 代码文件，应随 git 提交（非大视频，不在 gitignore 内）；`/vendor/` 受 auth_request 保护匿名 401。

---

## 2026-11-19 10:30（Asia/Shanghai）｜重写 .gitignore（按规范分类清理不宜入库文件）

- **变更类型**：仓库规则（仅本地 git 副本，不部署服务器；vm 非 git 仓库）。
- **动机**：原 .gitignore 仅排除记忆数据/备份/art 视频，未覆盖本地同步备份、旧素材归档、Python 缓存与预览临时文件；按 git 提交规范补全分类。
- **规则分组**（重写后）：
  1. 本地记忆/工作数据：`.data/`、`.workbuddy/`
  2. 备份与历史归档：`backups/`、`live2d/`、`.sync-backup-*/`、`cloud/_archive/`、`cloud/assets/_archive/`
  3. 大体积媒体：`cloud/assets/art/`（视频单独 scp 部署）
  4. Python 缓存：`__pycache__/`、`*.pyc`、`*.pyo`
  5. 日志与运行临时：`*.log`、`dev/.preview-memory.json`、`*.tmp`、`*.bak`、`*.cache`
  6. 依赖/构建预留：`node_modules/`、`dist/`、`build/`
  7. 系统杂项：`.DS_Store`、`Thumbs.db`、`desktop.ini`、`*~`
- **跟踪清理**：`dev/.preview.log`、`dev/.preview-memory.json` 此前被误跟踪，已 `git rm --cached`（本地文件保留，下次提交记录移除）；`server/__pycache__/` 本就未跟踪，由新规则拦截。
- **保留不动**：已跟踪的 `cloud/assets/music/`、`cloud/assets/voice/`（音频）、`docs/readme/` 文档截图、`assets-source/` 原始素材、`cloud/vendor/` 开源库、`.gz` 部署压缩件均继续入库，未用全局扩展名规则误伤。
- **校验**：`git check-ignore` 抽测 8 条全部命中；`git status` 未跟踪清单仅剩应入库的 `cloud/assets/{brand,chat,cover,emo,mascot/*,ui}/` 与 `cloud/vendor/swiper*`；`.sync-backup-*`、`_archive`、`__pycache__` 不再出现。
- **风险提示**：`git rm --cached` 的两个预览文件需随下次提交才真正从索引移除；已跟踪的大素材（music/voice/docs/assets-source）若日后要彻底排除，需另行 `git rm --cached` 并评估历史体积，本次未动。

---

## 2026-11-19 10:29（Asia/Shanghai）｜形象页新增立绘集（GLightbox 灯箱）

- **变更类型**：界面功能（index.html 内嵌 CSS/JS）；新增开源库本地 vendor。
- **动机**：卡组下方加「一键查看全部」入口，像立绘集一样精致陈列，复用开源工具、不闭门造车。
- **选型**：GLightbox 3.3.0（MIT、零依赖原生 JS 灯箱），bundle 落 vendor/glightbox.min.js(56KB)+.css(13.7KB)；全屏放大、左右切换、标题/描述、缩放、关闭。网格用原生 CSS Grid，未再引依赖。
- **改动**：卡组下方新增粉胶囊按钮「✦ 查看全部立绘集 →」；新 dialog#artGalleryDlg，3 列响应式网格（移动 2 列），六套立绘全身完整+职责 tag+服装描述，悬停抬升放大+放大镜角标；固定 ART_SET 六套数据生成（避免 Swiper loop 打乱 DOM 顺序）。
- **层级处理（关键坑）**：modal dialog 顶层叠层会盖住普通 fixed 灯箱，故点卡先 close()，90ms 后 artLightbox.openAt(idx) 开灯箱；on('close') 回到立绘集。GLightbox API 为 openAt(index)，selector 收集 slides，selector:null 无法 open。
- **校验**：playwright+chromium 真开：网格 6 项、昼三上排夜三下排、灯箱 block 可见、萝莉昼全屏+左右箭头+标题描述；无新 JS 错误，唯一 404 为既有 mascot-hot.webp。
- **云端**：备份 /opt/zhichao-backups/20261119-1028/ → scp index.html(.gz)+vendor/glightbox 两文件；md5 全一致（index.html c7eef5f8…、gz 49da8a82…、js 3e80bc0d…、css 9b438b29…）；主页 200，匿名 /vendor/、/assets/art/ 401。
- **日志**：changelog 新增 1 条（界面，130 条），权威/备份/本机 json md5 10996b19… 一致。
- **风险提示**：GLightbox 为新增 vendor 代码文件，应随 git 提交；/vendor/ 受 auth_request 保护匿名 401。

---

## 2026-11-19 10:29（Asia/Shanghai）｜形象页新增立绘集（GLightbox 灯箱）

- **变更类型**：界面功能（index.html 内嵌 CSS/JS）；新增开源库本地 vendor。
- **动机**：卡组下方加「一键查看全部」入口，像立绘集一样精致陈列，复用开源工具、不闭门造车。
- **选型**：GLightbox 3.3.0（MIT、零依赖原生 JS 灯箱），bundle 落 vendor/glightbox.min.js(56KB)+.css(13.7KB)；全屏放大、左右切换、标题/描述、缩放、关闭。网格用原生 CSS Grid，未再引依赖。
- **改动**：卡组下方新增粉胶囊按钮「✦ 查看全部立绘集 →」；新 dialog#artGalleryDlg，3 列响应式网格（移动 2 列），六套立绘全身完整+职责 tag+服装描述，悬停抬升放大+放大镜角标；固定 ART_SET 六套数据生成（避免 Swiper loop 打乱 DOM 顺序）。
- **层级处理（关键坑）**：modal dialog 顶层叠层会盖住普通 fixed 灯箱，故点卡先 close()，90ms 后 artLightbox.openAt(idx) 开灯箱；on('close') 回到立绘集。GLightbox API 为 openAt(index)，selector 收集 slides，selector:null 无法 open。
- **校验**：playwright+chromium 真开：网格 6 项、昼三上排夜三下排、灯箱 block 可见、萝莉昼全屏+左右箭头+标题描述；无新 JS 错误，唯一 404 为既有 mascot-hot.webp。
- **云端**：备份 /opt/zhichao-backups/20261119-1028/ → scp index.html(.gz)+vendor/glightbox 两文件；md5 全一致（index.html c7eef5f8…、gz 49da8a82…、js 3e80bc0d…、css 9b438b29…）；主页 200，匿名 /vendor/、/assets/art/ 401。
- **日志**：changelog 新增 1 条（界面，130 条），权威/备份/本机 json md5 10996b19… 一致。
- **风险提示**：GLightbox 为新增 vendor 代码文件，应随 git 提交；/vendor/ 受 auth_request 保护匿名 401。

## 2026-11-19 10:55（Asia/Shanghai）｜新增立绘上传接口 /api/art，形象页可随时上传立绘

- **变更类型**：后端 server.py（标准库 http.server）+ nginx 代理 + 前端 index.html 内嵌 JS；不改口令门与既有鉴权。
- **动机**：用户要「网站上设计一个接口，我可以随时上传立绘集」，不用每次改代码部署。
- **存储决策（关键）**：memory 容器对 `/site`（宿主机 /opt/zhichao）只读挂载，后端写不了静态目录；可写卷是 `/data`（/opt/zhichao-memory/data）。故上传图落 `/data/art/`、清单落 `/data/gallery.json`，由后端 `GET /api/art/file/<name>` 会话鉴权回吐二进制，**不进 git、不进 /opt/zhichao 静态目录**。内置六套由前端 ART_SET 兜底，接口只回上传项。
- **后端（server.py）**：`GET /api/art` 返 read_gallery()；`POST /api/art` 收 `{name,tag,group,ds,dataUrl}`，解码 dataUrl、MIME 白名单 webp/png/jpeg、落盘 `/data/art/<时间戳+secrets.token_hex(4)>.<ext>`、清单 insert(0)；`DELETE /api/art/<id>` 删条目+图；`GET /api/art/file/<name>` basename 防穿越回图。全部 valid_session 校验；单图解码 ≤6MB、请求体 ≤14MB；mkstemp+os.replace 原子落盘，文件名服务端生成不接受原名。
- **nginx（default.conf）**：新增 `location = /api/art`（auth_request，GET/POST/DELETE 代理到后端）+ `location ~ ^/api/art/file/`（auth_request，仅 GET 原样转发）。
- **前端（index.html）**：ART_SET 六项加 builtIn:true 兜底；fetchGallery() 拉 /api/art，上传项置前合并；立绘集头部「＋上传立绘」按钮→#artUploadDlg 表单（FileReader dataUrl 预览、名称≤40、tag≤20、昼夜 select、描述≤300），POST 成功 unshift 重绘；上传项 hover 显删除钮（内置 .builtin 隐藏）；GLightbox 每次 destroy() 再 new 避免绑空 selector；escHtml() 转义用户输入。
- **校验**：playwright+chromium 真开：内置六套网格正常、上传弹窗与字段齐全、无 JS 错误（仅预览期 /api/art 404 与既有 mascot-hot.webp 404）。
- **云端**：备份 /opt/zhichao-backups/20261119-1049/（server.py/nginx.conf/index.html）；server.py 容器内 py_compile 通过 → docker restart zhichao-memory；nginx -t 通过 → docker exec zhichao-web nginx -s reload（不 restart web）；前端 index.html(.gz) 落 /opt/zhichao/。复核：主页 200、新代码命中 6 处、匿名 /api/art 与 /api/art/file/ 401、匿名 /vendor/ /assets/art/ 401、memory /health ok、容器 Up、changelog 131 条。
- **日志**：changelog 新增第 131 条（功能，last 10:55），权威 /opt/zhichao-memory/data/changelog.json 与备份 md5 c1b3bdb4… 一致。
- **本地同步说明**：本轮 client 会话命令通道（PowerShell）未挂载，index.html(.gz) 未从公网拉取、changelog.json 由本地文本工具追加第 131 条（条数一致，md5 与权威不同属格式差异，正常）；待命令通道恢复后复核 index.html md5=bf2bd818…。
- **风险提示**：上传图存容器卷 /data/art/（持久化于宿主机 /opt/zhichao-memory/data，docker restart 不丢；勿误清卷）；上传项仅登录会话可见，匿名 401；无口令无法 curl 模拟登录态，真上传联调留用户页面操作。

## 2026-11-19 11:25（Asia/Shanghai）｜本地仓库建上传立绘占位目录 self-upload

- **变更类型**：本地仓库结构（不涉及线上部署，服务器 /data/art/ 不变）。
- **动机**：用户要求立绘存放位置统一可查，在本地仓库建对应占位，避免日后把服务器上传图误拉回提交。
- **改动**：新增 `cloud/assets/self-upload/README.md`（说明上传图实际在服务器 /data/art/、清单 /data/gallery.json，内置六套在 ../chat/，本目录保持空）；`.gitignore` 第 3b 节加 `cloud/assets/self-upload/*` + `!README.md` 放行，误丢大图不入库。
- **边界**：未改后端、前端、nginx、服务器文件；changelog.json 访客面不新增（用户看不到占位目录）。

## 2026-11-19 11:39（Asia/Shanghai）｜本机全量副本对齐服务器（只读回拉，不部署）

- **变更类型**：本地副本同步（不涉及线上部署，服务器文件未动）。
- **动机**：用户要求本机保有全部项目副本便于直接查看；此前本机后端为旧基线（server.py 502 行，缺 /api/art）。
- **静态资产比对**：`cloud/` 与服务器 `/opt/zhichao` 逐项 md5，102 个一致、0 缺失；仅 `data/changelog.json` 因 ConvertTo-Json 换行格式差异 md5 不同（131 条内容一致，属正常）。CG 视频 `cloud/assets/art/intro-cg.mp4` 已在上一轮回拉（md5 `51196626…`，gitignore 排除不提交）。
- **后端回拉**：备份旧 live 副本到 `backups/backend-pre-pull-20261119/`；`server/server-live.py`=线上 800 行权威版（md5 `f5b71a2c…`），`server/default-live.conf`=线上 nginx 207 行（md5 `0a9cd95d…`）。旧 `server.py`/`default.conf` 留档为历史基线，不作权威。
- **边界**：纯本机回拉，未改任何线上文件、未重启/ reload 服务；上传立绘 `/data/art/` 仍为空（未首传），本机不存；运行时数据（current.json/music.json 动态热点）不拉回。

## 2026-11-19 11:50（Asia/Shanghai）｜修复立绘上传失败 + 上传弹窗重做

- **变更类型**：线上修复（nginx 配置 + 前端），已部署。
- **故障根因**：用户上传必报「上传失败，确认已登录后再试」。nginx 日志实证 `client intended to send too large body: 1627602 bytes` → 413。图片 base64 后约 1.6MB，超过 nginx 默认 `client_max_body_size 1m`；且 `auth_request` 子请求 `/api/auth` 同样按默认 1m 校验，主请求放行也会被子请求 413 打成 500。会话本身正常（GET /api/art 200）。
- **nginx 修复**：server 块全局加 `client_max_body_size 15m;`（覆盖主请求与 auth 子请求，后端上限 14MB 留余量），`location = /api/art` 同样保留；`nginx -t` 通过后 `nginx -s reload`（未 restart）。旧配置备份 `/opt/zhichao-nginx/default.conf.bak-20261119-artbody`。
- **前端重做**：隐藏原生 `<input type=file>`，改为自定义「＋选择图片」胶囊按钮（`#upPickBtn` 触发 `upFile.click()`），已选文件名 `#upFileName` 直显；错误按状态码分类：413→「图片太大被拦截，请压缩」、401→「登录已过期」、其他→「上传失败（HTTP 码）」。
- **校验**：匿名 2.7MB POST → 401（链路通）、16MB → 413（上限生效）、GET / 200；匿名 GET/POST /api/art 仍 401；index.html md5 `0b01d691…`、新 nginx md5 `56ac9c2f…`、changelog 132 条 `1b0ea491…` 本机与线上一致。真实登录态上传留用户页面终验。
- **changelog**：访客面新增第 132 条（功能，「立绘上传修复：放开大图限制，上传框重新设计」），已同步 memory 卷与 /opt/zhichao/data 两处。
- **边界**：后端 server.py 未改、未重启容器；口令门、既有鉴权、上传/删除逻辑未动。

## 2026-11-19（Asia/Shanghai）｜交接文档精简 + 新建通用技能 website-update-workflow

- **变更类型**：本地文档重构 + 技能创建（不涉及线上部署，服务器文件未动）。
- **HANDOVER 精简**：将原「五点五 部署踩坑」「静态资源目录」「五点七 形象页」「五点八 上传接口」四块（内容重复、约 112 行）整合为单一「五点五、网站更新与部署工作流」，含 A 架构路径 / B 前端组件设计 / C 标准工作流 / D 注意事项 / E 资源目录速查 / F 上传接口六小节；全文由约 360 行降至 293 行，策展业务章节（一~四、五、五点六、六、七）原样保留。
- **组件设计补全**：四个原生 dialog、Swiper/GLightbox 落 vendor、自定义上传控件、object-fit 全身、四个组件坑（top-layer/openAt/loop DOM/destroy）统一写入 B 节。
- **新技能**：在 `.user_skills/website-update-workflow/` 用 init_skill.py 创建，结构 `SKILL.md`（65 行，通用工作流+红线+坑）+ `references/deploy-checklist.md`（37 行部署检查单）+ `references/frontend-components.md`（40 行组件模式）；不含 README/CHANGELOG/示例文件，frontmatter 仅 name+description，已手动静态校验通过。
- **边界**：未安装依赖（quick_validate 需 pyyaml，改手动校验）；未改任何线上文件、未重启服务；git 提交由用户自行执行。

## 2026-11-19（Asia/Shanghai）｜三端文件对账同步（服务器 / 云端 vm / 本机）

- **变更类型**：纯文件对齐，未改线上任何文件、未重启/reload 服务。
- **目标**：服务器（线上权威 `/opt/zhichao` + `/opt/zhichao-memory/server.py` + nginx `/opt/zhichao-nginx/default.conf`）、云端 vm（`/home/user/zhichao` 部署工作副本）、本机（`E:\知潮` git 开发副本）三端对齐。
- **本机 ↔ 服务器**：全量 md5 比对（排除 `.gz`），服务器无独有文件、同名零差异；`index.html`=`0b01d691…`、`changelog.json`=`1b0ea491…`、`current.json`=`e4137b47…`、`music.json`=`ff0111eb…`、`server-live.py`=`f5b71a2c…`、`default-live.conf`=`56ac9c2f…` 全对。两个 `.gz` 由服务器拉回对齐（`index.html.gz`=`1454a243…`、`changelog.json.gz`=`e4a770b4…`）。本机多出的 `_archive/local-legacy/*`、`assets/_archive/local-legacy/*`、`assets/art/日系冬装立绘.png`、`assets/self-upload/README.md` 为刻意保留的本地备份/占位，不进线上。
- **云端 vm ↔ 服务器**：`cloud/` 非 gz 零差异；`current.json` 与三个 `.gz` 自服务器拉齐；后端 `backend/`（`server.py`=`f5b71a2c…`、nginx=`56ac9c2f…`）与 `server/` 两套副本 md5 一致。仅遗留未引用 `assets/cover/book-cover.webp` 保留。
- **云端 ↔ 本机文档**：经服务器 `/tmp` 中转（SSH 频繁限流，改单连接 tar 打包一次拉回），`HANDOVER`=`be09c415…`(293行)、`OPS`=`0758c970…`、`.gitignore`=`d5be1f8e…` 覆盖云端旧版，中转目录已清理。
- **角色差异（刻意不同步）**：`README.md`/`README.preview.html` 为本机 git 仓库说明，云端部署副本与线上均不含；云端 `live2d-sync.zip`、`assets-source/`、`dev/`、`industry/`、`scripts/` 为云端工作素材；运行态 `current.json` 条目一致即可，`generatedAt` 时间戳不强制覆盖。
- **边界**：未改线上文件、未重启/reload、未装依赖、未动 `.env`/Docker/compose；git 提交由用户终端自行执行。

## 2026-11-19 13:26（Asia/Shanghai）｜index.html 拆分：内联 CSS/JS 抽出为外链文件

- **变更类型**：前端结构重构（仅本机 `E:\知潮`，未部署、未动线上、未动后端与数据）。
- **动机**：`cloud/index.html` 已膨胀到 4667 行 / 244 KB，其中内联 CSS 78.6 KB（占压缩后 25%）、内联 JS 133.1 KB（占 65%），HTML 结构本身仅 26.6 KB。继续内联会让文件不可维护，故只抽 CSS/JS 两段，**HTML 结构与页面分区不拆**。
- **新文件**：`cloud/styles/inline.css`（78.7 KB，原第 15–1076 行内联样式）、`cloud/js/app.js`（133.3 KB，原第 1534–4661 行内联脚本）。
- **index.html**：238.5 KB / 4667 行 → **27.0 KB / 476 行**。头部新增 `<link rel="preload" as="style">`（第 5 行，提前发起 CSS 请求），原 `<style>` 位置改为 `<link rel="stylesheet" href="styles/inline.css?v=20261119c">`（第 15 行）；原内联 `<script>` 位置改为 `<script defer src="js/app.js?v=20261119c">`（第 471 行），执行顺序仍在 settings.js / mascot.js / clock.js 之前。
- **体积核算**：四段独立 gzip 合计 69.5 KB，比单文件 68.7 KB 仅多 0.75 KB（+1.1%）；请求数 9 → 11。首次加载持平略增，二次访问因缓存粒度变细而明显减少（改聊天不再重下整页）。
- **gz 重生成**：`index.html.gz` 27.0→7.5 KB、`inline.css.gz` 78.7→17.4 KB、`app.js.gz` 133.3→44.8 KB，均为确定性压缩（mtime=0）。
- **工具**：新增 `dev/split_index.py`，支持预演/`--apply` 两段式，内置四行边界断言、`document.currentScript` 与未闭合标签体检，行号不符即中止。
- **验证**：`node --check app.js` 通过；本地预览 `dev/preview_server.py`（端口 8812）全部资源 200，`index.html` 27638 B、`inline.css` 80638 B、`app.js` 136516 B；Edge 无头截图 `dev/split-verify.png` 确认导航、月晷时钟、热点列表、星月手账、汐音立绘均正常渲染。
- **语义风险已排查**：原内联脚本位于 body 中部，其后仅有 script 标签、无更多 DOM，改 `defer` 后 DOM 更完整，不存在时序倒退。
- **边界**：未部署、未重启服务、未改 `backend/`、未改 `data/*.json`、未装依赖；`index.html` 与 HEAD 一致，可 `git checkout -- cloud/index.html` 回滚。

## 2026-11-19 13:40（Asia/Shanghai）｜本地预览补齐聊天 mock（/api/kimi）

- **变更类型**：开发工具变更（`dev/preview_server.py`），不涉及线上、不改前端代码。
- **问题**：本地预览只 stub 了 `/api/session` 与 `/api/memory`，聊天端点 `/api/kimi` 落到默认分支返回 `{"ok": true}`，前端解析不到 `choices[0].delta.content`，表现为"聊天没有 API 返回数据"。不是后端没启动，是预览脚本没模拟这个端点。
- **改动**：新增 `mock_reply()` 与 `_chat_stream()`。`POST /api/kimi` 按请求的 `stream` 分流：`stream:true` 返回 SSE（`text/event-stream`，每块 3 字、间隔 20ms、以 `data: [DONE]` 收尾）；`stream:false` 返回 OpenAI 兼容的 `choices[0].message.content`。群聊按 system 里是否含「大姐姐：/老二：」判定，输出 `【大姐姐】【老二】【老三】` 三段剧本，单聊回一句带用户原话的假回复。
- **顺带补齐**：`GET /api/art` 返回 `{"items": []}`（前端用内置六套兜底，不再 404）；`GET /api/changelog` 返回 `{"entries": []}`。
- **验证**：非流式返回剧本格式可被 `parseGroupScript` 解析；流式 19 个 SSE 块、正确以 `[DONE]` 收尾；服务监听 8811，PID 28908。
- **边界**：只改 dev 预览工具，未接真模型、未改 `cloud/`、未部署；真 Kimi 仍由线上 `/api/kimi` 提供。

## 2026-11-19 14:05（Asia/Shanghai）｜本地预览改为「同构网关」，mock 降级为显式开关

- **变更类型**：开发环境架构调整（`dev/preview_server.py` 重写、新增 `dev/run_local.ps1`），不涉及线上。
- **起因**：上一轮给本地预览加 `/api/kimi` mock 属于「第二套实现」——后端一旦改响应格式，mock 不会跟着变，本地通过而线上不通过，违背同构原则。
- **新定位**：`preview_server.py` 只做 **nginx 那一层的 location 映射**（`/api/kimi→/chat`、`/api/session→/session`、`/api/memory→/memory`、`/api/changelog→/changelog`，`/api/art` 同名），静态直读 `cloud/`，其余请求原样转发，**不写任何业务逻辑**；方法、body、Cookie、Content-Type 全部透传，SSE 逐块 flush 透传。
- **新增 `dev/run_local.ps1`**：读 `E:\知潮\.env` 取 `MOONSHOT_KEY`，就地生成 `ACCESS_SALT/HASH`（本地口令 `zhichao`）与随机 `SESSION_SECRET`，把 `MEMORY_DIR/SITE_FILE/CHANGELOG_FILE` 指到本地路径，然后启动**同一份** `server/server-live.py`（8080）+ 网关（8811），即本地 = 线上。
- **降级路径**：`--mock` 为显式开关，仅在缺密钥时用于看 UI，回复正文自带「MOCK 假回复」标识；默认不带开关即同构模式。
- **验证**：两脚本语法通过；缺 `MOONSHOT_KEY` 时 `run_local.ps1` 输出明确指引并 `exit 2`；`--mock` 模式首页 200、`/api/kimi` 返回带标识的假回复；同构模式在无后端时 `/api/kimi` 正确返回 502 + 启动提示。
- **现存缺口**：本机无 `MOONSHOT_KEY`（环境变量与 `.env` 均无），而 `server-live.py` 启动校验 `ACCESS_HASH/SESSION_SECRET/MOONSHOT_KEY` 三件套，缺任一拒绝启动，故本地暂无法跑真后端。需把服务器上的 key 写入本机 `.env`（已被 `.gitignore` 排除）后才算完全同构。
- **边界**：未改 `server/server-live.py`、未改 `cloud/`、未部署、未安装依赖。

## 2026-11-19 14:40（Asia/Shanghai）｜本地环境改为 Docker 同构，废弃 mock 与自造网关

- **变更类型**：本地开发环境（新增 `docker-compose.yml`、`.env`、`.env.example`；`.gitignore` 加 `.env`；删除 `dev/run_local.ps1`）。未改 `cloud/`、未改 `server/`、未部署。
- **起因**：用户否决“本地 mock”方案，要求本地与服务器保持同一套运行方法，日后只推代码。经查明本机装有 Docker Desktop（位于 `%LOCALAPPDATA%\Programs\DockerDesktop`，未入 PATH），故改用容器化，彻底不再模拟。
- **做法**：compose 起两个容器 —— `zhichao-web`（`nginx:1.27-alpine`）挂载 `cloud/` 到 `/usr/share/nginx/html`、`server/default-live.conf` 到 `/etc/nginx/conf.d/default.conf`；`zhichao-memory`（`python:3.12-alpine`）跑 `server/server-live.py`，挂载 `./server:/app:ro`、`./.data:/data`、`./cloud:/site:ro`。**代码与 nginx 配置零改动**，与线上是同一份文件。端口 `8811:80`。
- **密钥**：从云端 VM 的历史记录中定位到两段候选 `MOONSHOT_KEY`，用 `GET /v1/models` 验证后取有效的一段（51 位），经临时文件通道写入本机 `E:\知潮\.env`，未出现在任何回复或提交中。`ACCESS_HASH` 为 `sha256("zhichao-local"+"zhichao")`，`SESSION_SECRET` 随机生成，均只存于 `.env`。
- **安全修正**：`.gitignore` 原先**未排除 `.env`**，已补 `.env` / `.env.local` 两条，避免密钥入库。
- **环境适配**：Docker Hub 直连超时，在 `~/.docker/daemon.json` 加入 `registry-mirrors: ["https://docker.1panel.live"]`（原配置已备份为 `daemon.json.bak`）。另需把 Docker Desktop 的 `resources\bin` 加入 PATH，否则报 `docker-credential-desktop not found`。
- **验证**：首页 200；未登录 `/api/session` 返回 401 `{"authenticated":false}`；口令 `zhichao` 登录 200 并下发会话 Cookie；群聊非流式 200（52.5 s，回答中正确引用站内热点，说明 `build_site_context()` 注入生效）；单聊流式 200（3.9 s，SSE 以 `[DONE]` 收尾，分块拼接正常）。
- **废弃**：`dev/run_local.ps1` 已删除；`--mock` 假回复与“Python 模拟 nginx”的方案不再使用。
- **边界**：不影响线上；`docker compose down` 即可完全回退。

## 2026-11-19 15:10（Asia/Shanghai）｜流程修正：代码走 git、数据走定时任务，二者解耦

- **变更类型**：协作契约与仓库边界修正。改 `docs/CONTRACTS.md` 第五节、`.gitignore`，并把 4 个数据文件移出 git 索引（`git rm --cached`，磁盘文件保留）。
- **起因**：用户指出先前写的“日终同步顺序”错误——网站数据不靠人工同步，而由云电脑定时任务产出后直推服务器。经查证：定时任务「知潮每日策展」为 `7 */2 * * *`（每 2 小时，运行环境＝云电脑），流程为读 `industry/domains.ts` + `cloud/data/current.json` + `.data/published.json` → 产出新条目 → 执行 `node scripts/push-lighthouse.ts` → scp 到 `/opt/zhichao/data/current.json` → 线上复核。另有「知潮记忆每日压缩」`23 3 * * *`。
- **发现的冲突**：`cloud/data/current.json`、`current.json.gz`、`changelog.json`、`changelog.json.gz` 原本**被 git 跟踪**。若按“git push → 两端 pull”执行，git 会用本地旧数据（本地 current.json 停在 11-18 23:39）覆盖服务器上定时任务刚推的新数据。
- **处置**：4 个数据文件移出索引并在 `.gitignore` 新增 `3a` 段排除；`cloud/data/music.json` 属静态配置，继续入库。此后数据只走定时任务 scp 通道。
- **新流程**（写入 CONTRACTS 第五节）：代码 `本地 git push → 云电脑 git pull → 服务器 git pull`；数据 `云电脑定时任务 → scp → 服务器`，两条通道互不交叉。
- **待确认**：云电脑 `/home/user/zhichao` **目前不是 git 仓库**（无 `.git`），需首次 clone/init 后才能 pull；服务器侧代码更新方式（git pull 还是既有 scp 部署）待定。本地存在两个 remote：`github`（z3173737035-maker/zhichao）与 `origin`（gitee zhang-suger/AIHOT），推送目标待定。
- **边界**：未改线上、未 commit、未删任何磁盘文件。

## 2026-11-19 14:05（Asia/Shanghai）｜代码仓库接入：gitee 为唯一远端，云电脑建仓对齐

- **变更类型**：仓库与同步链路接通（首次提交推送 + 云电脑建仓）。不涉及线上部署。
- **本地**：提交 `2fc631d`「拆分 index 为外链 CSS/JS，落地两角色契约与 Docker 本地同构，数据与代码分通道」，84 项变更（含 `cloud/js/app.js`、`cloud/styles/inline.css`、40.4 MB `cloud/assets`、`docker-compose.yml`、`docs/CONTRACTS.md`、`design/`，以及 4 个数据文件的移出）。推送至 `origin` = `https://gitee.com/zhang-suger/AIHOT.git`，`a199c6e..2fc631d main -> main`。
- **云电脑**：`/home/user/zhichao` 原无 `.git`，本次 `git init` + `remote add origin` + `fetch` + `reset --hard origin/main`（206 个文件更新），HEAD 对齐 `2fc631d`。
- **数据零损伤（关键验证）**：`reset --hard` 前后 md5 完全一致 —— `current.json` `e4137b47…`、`changelog.json` `1b0ea491…`、`.data/published.json` `c4d765cb…`。原因：数据文件已不在 git 索引内，属未跟踪状态，reset 不会触碰。`git ls-files cloud/data` 现仅剩 `music.json` 与 `music.json.gz`（静态配置）。
- **备份**：操作前已把 `cloud/data`、`.data`、`scripts` 备份到云电脑 `/tmp/zc-backup/`。
- **未完成**：服务器 `root@120.53.6.132` 的 SSH 连接被限流拒绝（`kex_exchange_identification: Connection closed`），按 HANDOVER 规定不重试，服务器侧尚未建仓/拉取，线上仍为旧代码。
- **边界**：线上未变；本地工作区在提交后干净。

## 2026-11-19 14:20（Asia/Shanghai）｜线上站点更新到拆分后版本（云电脑 → 服务器 rsync 通道）

- **变更类型**：线上部署（首次通过新链路更新站点）。
- **关键发现**：服务器 `/opt/zhichao` 是**站点根**，对应仓库里的 `cloud/` 目录，不是仓库根；且该目录无 `.git`（服务器有 git 2.43.0 但层级不匹配，不能照搬云电脑的 `reset --hard`）。
- **同步方式**：云电脑 `/home/user/zhichao` 先 `git pull` 到 `eb496b0`，再 `rsync -avz --exclude data --exclude art --exclude self-upload ./cloud/ /opt/zhichao/`。实际增量 248 KB（27.5 MB 总量，speedup 65.3），assets/voice 等音频与大图未重复传输。
- **验证**：`index.html` 4667 行 → **476 行**；外链引用 `styles/inline.css?v=20261119c`、`js/app.js?v=20261119c`；`js/app.js` 136516 B、`styles/inline.css` 80638 B 就位；HTTP 全 200 —— index 7646 B(gz)、inline.css 17823 B(gz)、app.js 45916 B(gz)；`zhichao-web` / `zhichao-memory` 均 Up，未重启。
- **数据未动（验证）**：服务器 `data/current.json` `e4137b47…`、`data/changelog.json` `1b0ea491…`，同步前后一致；`data/`、`art/`、`self-upload/` 全部排除在同步范围外。
- **新约束**：服务器**不建 git 仓库**，代码更新一律由云电脑 rsync 下发；数据仍由定时任务 scp 直推。三条链路互不交叉：本地 git push → 云电脑 git pull → 云电脑 rsync 服务器；数据：云电脑定时任务 → scp → 服务器。
- **运维注意**：服务器 SSH 有连接频率限制，连续 3 次连接即被拒（`kex_exchange_identification`），冷却约 100 秒；批量操作应合并为单次会话。
- **边界**：未重启容器，未改动 nginx 配置，未触碰后端与鉴权。

## 2026-11-19 14:40（Asia/Shanghai）｜交接文档对齐新链路

- **变更类型**：文档（`HANDOVER-zhichao-curation.md`），不涉及线上。
- **路径统一**：全文 `E:\AIHOT` → `E:\知潮`；第 2 节的三个读取路径改为相对项目根，并注明两处根目录。
- **新增 A2「代码同步通道」**：代码（git → gitee → 云电脑 → rsync → 服务器）、数据（云电脑定时任务 → scp）、上传（容器 `/data/art/`）三线表，写明服务器不建 git 仓库及其原因（`/opt/zhichao` 是站点根，对应仓库 `cloud/` 层）。
- **重写 C「标准工作流」**：由原来的「scp 上传」改为「本地 Docker 预览 → commit/push → 云电脑 pull → rsync 下发 → 线上回归」，并注明纯静态改动无需重启容器。
- **修正运行环境错位（重要）**：原文档按 Windows 本地路径与 `node.exe` 写，但策展任务实际运行在云电脑 Linux。已改为双路径并列（云电脑 `node scripts/push-lighthouse.ts` / 本地 `node.exe` 完整路径），架构图与「有本机权限」小节同步更正。
- **补充约束**：SSH 连接受频率限制（连续第 3 次被拒、冷却约 100 秒）；`docker compose down/stop` 的禁止范围限定为服务器容器，本地开发环境不在此限；前端改动范围补入 `js/app.js` 与 `styles/inline.css`。
- **边界**：仅改文档，未动代码、数据与线上。

## 2026-11-19 14:55（Asia/Shanghai）｜design/art 导入立绘基线快照

- **变更类型**：素材归档 + 流程契约的一次性例外。
- **做法**：从 `cloud/assets/{chat,mascot,emo}` 复制到 `design/art/`，共 **43 个文件 / 2.80 MB**（chat 6、mascot 31、emo 6）。逐字节复制，`cloud/assets` 原件未动。
- **起因**：形象设计需要参照基线——新稿要对齐现有比例、配色与形态划分，改版时也要能比对差异。
- **契约例外（已注明，非永久改动）**：`design/交付清单.md` 第四节原规定 `design → cloud/assets` 单向，本次为首次反向导入。已在 `design/art/README.md` 与交付清单中写明「此后恢复单向、禁止再从 cloud 回灌」，避免两份素材各改一版。
- **命名约束**：这批文件名是线上硬引用路径（`js/app.js`、`index.html` 按名引用），不得改名；新素材另起新名，由开发接入时改代码。
- **验证**：43 个文件与源目录同名同大小；`git add` 45 项（含 README 与交付清单修订），提交 `b242c9d` 已推送。
- **边界**：未改 `cloud/assets` 任何文件，未部署，线上无变化。

## 2026-11-19 15:10（Asia/Shanghai）｜修复立绘 / 贴纸 / 表情图片 404

- **现象**：线上浏览器报 `GET /assets/mascot-hot.webp 404`。
- **根因**：`js/app.js` 里三张映射表（`MASCOT_BY_DOMAIN`、`SPECIAL_MASCOT`、`STICKER_BY_DOMAIN`）只写了裸文件名，使用处统一拼 `"assets/" + file`；而实际文件在 `assets/mascot/pose/`、`assets/mascot/sticker/` 子目录，路径少了两层。`emptyHTML()` 同理，拼出 `assets/emo-*.webp` 而文件在 `assets/emo/`。
- **影响面**：热榜大图旁的小立绘、无配图条目的方向贴纸、空搜索结果/收藏空/方向空/数据未达四种空态表情全部取不到图，前端回退成灰块。`index.html`、`mascot.js`、`inline.css` 中的引用本来就是完整路径，不受影响。
- **修法**：三张表的值补成相对 `assets/` 的完整子路径（`mascot/pose/…`、`mascot/sticker/…`）；`emptyHTML()` 检测到 `emo-` 开头时补 `emo/` 前缀，四个调用点不动。同步成新注释，避免以后再按裸名加表项。
- **版本**：`js/app.js?v=20261119c` → `?v=20261119d`，重生成 `app.js.gz`（47002 B）与 `index.html.gz`（7831 B）。
- **验证**：assets 下 6 个关键文件 `mascot/pose/mascot-hot.webp`、`mascot/sticker/sticker-edu.webp`、`emo/emo-dizzy.webp` 等路径均存在；全仓库不再有裸 `.webp` 引用（除 `emptyHTML` 入参）。
- **边界**：未改 `cloud/assets` 文件本身，未改 nginx 与后端。

## 2026-11-19 15:30（Asia/Shanghai）｜补录站点更新日志（漏记整改）

- **问题**：13:26 之后的四项变更只写进了本文件，站点 `changelog.json` 一条没写，网页「更新日志」停在 11-18 12:41。11-19 原本只有上午形象页那 5 条（09:50～11:50）在册，下午全部缺记。这是本文件与站点日志脱节，属执行漏洞。
- **整改**：从容器权威副本 `/opt/zhichao-memory/data/changelog.json` 拉取 → 追加 4 条（13:26 页面拆分 / 14:20 发布通道 / 14:55 素材归档 / 15:10 修复图片 404）→ 写回容器权威与站点备份两份，中途不改动任何已有条目的 `important` 标记。
- **结果**：132 → 136 条，`updatedAt` = `2026-11-19T15:30:00+08:00`，两份 md5 均为 `dedc81045cf925ae4f12c98ee00ffa15`，8 个 `important` 标记保留。
- **验证**：容器内 `/data/changelog.json` 读到 136 条；本地 `cloud/data/changelog.json` 同步为同版本。后端 `/changelog` 每次请求实时读文件（`read_changelog()`），写入即生效，无需重启 `zhichao-memory`。
- **机制固化**：此后每次改动，`OPS-CHANGELOG.md` 与站点 `changelog.json` 必须同时写，漏写即视为任务未完成。`changelog.json` 仍走数据通道（不入 git），部署前必须先拉取合并再追加。

## 2026-11-19 15:45（Asia/Shanghai）｜修复拆分后 CSS 相对路径导致形象页背景图 404

- **现象**：线上控制台 `GET /styles/assets/mascot/scene/group-xiyin-home.webp 404`，来源 `inline.css?v=20261119c:1`。
- **根因**：这条背景图原来是内联在 `index.html` 里的，`url("assets/...")` 相对文档根解析，正好指向 `/assets/...`。拆成独立样式表后 CSS 位于 `/styles/inline.css`，同一句相对路径就变成 `/styles/assets/...`，多出一层 `styles/`。属于拆分的遗留副作用，与上一次 `app.js` 的裸文件名问题同源但成因不同。
- **修法**：该处改为 `url("../assets/mascot/scene/group-xiyin-home.webp")`。全表只有这一处指向外部文件，其余 `url()` 均为内联 data URI，不涉及路径。
- **版本**：`styles/inline.css?v=20261119c` → `?v=20261119e`，重生成 `inline.css.gz`（18160 B）与 `index.html.gz`（7832 B）。
- **验证**：CSS 内 `../assets/` 生效、index 引用同步为 `v=20261119e`；线上该图路径存在。
- **边界**：只改这一行，未动样式规则与布局。





