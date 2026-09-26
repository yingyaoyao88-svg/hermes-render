# WorkBuddy 从零到一 · 第 1 期（知识讲解视频）

口播稿 → 配音 + 动态界面演示 + 字幕 → 1920×1080 MP4，全部由代码生成，可重复构建。

## 产出

| 文件 | 说明 |
| --- | --- |
| `output/workbuddy-ep01.mp4` | 成片（1080p / 30fps，约 3 分 53 秒，已烧录字幕） |
| `output/subtitles.srt` | 独立字幕文件，可导入剪映等二次剪辑 |

## 原理

1. **`scenes.json`：分镜脚本**。每句口播是一个 `line`，`state` 描述这句话说到时画面应该是什么样：
   - `focus`：聚光灯框住哪个界面元素；`label`：黄色标注文字
   - `zoom`：镜头推近到哪个元素、放大多少倍
   - `cursor` / `click`：鼠标移动到哪里、是否点击
   - `menu`：展开哪个下拉菜单（工作空间 / 模型 / 加号 / 更多 / 头像）
   - `type`：输入框里逐字打出的内容；`card`：全屏知识卡片
2. **`tts.py`：离线中文配音**（sherpa-onnx + MeloTTS 中英模型），逐句合成并记录起止时间，生成 `build/timeline.json`、`build/voice.wav`、`build/subtitles.srt`。
3. **`page/`：界面还原页面**。`app.js` 的 `renderAt(t)` 根据时间轴把页面画成第 t 秒的状态，所有动画都由时间计算，逐帧截图结果确定。
4. **`render.mjs`**：Playwright 逐帧截图，通过管道交给 ffmpeg，与配音合成 MP4。

## 构建

```bash
./build.sh            # 安装依赖 + 下载配音模型 + 合成配音 + 渲染视频
# 或分步：
python3 tts.py                        # 改了台词后需要重新跑
node render.mjs --stills 12,44,166    # 只导出几帧截图预览（build/stills/）
node render.mjs --from 30 --to 60     # 只渲染一段
node render.mjs                       # 渲染整片 → build/workbuddy-ep01.mp4
```

只改画面（`state`）不改台词时，不必重新合成配音，把 `scenes.json` 里的 state 同步进 `build/timeline.json` 即可；改台词需重跑 `tts.py`。

## 注意

- 画面中的 WorkBuddy 界面是**根据口播稿描述还原的示意界面**，不是官方截图（右上角有标注）。模型名称、积分倍数等细节以实际版本为准。
- 换真人配音：用自己的录音替换 `build/voice.wav`，并按录音调整 `timeline.json` 中每句的 `start` / `end`。
