// 把 cloud/data/current.json 推送到轻量应用服务器，并做线上复核。
// 用法：node scripts/push-lighthouse.ts
// 每晚增量通道：只传一个数据文件，不重新部署前端、不重启容器。
// 前置：本机 ~/.ssh/id_rsa 的公钥已在服务器 /root/.ssh/authorized_keys 中。
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { request } from "node:http";

const HOST = process.env.ZHICHAO_HOST ?? "120.53.6.132";
const USER = process.env.ZHICHAO_SSH_USER ?? "root";
const REMOTE = "/opt/zhichao/data/current.json";
const LOCAL = "cloud/data/current.json";
const SITE = `http://${HOST}/`;

function die(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

const raw = readFileSync(LOCAL, "utf8");
let data: {
  schema?: string; edition?: string; generatedAt?: string;
  domains?: { key: string }[];
  items?: { id: string; domain: string; title: string; summary: string; url: string; score: number; selected: boolean }[];
};
try { data = JSON.parse(raw); } catch { die("current.json 不是合法 JSON"); }
if (data.schema !== "zhichao.static/v1") die("schema 不符");
if (!data.domains?.length) die("缺少 domains");
if (!data.items?.length) die("items 为空，拒绝推送空刊物");
const keys = new Set(data.domains.map((d) => d.key));
if (data.items.some((i) => !keys.has(i.domain))) die("有条目 domain 不在 domains 里");
if (new Set(data.items.map((i) => i.id)).size !== data.items.length) die("id 重复");
if (new Set(data.items.map((i) => i.url)).size !== data.items.length) die("url 重复，请先合并同一事件");
if (data.items.some((i) => !i.title?.trim() || !i.summary?.trim() || !i.url?.startsWith("http"))) die("有条目缺标题/摘要/链接");
if (data.items.some((i) => typeof i.score !== "number" || i.score < 0 || i.score > 100)) die("score 必须是 0-100");
console.log(`校验通过：${data.domains.length} 个方向 / ${data.items.length} 条 / 精选 ${data.items.filter((i) => i.selected).length} 条 / ${data.edition}`);

const sshOpts = ["-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=accept-new", "-o", "ConnectTimeout=15"];
// 不经 shell 调用 ssh/scp：参数不做字符串拼接，避免路径含空格时被重新解析
const winOpts = { cwd: process.cwd(), encoding: "utf8" as const };

function ssh(cmd: string): { status: number | null; out: string } {
  const r = spawnSync("ssh", [...sshOpts, `${USER}@${HOST}`, cmd], winOpts);
  return { status: r.status, out: `${r.stderr || ""}${r.stdout || ""}`.trim() };
}

// 先删掉旧的 .gz：这期间 nginx 会回落到运行时压缩，发的仍是正确内容。
// 反过来（先传新 json 再压）会留下一个窗口，用旧 .gz 发旧内容。
const del = ssh(`rm -f ${REMOTE}.gz`);
if (del.status !== 0) die(`清理旧预压缩文件失败：${del.out.slice(-600)}`);

const r = spawnSync("scp", [...sshOpts, LOCAL, `${USER}@${HOST}:${REMOTE}`], winOpts);
if (r.status !== 0) die(`SCP 上传失败（exit ${r.status}）：\n${(r.stderr || r.stdout || "").slice(-1200)}`);

// 生成新 .gz。失败就删干净，让 gzip on 接管，绝不留一份过期的预压缩文件。
const gz = ssh(`gzip -9 -kf ${REMOTE}`);
if (gz.status !== 0) {
  ssh(`rm -f ${REMOTE}.gz`);
  console.warn(`预压缩失败，已删除 .gz，回落到运行时压缩：${gz.out.slice(-400)}`);
} else {
  console.log("上传完成，已生成预压缩副本，复核线上内容…");
}

const res = await fetch(`${SITE}data/current.json?t=${Date.now()}`, { cache: "no-store" });
if (!res.ok) die(`线上数据 HTTP ${res.status}（nginx 容器是否在运行？）`);
const online = await res.json() as { items?: unknown[]; generatedAt?: string; edition?: string };
if (!Array.isArray(online.items)) die("线上数据格式异常");
if (online.generatedAt !== data.generatedAt) die("线上仍是旧数据（可能有缓存，几分钟后重试）");
console.log(`线上复核通过：${online.items.length} 条 / ${online.edition}`);

function headHeaders(url: string): Promise<Record<string, string | string[] | undefined>> {
  return new Promise((resolve, reject) => {
    const req = request(url, { method: "HEAD", headers: { "Accept-Encoding": "gzip" } }, (res) => {
      res.resume();
      resolve(res.headers);
    });
    req.on("error", reject);
    req.end();
  });
}

try {
  const h = await headHeaders(`${SITE}data/current.json`);
  const ce = h["content-encoding"];
  if (ce === "gzip") console.log(`压缩已生效：Content-Encoding=gzip，实际传输 ${h["content-length"]} B`);
  else console.warn(`注意：响应未带 gzip（Content-Encoding=${ce ?? "无"}），请确认 nginx 配置已安装`);
} catch (e) {
  console.warn(`压缩检查跳过：${(e as Error).message}`);
}

console.log(`访问地址：${SITE}`);
