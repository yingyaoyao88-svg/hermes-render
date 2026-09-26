#!/usr/bin/env bash
# 一键构建：依赖 → 配音模型 → 配音与时间轴 → 渲染视频
set -euo pipefail
cd "$(dirname "$0")"

pip install -q -r requirements.txt
npm install --silent

MODEL=models/vits-melo-tts-zh_en
if [ ! -f "$MODEL/model.onnx" ]; then
  mkdir -p models
  curl -sSL -o models/melo.tar.bz2 \
    https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-melo-tts-zh_en.tar.bz2
  tar xjf models/melo.tar.bz2 -C models
  rm models/melo.tar.bz2
fi

python3 tts.py "$MODEL"
node render.mjs

mkdir -p output
cp build/workbuddy-ep01.mp4 build/subtitles.srt output/
echo "完成：output/workbuddy-ep01.mp4"
