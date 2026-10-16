#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把扩展打包为 dist/chatgpt-timezone-fix-<version>.zip（跨平台，仅标准库）。

只打包运行时需要的文件：
  manifest.json、_locales/、background/、src/、popup/、options/、icons/、data/
排除开发/工程文件：tools/、scripts/、docs/、.git/、*.md、node_modules 等。

用法：python scripts/package.py
"""
import json
import os
import zipfile

# 运行时必需项（顶层文件 / 目录），未列出的（tools、scripts、README.md、
# LICENSE、.git 等）一律不进入分发包。
INCLUDE = [
    "manifest.json",
    "_locales",
    "background",
    "src",
    "popup",
    "options",
    "icons",
    "data",
]

EXCLUDE_DIRS = {"tools", "scripts", "docs", "dist", ".git", "node_modules", "__pycache__"}


def collect_files(root):
    files = []
    for name in INCLUDE:
        path = os.path.join(root, name)
        if os.path.isfile(path):
            files.append(path)
        elif os.path.isdir(path):
            for dirpath, dirnames, filenames in os.walk(path):
                dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
                for fn in filenames:
                    files.append(os.path.join(dirpath, fn))
    return sorted(set(files))


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    root = os.path.normpath(os.path.join(here, ".."))
    with open(os.path.join(root, "manifest.json"), encoding="utf-8") as f:
        version = json.load(f)["version"]
    dist = os.path.join(root, "dist")
    os.makedirs(dist, exist_ok=True)
    dest = os.path.join(dist, "chatgpt-timezone-fix-%s.zip" % version)

    files = collect_files(root)
    with zipfile.ZipFile(dest, "w", zipfile.ZIP_DEFLATED) as zf:
        for path in files:
            arc = os.path.relpath(path, root).replace(os.sep, "/")
            zf.write(path, arc)

    size = os.path.getsize(dest)
    print("打包完成: %s" % dest)
    print("文件数: %d" % len(files))
    print("体积: %.1f KB (%d bytes)" % (size / 1024.0, size))
    for path in files:
        print("  + %s" % os.path.relpath(path, root).replace(os.sep, "/"))


if __name__ == "__main__":
    main()
