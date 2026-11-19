# self-upload（页面上传立绘 · 占位说明）

本目录**只是一个占位标记**，仓库内保持为空（只保留本 README），不要把上传立绘的图片副本放进这里提交。

## 上传立绘实际存放位置（在服务器，不在本仓库）

| 内容 | 容器内路径 | 宿主机实体路径 |
|---|---|---|
| 上传图片 | `/data/art/` | `/opt/zhichao-memory/data/art/` |
| 上传清单 | `/data/gallery.json` | `/opt/zhichao-memory/data/gallery.json` |

- 形象页「＋上传立绘」POST `/api/art` 后，图片由后端落盘到 `/data/art/`，清单写入 `/data/gallery.json`。
- 图片经 `GET /api/art/file/<文件名>` 会话鉴权后回吐，**不进 git、不放在本静态目录**。
- 原因：memory 容器对静态目录 `/opt/zhichao` 是只读挂载，后端写不进去；只有可写卷 `/data` 能落盘。

## 对照：内置六套汐音立绘

在相邻的 `../chat/` 目录（随仓库提交）：`chat-xiyin-day.webp` / `chat-xiyin-day-cute.webp` / `chat-xiyin-day-girl.webp` / `chat-xiyin.webp` / `chat-xiyin-cute.webp` / `chat-xiyin-girl.webp`。

## 不要做

- 不要在此目录放任何 `.webp/.png/.jpg/.jpeg` 大图提交（.gitignore 已忽略除本 README 外的文件）。
- 不要把服务器 `/data/art/` 里的图批量拉回本地提交。
- 需要查看/管理上传图时，登录页面在形象页立绘集里操作，或 `ssh` 到服务器看 `/data/art/`。
