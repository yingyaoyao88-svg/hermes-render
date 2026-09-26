"""逐句合成配音，生成时间轴 build/timeline.json、整轨音频 build/voice.wav 和字幕 build/subtitles.srt。

用法: python3 tts.py [模型目录]   (默认 ./models/vits-melo-tts-zh_en)
"""
import json
import os
import re
import sys

import numpy as np
import sherpa_onnx
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "models", "vits-melo-tts-zh_en")
BUILD = os.path.join(HERE, "build")

LEAD_IN = 0.6       # 片头静音
LINE_GAP = 0.28     # 句间停顿
SCENE_GAP = 0.7     # 场景间停顿
TAIL = 1.5          # 片尾留白
SPEED = 1.08


def normalize(text):
    """把字幕文本转成适合 TTS 朗读的文本。"""
    text = re.sub(r"【[^】]*】", "", text)
    text = text.replace("——", "，").replace("“", "").replace("”", "")
    text = text.replace("WorkBuddy", "Work Buddy").replace("AI", "A I")
    text = text.replace("90%", "百分之九十").replace("+", "加")
    return text


def make_tts():
    d = MODEL_DIR.rstrip("/") + "/"
    cfg = sherpa_onnx.OfflineTtsConfig(
        model=sherpa_onnx.OfflineTtsModelConfig(
            vits=sherpa_onnx.OfflineTtsVitsModelConfig(
                model=d + "model.onnx", lexicon=d + "lexicon.txt",
                tokens=d + "tokens.txt", dict_dir=d + "dict"),
            num_threads=4),
        rule_fsts=f"{d}date.fst,{d}number.fst,{d}phone.fst,{d}new_heteronym.fst")
    return sherpa_onnx.OfflineTts(cfg)


def srt_time(t):
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02},{ms % 1000:03}"


def main():
    os.makedirs(BUILD, exist_ok=True)
    with open(os.path.join(HERE, "scenes.json"), encoding="utf-8") as f:
        doc = json.load(f)

    tts = make_tts()
    sr = None
    chunks = []
    t = 0.0

    def silence(sec):
        nonlocal t
        chunks.append(np.zeros(int(sec * sr), dtype=np.float32))
        t += sec

    srt = []
    for si, scene in enumerate(doc["scenes"]):
        scene["start"] = t
        for line in scene["lines"]:
            say = normalize(line.get("say", line["text"]))
            audio = tts.generate(say, sid=0, speed=SPEED)
            if sr is None:
                sr = audio.sample_rate
                silence(LEAD_IN)
                scene["start"] = 0.0
            samples = np.asarray(audio.samples, dtype=np.float32)
            line["start"] = t
            chunks.append(samples)
            t += len(samples) / sr
            line["end"] = t
            srt.append((line["start"], line["end"], line["text"]))
            silence(LINE_GAP)
            print(f"{line['start']:7.2f}s  {line['text']}")
        silence(SCENE_GAP if si < len(doc["scenes"]) - 1 else TAIL)
        scene["end"] = t

    doc["duration"] = t
    voice = np.concatenate(chunks)
    voice = voice / max(1e-6, np.abs(voice).max()) * 0.9
    sf.write(os.path.join(BUILD, "voice.wav"), voice, sr)
    with open(os.path.join(BUILD, "timeline.json"), "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
    with open(os.path.join(BUILD, "subtitles.srt"), "w", encoding="utf-8") as f:
        for i, (a, b, text) in enumerate(srt, 1):
            f.write(f"{i}\n{srt_time(a)} --> {srt_time(b)}\n{text}\n\n")
    print(f"总时长 {t:.1f}s")


if __name__ == "__main__":
    main()
