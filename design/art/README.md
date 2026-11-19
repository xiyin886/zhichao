# 立绘现状快照（基线）

> 2026-11-19 一次性导入。来源 `cloud/assets/{chat,mascot,emo}`，共 **43 个文件 / 2.80 MB**。

## 这批文件是什么

线上站点**当前正在使用**的立绘与形象素材的副本，作为形象设计的参照基线：新稿要能对齐现有比例、配色和形态划分，改版时也能直接比对差异。

## 与发布产物的关系（重要）

《交付清单》第四节规定 `design → cloud/assets` 单向流动。这次是**唯一一次反向导入**，目的是建立基线：

- 本目录此后的改动 = 新设计稿，按单向流程发布到 `cloud/assets/`；
- **不允许再从 `cloud/assets/` 回灌到本目录**，否则两边会各改一份、越走越远；
- 若确认线上有本目录没有的新素材，走一次性的补录流程并在本节记下日期，不做日常同步。

## 分组说明

| 目录 | 文件数 | 内容与用途 |
|---|---|---|
| `chat/` | 6 | 聊天窗立绘：三形态（御姐 / 少女 / 萝莉）× 昼夜，`chat-xiyin*.webp` |
| `mascot/layer-*` | 3 | 首屏分层拼装：后发、身体（日间 / 夜间各一） |
| `mascot/chibi/` | 6 | Q 版：三形态哭泣差分、打招呼、躺平、爱心（爱心为 PNG 透明底） |
| `mascot/pose/` | 13 | 方向姿态：edu / it / gear / acgn / game / health / deal / explore，另有 hot、featured、favorite、night 与默认姿态 |
| `mascot/sticker/` | 8 | 方向贴纸，与 pose 一一对应 |
| `mascot/scene/` | 1 | 群聊场景图 16:9 |
| `emo/` | 6 | 情绪表情：blank、cheer、dizzy、hope、sad、sleepy |

## 命名沿用现状

这批文件是线上路径，**不要改名**：`js/app.js` 与 `index.html` 按文件名硬引用，改名等于线上 404。新素材请另起新名，由开发在改代码时接入。

## 体积

2.80 MB，其中 `mascot/scene/group-xiyin-home.webp`（277 KB）、`mascot/chibi/chibi-love.png`（256 KB）、`chat/chat-xiyin-day-girl.webp`（136 KB）三张占了大头。
