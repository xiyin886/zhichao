# 「知潮」每日策展任务 · 交接说明

你接手的是一个**自用**的中文热点站的内容筛选与写作工作。站点不对外运营，没有读者增长指标，唯一目标是：**让主人每天花两三分钟，就能知道他那几个关注方向上真正值得知道的事**。

请按下面的规格执行。定时任务实际运行在**云电脑**（Linux，项目根 `/home/user/zhichao`），手工维护在**本地 Windows**（`E:\知潮`），两处是同一份代码。你能访问到哪一处就按对应路径做；只能产出文本，就按「B. 无本机权限」做。

---

## 一、这是什么

站点地址 `http://120.53.6.132/`（前端口令门，**2026-11-16 起为服务器端真鉴权**：未登录访问数据/接口/立绘一律 401，不再是纯 UI 遮蔽）。架构非常简单：

```
云电脑生成 cloud/data/current.json  →  scp 到服务器 /opt/zhichao/data/current.json  →  浏览器登录后读静态文件
```

服务器上两个容器：nginx 容器托管 `/opt/zhichao/` 并通过 `auth_request` 做鉴权；`zhichao-memory` 容器（Python 标准库，配置在 `/opt/zhichao-memory/`，服务器端代码副本在本机 `server/` 目录）提供登录签发 HttpOnly 会话 Cookie、聊天记忆与 Kimi 反代。所以**你的全部产出就是一份 JSON 文件**，前端会自动渲染它（前端 `cloud/index.html`、`js/app.js`、`styles/inline.css` 都不用你改）。

## 二、你每天/每轮要做什么

### 1. 先读三样东西（不要凭记忆）

- `industry/domains.ts` → 里面的 `DOMAINS` 是**方向清单的唯一来源**（key 与 label）。方向可能被增删，不要硬编码数量。
- `cloud/data/current.json` → 现有数据，照它的字段结构写。
- `.data/published.json` → 已发过的 `urls` 与 `titles`，去重基线。

（以上路径均相对项目根：云电脑 `/home/user/zhichao`，本地 `E:\知潮`。）

### 2. 七个方向的范围（2026-11 当前状态）

| key | 名称 | 收什么 |
|---|---|---|
| `edu` | 教育 | 教育政策与招生考试制度、学校与学位、教育财政与师资；官方发布优先 |
| `it` | 信息技术 | **能提升个人效率的工具与技术**：新 AI 工具、GitHub 新开源项目、建模/3D、音乐与音频、设计/图像、视频剪辑、写作、自动化、开发效率。**不收漏洞与补丁公告、单个 CVE、融资与人事** |
| `gear` | 数码硬件 | 内存/闪存合约价与供货、SSD 与硬盘、CPU/GPU、耳机与 HiFi、新品实测与官方定档 |
| `acgn` | 影视 | 四条线并列：**日漫（日本电视动画/剧场版/漫画改编影像）、国漫（国产网络动画/动画电影）、电影（院线与流媒体）、剧集与短剧（电视剧/网剧/竖屏短剧）**的官方定档上映、播出平台与排播、主创阵容、票房与版权合作、有实质影响的行业经营事件；综艺仅在与上述作品直接相关时收录；明星私生活与绯闻、粉丝吵架站队、影评打分与观后感、无官方来源的爆料不收；**游戏归 game，不要混放**。（key 仍沿用 `acgn`，前端显示为「影视」） |
| `game` | 游戏 | 不限品类：手游、主机、PC、独立游戏、电竞；版本更新、新作定档发售、版号与监管、厂商经营 |
| `health` | 健康 | **只收能落到日常行为与习惯的内容**（睡眠、运动量、饮食结构与顺序、久坐、用眼、情绪、烟酒、防晒、体重）。**不收论文、机制研究、药品器械审批** |
| `deal` | 薅羊毛 | 生活里真实可参与的省钱与免费机会：平台赠送会员或积分、限时免费与限量低价、免单抽奖、免费餐饮、平台补贴与消费券、官方活动；凡与生活相关、可薅羊毛的都可，**不设条数上限、可多条**，但每条须真实有用、与生活相关，没有就不发。须官方或可核实、在有效期内，写清参与方式、有效期或名额、门槛 |

另有一个特殊分类 `explore`（探索）：**不是兴趣方向**，只在第 3 步的兜底逻辑里用。**只收贴近生活、有实用或情绪价值的生活向内容**：影视综艺与娱乐动态、美食、旅游、时尚穿搭、生活方式、有数据的流行文化现象；**不收航天、硬核科学、重大工程、考古等与个人生活无关的宏大议题**，也不收无来源的绯闻爆料与粉丝站队。

### 3. 每轮只做增量，宁缺毋滥

这是本任务最重要的一条。**绝大多数轮次应该什么都不发。** 判断口诀：**这条三个月后还有人要看吗？** 答不上来就不要发。

值得发（满足任一）：
- 有实质影响的正式事件：政策正式发布或生效、监管批准或撤回、重大事故、官方定档或发售、版号发放；
- 有硬数据的变化：具体涨跌幅、价格与合约、样本量与量化结果、具体售价与平台；
- 有可迁移价值的一手信息：有方法与数据的独立实测、官方完整公告、近期生效的标准；
- `it` 专用：必须**能上手用** —— 有明确用途 + 安装/使用方式（命令、插件、Action、客户端）+ 至少一项可核对的数据（跑分、耗时、体积、显存、支持格式）；
- `health` 专用：必须能给出**具体做法与量**（每周多少分钟、每天多少克、多久起身一次），并说明适用人群与边界。

一律不发：
单个漏洞与补丁公告、例行安全更新、常规小版本、预告与「敬请期待」、产品宣传与导购、融资与人事、无来源爆料、粉丝站队与剧透、纯观点、旧事重提、泛泛而谈的「多运动多喝水」、多款游戏的「本周上架推荐」这类打包清单、只列 Star 涨幅没有用法的「本周热门项目」榜。

取舍顺序：
1. **每轮七个方向全部检索**（edu、it、gear、acgn(影视)、game、health、deal 各查一次），不再只挑 2–3 个方向；
2. 有够门槛的就只发这几条；普通方向**每轮最多 2 条**，`deal` 薅羊毛**不设条数上限**（但每条须真实有用、与生活相关，不凑量）；
3. 七个方向一条都不够 → **用 explore 保底、开辟生活新领域**：七方向之外但贴近生活、确实值得看的生活向内容（影视综艺与娱乐动态、美食、旅游、时尚穿搭、生活方式、有数据的流行文化现象），最多 3 条，标准同样严；宏大硬核的航天、科学、工程、考古类一律不收；
4. 连 explore 也没有合格条目 → 才本轮不新增，只更新 `generatedAt` 后照常推送。

### 4. 检索词参考

- edu：`教育部 通知 政策`、`招生 考试 改革 官方`
- it：`GitHub 新项目 2026`、`开源 工具 发布 新版`、`AI 工具 本地 部署`、`3D 建模 开源 新版`、`音乐 分轨 开源`、`设计 工具 开源`
- gear：`DDR5 合约价`、`SSD 涨价 供货`、`新品 实测`
- acgn（日漫）：`新番 动画化 定档 官方`、`剧场版 上映 票房`
- acgn（国漫）：`国产动画 定档 开播 官方`、`动画电影 票房 上映`
- acgn（电影）：`电影 定档 上映 官方`、`院线 票房 片单`
- acgn（剧集/短剧）：`剧集 定档 开机 官方`、`短剧 上线 分账`
- game：`游戏 新作 发售 官方`、`版号 发放`、`电竞赛事 赛制`、`游戏 财报 工作室`
- health：`健康习惯 建议 指南`、`疾控 提醒 睡眠 运动 饮食`、`久坐 用眼 心理 建议`
- deal：`会员 赠送 活动`、`限时 免费 低价`、`免单 抽奖 奶茶`、`消费券 补贴 领取`
- explore：`综艺 电影 热播 票房`、`美食 探店 攻略`、`旅游 目的地 攻略`、`时尚 穿搭 流行`、`明星 官方 动态`

### 5. 来源与判重

- 优先一手：政府/主管部门官网、疾控与健促机构、期刊原文、机构通稿、厂商官方发布、官方企划页、游戏官方公告与商店页。`it` 优先项目自己的 GitHub 仓库 / Release / 官方文档。
- 转载可以用，但 `source` 里必须注明「转载」；`health` 的转载要特别小心，优先疾控、卫健部门、健促中心的原始页面。
- **同一事件的多个报道必须合并成一条**（不同站点、不同漏洞编号、不同译名都算同一事件），保留信息最全的那个 URL，并在 `reason` 里说明已合并。
- 与 `published.json` 的 `urls`/`titles` 重复的不发；与 `current.json` 已有条目属于同一事件（哪怕换了站点换了标题）也不发。
- 剔除：带货导购与 affiliate、营销软文、无出处的「研究显示」、把相关性说成因果、养生营销与保健品软文。

---

## 三、数据规格（写错会被推送脚本拒绝）

`cloud/data/current.json` 的 schema 是 `zhichao.static/v1`，结构如下：

```json
{
  "schema": "zhichao.static/v1",
  "edition": "2026-11-12",
  "generatedAt": "2026-11-12T22:24:00+08:00",
  "site": { "name": "知潮", "subject": "新知", "tagline": "……" },
  "domains": [
    { "key": "edu", "label": "教育", "color": "#8c704e" },
    { "key": "explore", "label": "探索", "color": "#647a82", "explore": true }
  ],
  "items": [ /* 见下 */ ]
}
```

`domains` 必须包含七个方向 + `explore` 这一项，**缺了要补上，不要删掉**；`color` 沿用文件里现有的值，不要自己改配色。

`site` 块（`name` / `subject` / `tagline`）是站点固定文案，**原样保留、不要改写**：`"按兴趣分方向，只留值得看的。每小时由汐音替你翻一遍，核实过来源才记进手账。"`。文案里不要出现任何工具名、模型名、脚本名或运维词汇（如 WorkBuddy、Docker、server.py、定时任务），对外一律说成「汐音翻检/整理」，保持站点的二次元氛围。

单条 `items` 的字段：

| 字段 | 规则 |
|---|---|
| `id` | `YYYYMMDD-{domain}-{n}`，同方向本轮第 n 条从 1 开始；不能与已有 id 重复 |
| `domain` | `edu` / `it` / `gear` / `acgn`（影视）/ `game` / `health` / `deal` / `explore` |
| `date` | 今天，`YYYY-MM-DD` |
| `addedAt` | **本轮所有新增条目必须用同一个值**，ISO 8601 带 `+08:00`，精确到分钟，写本轮实际执行时间。前端按它的「小时」把列表分组，跨小时会裂成两组 |
| `title` | 自足的中文标题，一眼能看懂是什么事 |
| `summary` | 一行摘要，**40 字以内**，1 句，只写「谁做了什么 + 最关键的一个事实或数字」。不写背景铺垫，不用「据悉」「近日」「引发关注」这类填充词 |
| `detail` | 详情正文，**150–250 字**（信息足够时可到 400），用空行分隔 2–3 段：①发生了什么（时间、主体、动作）②关键细节与数据 ③为什么重要、影响面、哪些结论不能推出。`it` 的第②段必须写「怎么用」+ 硬指标，第③段必须写许可证（能否商用）、硬件门槛、已知缺陷；`health` 的第②段必须写具体量与做法，第③段写适用人群与禁忌并声明不能替代就医用药 |
| `reason` | 一句话判断理由（为什么留 / 为什么压分）；未入选可写 `null` |
| `score` | `0–100` 的整数 |
| `selected` | `true` / `false`。**只有真正的重大事件才 `true`，多数轮次应为 0 条** |
| `source` | 来源名；转载要注明 |
| `publishedAt` | 原文日期 `YYYY-MM-DD`；原文没标日期就写收录日并在 `source` 里注明「页面未标发布日期」 |
| `url` | 原文链接，必须以 `http` 开头 |
| `tags` | 2–3 个短语，从下面的词表里选 |
| `image` | 可选。原文页的配图 URL，见下条规则 |

**标签词表**（尽量用这些，不要自创）：
- `it`：AI 工具、开源项目、3D/建模、音乐/音频、设计/图像、视频/剪辑、自动化、开发工具
- `game`：手游、主机/PC、独立游戏、电竞赛事、版号/监管、厂商/行业、版本更新
- `health`：睡眠、运动/活动量、饮食/营养、心理健康、久坐/用眼、指南/建议
- `deal`：会员赠送、限时低价、免单/抽奖、免费餐饮、平台补贴、优惠券
- `explore`：娱乐/影视、美食、旅游、时尚/穿搭、生活方式、文化/社会
- `edu` / `gear` / `acgn` 沿用文件里已有的同类标签

**配图规则**（`image`）：
用 `curl -sL --max-time 10 -A "Mozilla/5.0" "<原文url>" | head -c 400000` 抓 HTML，优先取 `<meta property="og:image">`，没有再取页面内第一张像文章配图的大图；补成 http(s) 绝对地址。
必须过滤：路径或文件名含 `logo`、`icon`、`avatar`、`sprite`、`favicon`、`default`、`qrcode`、`blank`、`placeholder`、`1x1` 的一律不要；小于 200px 的缩略图不要；导航图、按钮图、二维码、公众号推广图不要。
**宁可没有这个字段，也不要放一张无关的装饰图** —— 前端没图时会用该方向主色生成占位块，比放错图体面。

**真实条目示例**（照这个写法）：

```json
{
  "id": "20261112-edu-3",
  "domain": "edu",
  "date": "2026-11-12",
  "addedAt": "2026-11-12T22:24:00+08:00",
  "title": "教育部等三部门：原高校招生专项计划改为「乡村振兴专项」，2030 年高考起执行",
  "summary": "三部门印发通知，农村专项改为乡村振兴专项，2030 年高考起执行",
  "detail": "第一段写发生了什么：时间、发文主体、具体动作。\n\n第二段写关键细节与数据：适用范围、资格条件、时间节点，数字尽量写全。\n\n第三段写为什么重要、影响哪些人，以及哪些结论不能推出。",
  "reason": "正式印发的招生制度变更，涉及报考资格与录取规则，直接决定一批学生能否报考。",
  "score": 86,
  "selected": false,
  "source": "教育部",
  "publishedAt": "2026-11-11",
  "url": "https://www.moe.gov.cn/...",
  "tags": ["教育政策", "招生考试"]
}
```

**硬性要求**：`detail` 只能写检索结果里明确出现过的事实，不得推测、不得补写背景知识；`detail` 必须是 `summary` 的展开而不是改写，两者事实与数字必须一致。

**保留与清理**：所有旧条目永久保留，**不按天数删除、不设条数上限**，不得因条目较旧而移除；仅 `domain` 不在 `DOMAINS` 且不是 `explore` 的异常旧条目可删除。**旧条目的 `addedAt` 与 `image` 一律不要改**，只有新增条目才写新值。`items` 按 `addedAt` 倒序（同一时刻按 `score` 降序）。

---

## 四、怎么推送

### A. 能访问项目（云电脑或本地，推荐）

写好 `cloud/data/current.json` 后，在项目根执行：

```bash
# 云电脑（策展任务实际运行环境，Linux）
node scripts/push-lighthouse.ts

# 本地 Windows 手工推送
/d/enviorments/nvm/v24.22.1/node.exe scripts/push-lighthouse.ts
```

这个脚本会做的事：校验 JSON（schema、domains、id/url 唯一、标题摘要链接齐全、score 范围）→ 用 scp 推到服务器 `/opt/zhichao/data/current.json` → 生成预压缩副本 → 从 `http://120.53.6.132/` 读回比对 `generatedAt` → 打印线上条数。

成功输出类似：

```
校验通过：7 个方向 / 41 条 / 精选 9 条 / 2026-11-12
上传完成，已生成预压缩副本，复核线上内容…
线上复核通过：41 条 / 2026-11-12
访问地址：http://120.53.6.132/
```

本机 SSH 免密：云电脑已配好（`~/.ssh/id_ed25519` 公钥在服务器 `/root/.ssh/authorized_keys`）；本地 Windows 侧首次推送若被要求密码，属正常，不要反复重试。你不需要处理或输出任何密钥。**如果脚本报 SSH/SCP 失败，只输出一句错误说明就停，不要反复重试、不要改服务器配置。**

**鉴权上线后的复核（2026-11-16 起必读）**：`/data/` 已加 `auth_request`，脚本最后一步匿名 `curl` 读回会拿到 `HTTP 401`（`server: envoy`）并打印 `FAIL: 线上数据 HTTP 401`，但这**不代表数据失败**——此时校验、scp、预压缩通常都已成功。不要回滚鉴权配置、不要重启容器。改用 ssh 在源站直接验证：`ssh root@120.53.6.132 "python3 -c \"import json;d=json.load(open('/opt/zhichao/data/current.json'));print(len(d['items']),d['generatedAt']))\""`，并比对本机与服务器 `md5sum` 一致即可。鉴权配置 `/opt/zhichao-nginx/default.conf` 与 `zhichao-memory` 容器不在本任务范围，配置内的密钥令牌不得复述、不得外泄。

### B. 无本机权限

只产出**完整且合法的 `current.json` 全文**（或只给新增条目的 JSON 数组），并说明「本轮新增 N 条、精选 M 条、哪些与已有条重复被剔除」。由主人自己粘贴回文件并推送。

---

## 四点五、站内音乐（BGM）不会被策展脚本改动

`cloud/assets/music/*.mp3` 与清单 `cloud/data/music.json`（`schema=zhichao.music/v1`，`tracks[{id,title,subtitle,artist,file,duration,credit}]`）只服务于站点设置里的「背景音乐」，策展流程**不读、不改、不删**。加曲子的方式：把 mp3 放进 `assets/music/`，在 `tracks` 里追加一行（`id` 唯一），上线后自动出现在设置的「曲目」下拉。现役三首为 Kevin MacLeod（incompetech.com）CC BY 4.0 作品，署名保留在清单 `credit/license` 与设置面板里，换曲时不要删掉署名。

## 五、边界（不要做这些）

- 不要在未经要求时改 `cloud/index.html`（前端）；`cloud/data/changelog.json` 是更新日志，**任何变更都必须按第七部分规则追加条目**。
- 不要调用任何模型 API，不要安装依赖，不要动 `.env`、数据库、Docker、`industry/sources.json`。
- 不要执行 `docker compose down` / `docker stop`（指服务器上的容器；本地 `E:\知潮` 的 Docker 是开发环境，不在此限）。
- 不要输出任何密钥、密码、访问口令或 SSH 私钥。
- 更新日志的**权威副本在容器卷**：`/opt/zhichao-memory/data/changelog.json`（容器内 `/data/changelog.json`，唯一可写）。站点 `cloud/data/changelog.json` 与服务器 `/opt/zhichao/data/changelog.json` 是部署源/备份，**不是线上读的那份**；只改站点那份不会生效，还会在下次部署时覆盖掉网页上标好的「重要」。
- 不要为了凑量放宽门槛；**一条都没有是完全可以接受的结果**。

## 五点五、网站更新与部署工作流（每次更新网站都按此执行）

> 通用方法论已沉淀为可复用技能 `website-update-workflow`（含完整部署检查单与前端组件模式）；本节是知潮实例的具体参数与必记点。

### A. 架构与路径
- 服务器 `root@120.53.6.132`，两容器：`zhichao-web`（nginx，托管 `/opt/zhichao`，`auth_request` 鉴权）、`zhichao-memory`（Python 标准库，登录/记忆/上传/Kimi 反代）。
- 挂载：memory 容器 `/opt/zhichao→/site`（**只读**）、`/opt/zhichao-memory/data→/data`（**可写**）；nginx 配置宿主机 `/opt/zhichao-nginx/default.conf` 只读挂载进 web；后端 `/opt/zhichao-memory/server.py` 只读挂载进 memory。
- 本机权威副本：`server/server-live.py`（线上 800 行，`f5b71a2c…`）、`server/default-live.conf`（线上 207 行，`56ac9c2f…`）；旧 `server.py`/`default.conf` 仅留档、不作权威。
- 备份目录 `/opt/zhichao-backups/<stamp>/`，任何文件改前先备份。

### A2. 代码同步通道（2026-11-19 起，三条线互不交叉）

| 通道 | 内容 | 做法 |
|---|---|---|
| **代码** | `cloud/`（除下述数据文件）、`server/`、`docs/`、`design/`、`dev/` | 本地 commit → `git push origin main`（gitee `zhang-suger/AIHOT`）→ 云电脑 `/home/user/zhichao` `git pull` → 云电脑 `rsync` 下发服务器 |
| **数据** | `cloud/data/current.json`、`changelog.json` 及各自 `.gz` | 云电脑定时任务「知潮每日策展」（`7 */2 * * *`）产出 → `node scripts/push-lighthouse.ts` → scp 直推 `/opt/zhichao/data/`。**永不经过 git** |
| **上传** | 用户立绘图 | 落容器 `/data/art/`，不进 git、不进静态目录 |

- **服务器不建 git 仓库**：`/opt/zhichao` 是站点根，对应仓库里 `cloud/` 这一层，层级不匹配，只能由云电脑 rsync 下发；不要照搬云电脑那套 `reset --hard`。
- **四个数据文件已被 `.gitignore`（`3a` 段）排除**，`git pull` / `reset --hard` / `rsync`（带 `--exclude data`）都不会碰它们；`music.json` 仍入库，属静态配置。
- 云电脑与服务器上的 `data/`、`art/`、`self-upload/` 是数据真源，任何代码同步都必须显式排除。
- SSH 有频率限制，**连续第 3 次连接即被拒**（`kex_exchange_identification`），冷却约 100 秒；批量操作合并成单次会话，失败不要连着重试。

### B. 前端组件设计（主逻辑 `js/app.js`、样式 `styles/inline.css`，禁止再内联）
- 四个原生 `<dialog>`：`#artDlg`（9 秒 CG + Swiper coverflow 卡组 + 查看全部）、`#artDetailDlg`（单卡大图 + 职责 tag + 服装设定）、`#artGalleryDlg`（六套立绘网格，GLightbox 全屏）、`#artUploadDlg`（上传表单）。
- 开源库落 `vendor/` 本地、不依赖公网 CDN、随 git 提交：Swiper 11.2.6（coverflow）、GLightbox 3.3.0（灯箱）；`/vendor` 受 `auth_request` 保护，匿名 401。
- 自定义上传控件：隐藏原生 `input[type=file]`，`#upPickBtn` 触发 `click()`、`#upFileName` 显示文件名；错误按 413/401/其他分类提示。
- 立绘 `object-fit:contain` 保全身不裁（旧 `cover` 裁头顶裙摆）。
- 组件坑：① dialog 的 top-layer 盖普通 fixed 灯箱，先 `close()` 延迟 90ms 再 `openAt`，关闭回调 `showModal` 恢复；② GLightbox 用 `openAt(idx)` 非 `open`，selector 空则无 slides；③ Swiper `loop` 克隆 DOM，数据一律读固定 `ART_SET` 数组；④ 灯箱重建前先 `destroy()` 旧实例。
- **资源外链现状（2026-11-19 起）**：原内联样式 78.7 KB → `styles/inline.css`（头部 `preload` 提前请求），原内联脚本 133.3 KB → `js/app.js`（`defer` 加载，执行顺序在 `settings.js`/`mascot.js`/`clock.js` 之前）；`index.html` 由 4667 行/244 KB 降到 476 行/27 KB。**新功能一律写进独立 css/js 文件，禁止再往 `index.html` 写内联 `<style>`/`<script>`**；改动任一文件都要重生成同名 `.gz` 并递增 `?v=` 版本号。

### C. 标准工作流（闭环，2026-11-19 起改走 git）

改源（本地 `E:\知潮`）→ 本地 Docker 同构预览校验（`docker compose up -d`，地址 `http://127.0.0.1:8811`）→ 文本文件重生成同名 `.gz`（`gzip -t` 自检）→ 递增 `?v=` 版本号 → `git commit && git push origin main`（**只推代码与静态资源，`cloud/data` 下四个数据文件不进 git**）→ 云电脑 `git pull` → 云电脑 `rsync -avz --exclude data --exclude art --exclude self-upload ./cloud/ root@120.53.6.132:/opt/zhichao/` → 线上回归（首页 200、`styles/inline.css` 与 `js/app.js` 200、数据 md5 与同步前一致、匿名受保护资源仍 401）→ 写 changelog（权威在 `/data`）+ OPS-CHANGELOG。

- nginx 改则 `nginx -t` 后 reload、后端改才 restart 对应容器；纯静态改动无需重启任何容器。
- 后端 `server/server-live.py` 改动后，先用 `docker compose restart zhichao-memory` 在本地验证，通过再推 git。

### D. 注意事项（红线与坑）
- nginx 只 reload、**不 restart web**；只有改 `server.py` 才 `docker restart zhichao-memory`（会话已持久化不掉线）。禁止 `compose down/stop`、删卷、装依赖、动 `.env`/数据库。
- 缓存：html/js/css `no-cache, must-revalidate` 走 ETag；改带 `?v=` 引用的资源同步递增版本号；不要回退 `max-age`。
- `gzip_static` 发的是 `.gz`，改任何文本必须重生成同名 `.gz` 并 `gzip -t`。
- 请求体：server 块全局 `client_max_body_size 15m`（默认 1m 致 413；auth 子请求也校验 body，只在 location 设会被打成 500）。
- 正则 location 须带前缀 `^/(js|styles)/...`，裸 `~* \.(js|css)$` 会抢在 `/vendor` 前绕过 `auth_request`。
- changelog 时间用 ISO8601（`T` 分隔），权威副本 `/data/changelog.json`；部署前先拉取合并，避免覆盖网页已标的「重要」。
- SSH 限流：冷却后单连接，大文件走 base64 管道避开 ARG_MAX 与 scp 断连；远端命令用单引号防变量展开。

### E. 静态资源目录速查（`cloud/assets/`，服务器结构一致）
| 目录 | 内容 |
|---|---|
| `brand/` `cover/` | 站点图标/触屏图标；书封与卡片封面 |
| `chat/` | 六套内置立绘（三形态昼夜，随 git） |
| `emo/` `ui/` | 空态/情绪表情；门与 UI 素材 |
| `mascot/`（`pose/chibi/sticker/scene` 及根） | 分类姿态、头像小表情、贴纸、群聊场景、首屏分层 |
| `music/` `voice/` | BGM（配 `data/music.json`）与三形态配音 |
| `art/` | CG 视频 `intro-cg.mp4`，gitignore 排除、单独 scp |
| `self-upload/` | 仅 README 占位，上传图实际在服务器 `/data/art/` |
| `_archive/` | 历史备份，不参与线上引用 |

### F. 上传接口 `/api/art`
- 存储：静态目录只读，上传图落 `/data/art/`、清单落 `/data/gallery.json`，后端 `GET /api/art/file/<name>` 鉴权回吐，**不进 git、不进静态目录**；内置六套由 `ART_SET` 兜底。
- 端点：`GET /api/art` 清单；`POST /api/art`（`{name≤40,tag≤20,group:day|night,ds≤300,dataUrl}`）；`DELETE /api/art/<id>`；`GET /api/art/file/<name>`（basename 防穿越）。
- 安全：MIME 白名单 webp/png/jpeg、单图解码 ≤6MB、请求体 ≤14MB；`mkstemp`+`os.replace` 原子落盘；文件名服务端生成（时间戳+`token_hex(4)`），不接受用户原名；`escHtml()` 转义后渲染。
- 本地 `cloud/assets/self-upload/` 只放 README，gitignore 用 `self-upload/*` + `!README.md` 放行。

## 五点六、群聊模式（单人三形态 + 主人）

- 入口：聊天窗右上角 `#chatMode`，`chatMode` 存 `localStorage["zhichao_chat_mode"]`（`single` / `group`）。
- 角色映射：`GROUP_ROLES` → `mature`=大姐姐、`cute`=老二、`loli`=老三；气泡名字用 `.msg-name` 标注，三人不同颜色。
- 输出协议：`GROUP_RULES` 只在真正发言时要求「【大姐姐】/【老二】/【老三】」开头，**不要求每轮三人齐发**；`splitGroup()` 解析，流式增量渲染，`gRows` 维护行引用。**改这段提示词时不要改标记格式**，否则前端只能退化成一条整段气泡。
- 轮换控制（现为方案 B 串行接力）：`sendChat()` 群聊早退 `groupTurn()`；调度（一次调用 = 一次生产）：`produceGroupReply()` 每轮**只调一次**模型，拿回一份带 `【大姐姐】/【老二】/【老三】` 的剧本（`GROUP_RULES` + `GROUP_VOICES` 口吻指纹 + `sceneCue()` 定谁先开口/几人）；`parseGroupScript()` 切段后放进 `PollQueue`，三位消费者用 `consumeGroup()` **并行轮询**、只取自己那段，`groupSpeaking` 互斥保证冒泡顺序；`GROUP_BUDGET_MS=15000` 总预算、`GROUP_POLL_MS=150` 轮询间隔，到点或队列见底散场。**不要退回到「每位一次请求」**——那会在同一密钥上连发，触发 429。旧的 `sceneCue()` / `groupSystem()` / 单请求三段渲染（`splitGroup`+`gRows`）已停用，**不要再从这两条路径上改群聊**。
- 记忆边界（不要动）：`threads.group` 是共享层，三位单聊都会通过 `groupRecallLine()` 读到群里最近 8 句（仅作语境，不算单聊记忆）；`threads.mature/cute/loli` 是私有层，只在本人单聊可见，群聊请求绝不拼接单聊内容；`longTerm` 按主人维度共享。
- 存储（已上云）：服务端 `FORM_IDS=("mature","loli","cute","group")`，`normalize_memory()` 保留 `group` 线程，前端 `THREAD_IDS` 把群线程一起纳入拉取/回传与 `knownCounts` 计数。客户端 `pullMemoryFromServer()` 有保护：若服务器这份比本地已知的还短（旧后端丢键、或写入失败），保留本地全量并自动补传，避免"打开一次群聊就被清空"。
- 会话持久化：`_sessions` 仍驻内存，但 `/data/sessions.json` 保存 sid 与撤销名单；`valid_session()` 对"签名与到期时间合法但表里没有 sid"的 Cookie 采取接纳并补登记（`_revoked` 里的除外）。因此**重启 `zhichao-memory` 不会再把人踢下线**，logout 依旧立即失效且重启后不复活。改这一块时要一起动 `_load_sessions/_save_sessions`，别只改一半。
- 群聊共享的东西：同一线程上下文、同一份 `longTerm`、同一份手账 `visits`；开场白由 `groupGreeting()` 给三条轮播，带时间问候与打卡状态。
- 单聊与群聊互不影响：单聊仍按形态分线程，群聊独立；切回单聊会恢复翻转切换。

## 六、每轮结束时汇报（一行）

> 本轮新增 N 条（方向 / 探索，其中 M 条带配图），addedAt 为 HH:MM，线上共 X 条。无新增时写「本轮无新增 · 线上共 X 条」。

不要长篇分析，不要在汇报里复述流程。

## 七、变更日志（强制规范）

1. **任何变更都必须写日志**：代码、前端、配置、部署、定时任务、方向调整等，无论改动大小，完成后必须立即向 `cloud/data/changelog.json` 的 `entries` 追加一条，并更新顶层 `updatedAt`。**未写日志的变更视为未完成。**
2. **例外：日常热点数据的上传不写日志。** 每轮策展新增/删除具体热点条目、更新 `current.json` 数据内容、收录了哪些新闻、线上条数变化等，属于数据内容的常规流转，**不写入 changelog**。只有内容「规则与结构」层面的变更才写，例如新增或删除方向、调整收录门槛、改写方向定义、改变标签体系等。
3. 条目沿用 `zhichao.changelog/v1` 结构，四个字段：
   - `at`：变更实际完成时间，ISO8601 带 `+08:00`、精确到分钟；
   - `kind`：按性质填「安全 / 功能 / 界面 / 配置 / 内容 / 重大」；
   - `title`：一句话概括；
   - `note`：写清改了什么、为什么、影响范围，能让日后只看日志就还原变更脉络。
4. 一次变更一条；同一轮多个独立改动可分多条。禁止事后补写时凭记忆编造时间，时间以实际操作时间为准。
5. 写好后 scp 到 `/opt/zhichao-memory/data/changelog.json`（线上实际读这份）与 `/opt/zhichao/data/changelog.json`（备份），保持两份一致；站点静态 `.gz` 已不被读取，不再需要生成。
6. 每条 entry 可带 `important: true`（重要更新）；缺省即普通更新。该字段由网页上的星标按钮通过 `POST /api/changelog` 写入，**部署新日志前先拉取容器里的当前文件再合并新条目**，否则会覆盖掉已标好的重要标记。

---

> 网站更新、形象页、上传接口的完整工作流与组件设计统一见上文「五点五」；通用可复用版见技能 `website-update-workflow`。


