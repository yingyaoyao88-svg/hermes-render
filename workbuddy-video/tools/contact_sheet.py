"""把 render.mjs --stills 导出的截图拼成 2×3 的缩略图总览，方便一次检查多个镜头。

用法: python3 tools/contact_sheet.py 12 44 166 ...   （秒数，需先用 --stills 导出同样的时间点）
输出: build/sheet0.jpg, build/sheet1.jpg ...
"""
import os
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BUILD = os.path.join(HERE, "build")
times = [float(x) for x in sys.argv[1:]]
if not times:
    sys.exit("用法: python3 tools/contact_sheet.py 秒数 [秒数 ...]")

W, H = 960, 540
for gi in range(0, len(times), 6):
    sheet = Image.new("RGB", (W * 2, H * 3))
    for i, t in enumerate(times[gi:gi + 6]):
        im = Image.open(os.path.join(BUILD, "stills", f"t{t:06.1f}.png")).resize((W, H))
        ImageDraw.Draw(im).text((10, 10), f"{t:.1f}s", fill="red")
        sheet.paste(im, ((i % 2) * W, (i // 2) * H))
    out = os.path.join(BUILD, f"sheet{gi // 6}.jpg")
    sheet.save(out, quality=85)
    print(out)
