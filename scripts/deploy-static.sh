#!/usr/bin/env bash
# 知潮静态站部署脚本（在云电脑 /home/user/zhichao 上执行：bash scripts/deploy-static.sh）
# 口径：仓库只存源码；.gz 是部署机上由源码派生的产物，不进 git。
# 流程：git pull → gzip -9 生成 .gz → md5 校验 → rsync 到轻量服务器 → 公网烟测
# 任一步失败即中止（set -e），不会把半成品推上线。
set -euo pipefail

REMOTE_HOST="${REMOTE_HOST:-120.53.6.132}"
REMOTE_USER="${REMOTE_USER:-root}"
REMOTE_DIR="${REMOTE_DIR:-/opt/zhichao}"
BRANCH="${BRANCH:-main}"
PUBLIC_BASE="${PUBLIC_BASE:-http://120.53.6.132}"
SITE="cloud"
DRY_RUN=0

for a in "$@"; do
  case "$a" in
    --dry-run) DRY_RUN=1 ;;
    -h|--help) sed -n '2,5p' "$0"; exit 0 ;;
    *) echo "未知参数：$a（支持 --dry-run / --help）" >&2; exit 2 ;;
  esac
done

cd "$(dirname "$0")/.."
REPO_ROOT="$(pwd)"

step() { printf '\n==> %s\n' "$*"; }

step "0/6 环境检查"
command -v gzip >/dev/null || { echo "缺少 gzip"; exit 1; }
command -v rsync >/dev/null || { echo "缺少 rsync"; exit 1; }
command -v git >/dev/null || { echo "缺少 git"; exit 1; }
echo "  仓库 $REPO_ROOT"
echo "  目标 ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}（分支 ${BRANCH}）"

step "1/6 拉取源码（只拉源码，.gz 不在仓库里）"
git fetch -q origin "$BRANCH"
git merge --ff-only "origin/$BRANCH"
git log --oneline -1

step "2/6 生成 .gz（index.html + js/*.js + styles/*.css）"
cd "$REPO_ROOT/$SITE"
mapfile -t FILES < <({ echo index.html; ls -1 js/*.js styles/*.css 2>/dev/null; })
for f in "${FILES[@]}"; do
  gzip -9 -kf "$f"
done
# 孤儿 .gz（源文件已改名/删除）只报告不删除，避免误删别人手上的东西
while IFS= read -r g; do
  [ -f "${g%.gz}" ] || echo "  提示：孤儿 .gz  ${g}（源文件已不存在）"
done < <(find js styles -maxdepth 1 -name '*.gz' 2>/dev/null | sort)

step "3/6 本地校验：.gz 解压后必须与源文件逐字节一致"
bad=0
for f in "${FILES[@]}"; do
  if [ "$(md5sum "$f" | cut -d' ' -f1)" = "$(zcat "$f.gz" | md5sum | cut -d' ' -f1)" ]; then
    printf '  OK  %-26s %7s B -> %6s B\n' "$f" "$(stat -c%s "$f")" "$(stat -c%s "$f.gz")"
  else
    printf '  BAD %-26s\n' "$f"; bad=1
  fi
done
[ "$bad" -eq 0 ] || { echo "本地 .gz 校验失败，中止部署"; exit 1; }

step "4/6 同步到服务器（data/ 与 _archive/ 不碰）"
cd "$REPO_ROOT/$SITE"
if [ "$DRY_RUN" -eq 1 ]; then
  rsync -avn --exclude 'data/' --exclude '_archive/' ./ "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/"
  echo "  dry-run：以上为将同步的文件，未实际写入"
else
  rsync -av --exclude 'data/' --exclude '_archive/' ./ "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/"
fi

step "5/6 服务器侧复核"
if [ "$DRY_RUN" -eq 1 ]; then
  echo "  dry-run：跳过"
else
  ssh -o BatchMode=yes "${REMOTE_USER}@${REMOTE_HOST}" bash -s -- "$REMOTE_DIR" <<'REMOTE'
set -u
cd "$1" || exit 1
bad=0
for f in index.html js/*.js styles/*.css; do
  [ -f "$f" ] || continue
  a=$(md5sum "$f" | cut -d' ' -f1)
  b=$(zcat "$f.gz" 2>/dev/null | md5sum | cut -d' ' -f1)
  if [ "$a" = "$b" ]; then :; else echo "  MISMATCH $f"; bad=1; fi
done
[ "$bad" -eq 0 ] && echo "  远程 .gz 与源文件全部一致" || echo "  远程存在不一致，请检查"
REMOTE
fi

step "6/6 公网烟测"
JS=$(printf '%s\n' "${FILES[@]}" | grep '^js/' | head -1 || true)
CSS=$(printf '%s\n' "${FILES[@]}" | grep '^styles/' | head -1 || true)
PATHS=("/")
[ -n "${JS:-}" ] && PATHS+=("/${JS}")
[ -n "${CSS:-}" ] && PATHS+=("/${CSS}")
for p in "${PATHS[@]}"; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "${PUBLIC_BASE}${p}" || echo 000)
  printf '  %-24s %s\n' "$p" "$code"
done
echo
echo "完成：源码来自 git，.gz 由部署机派生，仓库内无 .gz。"
