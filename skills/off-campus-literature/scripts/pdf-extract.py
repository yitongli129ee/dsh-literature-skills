#!/usr/bin/env python
"""Extract text from a PDF (default: first 30 pages) and optionally save to UTF-8.

Usage:
    python pdf-extract.py <pdf> [out.txt] [max_pages]
"""
import sys


def main():
    if len(sys.argv) < 2:
        print("usage: pdf-extract.py <pdf> [out.txt] [max_pages]")
        return 1

    try:
        from pypdf import PdfReader
    except ImportError:
        print("pypdf missing. run: pip install pypdf -i https://pypi.tuna.tsinghua.edu.cn/simple")
        return 2

    path = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] else None
    max_pages = int(sys.argv[3]) if len(sys.argv) > 3 else 30

    reader = PdfReader(path)
    n = len(reader.pages)
    parts = []
    for i in range(min(max_pages, n)):
        try:
            t = reader.pages[i].extract_text() or ""
        except Exception:
            t = ""
        parts.append(f"===== PAGE {i + 1} =====\n{t}")

    text = "\n".join(parts)
    if out:
        with open(out, "w", encoding="utf-8") as f:
            f.write(text)
        print("WROTE", out)
    else:
        print(text)

    print("PAGES_TOTAL", n, "CHARS", len(text))
    return 0


if __name__ == "__main__":
    sys.exit(main())
