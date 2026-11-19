# -*- coding: utf-8 -*-
"""把 cloud/index.html 的内联 CSS / JS 抽成独立文件，并把引用改回外链。

- 只动两段：<style>…</style>（14–1077 行）、<script>…</script>（1533–4662 行）
- HTML 结构（约 26KB）保持不动，不拆页面分区
- 输出 cloud/styles/inline.css、cloud/js/app.js，并重新生成三个 .gz

用法：
    python dev/split_index.py            # 预演（只校验 + 报告，不写文件）
    python dev/split_index.py --apply    # 实际写入
"""
import gzip
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML = os.path.join(ROOT, "cloud", "index.html")
CSS_OUT = os.path.join(ROOT, "cloud", "styles", "inline.css")
JS_OUT = os.path.join(ROOT, "cloud", "js", "app.js")

VER = "20261119c"
APPLY = "--apply" in sys.argv


def gz_bytes(data: bytes) -> bytes:
    """确定性 gzip：固定 mtime=0，避免每次生成的文件哈希变化。"""
    return gzip.compress(data, 9, mtime=0)


def main() -> int:
    if not os.path.exists(HTML):
        print("找不到 %s" % HTML)
        return 1

    raw = open(HTML, "rb").read()
    # 统一按 \n 处理，保留原始行尾风格
    text = raw.decode("utf-8")
    crlf = "\r\n" in text
    lines = text.split("\n")  # 每行不带换行符

    # ---- 边界校验：任一条不符就中止，绝不盲拆 ----
    checks = [
        (13, "<style>"),
        (1076, "</style>"),
        (1532, "<script>"),
        (4661, "</script>"),
    ]
    ok = True
    for idx, want in checks:
        got = lines[idx].strip()
        flag = "OK " if got == want else "BAD"
        if got != want:
            ok = False
        print("[%s] 第 %d 行 期望 %-12s 实际 %s" % (flag, idx + 1, want, got[:60]))
    if not ok:
        print("\n边界不符，已中止（文件未改动）。")
        return 2

    # ---- 抽取 ----
    css_body = "\n".join(lines[14:1076])    # 第 15–1076 行
    js_body = "\n".join(lines[1533:4661])   # 第 1534–4661 行
    html_head = "\n".join(lines[:13])       # 第 1–13 行
    html_mid = "\n".join(lines[1077:1532])  # 第 1078–1532 行
    html_tail = "\n".join(lines[4662:])     # 第 4663 行起

    css_file = (
        "/*! 由 dev/split_index.py 从 index.html 抽出（原 15–1076 行）\n"
        " *  改动此文件 = 改动全站样式，别再往 index.html 里写内联样式。\n"
        " *  v=%s\n"
        " */\n" % VER
    ) + css_body + "\n"

    js_file = (
        "/*! 由 dev/split_index.py 从 index.html 抽出（原 1534–4661 行）\n"
        " *  改动此文件 = 改动全站主逻辑；以 defer 加载，执行顺序在 settings/mascot/clock 之前。\n"
        " *  v=%s\n"
        " */\n" % VER
    ) + js_body + "\n"

    # ---- 组装新的 index.html ----
    # 1) head 最前插 preload，让 CSS 请求提前发起（与后面的 link 同 URL，浏览器复用不重复下载）
    preload = '<link rel="preload" as="style" href="styles/inline.css?v=%s">' % VER
    link_tag = '<link rel="stylesheet" href="styles/inline.css?v=%s">' % VER
    head_lines = lines[:13]
    # 插在 <meta charset…> 之后，找不到就放 </title> 之后
    ins_at = len(head_lines)
    for i, ln in enumerate(head_lines):
        if "<meta charset" in ln:
            ins_at = i + 1
            break
    head_lines.insert(ins_at, preload)
    html_head = "\n".join(head_lines)

    new_text = "\n".join(
        [html_head, link_tag, html_mid,
         '<script defer src="js/app.js?v=%s"></script>' % VER, html_tail]
    )
    if crlf:
        new_text = new_text.replace("\n", "\r\n")

    # ---- 安全体检：确认没有把脚本割裂 ----
    problems = []
    if "</script>" in js_body.replace("</script>", ""):
        pass
    if js_body.count("<script") > 0 and js_body.count("</script") == 0:
        problems.append("抽出的 app.js 里有未闭合的 <script 字样，需人工确认")
    if "document.currentScript" in js_body:
        problems.append("app.js 里用到 document.currentScript，改用外链后语义会变，需人工确认")

    print("\n--- 预演结果 ---")
    print("内联 CSS 抽取 : %6.1f KB -> styles/inline.css" % (len(css_body.encode()) / 1024))
    print("内联 JS  抽取 : %6.1f KB -> js/app.js" % (len(js_body.encode()) / 1024))
    print("新 index.html : %6.1f KB（原 %.1f KB）"
          % (len(new_text.encode()) / 1024, len(raw) / 1024))
    print("行尾风格      : %s" % ("CRLF" if crlf else "LF"))
    print("preload 插入位置: 第 %d 行之后" % (ins_at + 1))
    if problems:
        print("\n需要人工确认：")
        for p in problems:
            print("  - " + p)

    if not APPLY:
        print("\n（预演，未写入。加 --apply 执行。）")
        return 0

    if problems:
        print("\n存在需人工确认项，已中止写入。")
        return 3

    # ---- 写入 ----
    open(CSS_OUT, "w", encoding="utf-8", newline="\n").write(css_file)
    open(JS_OUT, "w", encoding="utf-8", newline="\n").write(js_file)
    open(HTML, "w", encoding="utf-8", newline="").write(new_text)

    # ---- 重新生成 .gz ----
    for src in (HTML, CSS_OUT, JS_OUT):
        data = open(src, "rb").read()
        open(src + ".gz", "wb").write(gz_bytes(data))
        print("gz  %-38s %6.1f KB -> %5.1f KB" % (
            os.path.relpath(src, ROOT), len(data) / 1024, len(gz_bytes(data)) / 1024))

    print("\n完成。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
