"""只改了画面（state / base）没改台词时，把 scenes.json 的画面状态同步进 build/timeline.json，
省去重新合成配音（tts.py）。台词（text / say）或场景、句子数量变了，必须重跑 tts.py。

用法: python3 tools/sync_states.py
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
scenes = json.load(open(os.path.join(HERE, "scenes.json"), encoding="utf-8"))
tl_path = os.path.join(HERE, "build", "timeline.json")
tl = json.load(open(tl_path, encoding="utf-8"))

for a, b in zip(tl["scenes"], scenes["scenes"]):
    if a["id"] != b["id"] or len(a["lines"]) != len(b["lines"]):
        sys.exit(f"场景 {b['id']} 的结构变了（id 或句子数量不同），请重跑 tts.py")
    for la, lb in zip(a["lines"], b["lines"]):
        if la["text"] != lb["text"] or la.get("say") != lb.get("say"):
            sys.exit(f"台词变了：{lb['text']}，请重跑 tts.py")
        la["state"] = lb.get("state", {})
    a["base"] = b.get("base", {})
    a["chapter"] = b.get("chapter", "")

json.dump(tl, open(tl_path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("已同步画面状态到", tl_path)
