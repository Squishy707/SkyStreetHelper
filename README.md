# SkyStreetHelper (alpha 0.4.1)

> **Hypixel Skyblock Helper: Forge Gem-Flipping, Shard Price Tracking and Mutation Output Calculator**
> **Hypixel Skyblock 助手：宝石锻造倒卖、集市Shard询价和突变产出计算**

> 为 Hypixel SkyBlock 玩家打造的高性能、低延迟、现代化集市量化交易与profile养成追踪工具。

> 内置三大独立核心工具：**GemFlipper（宝石锻造与倒卖利润监控）**、**BazaarShardTracker（猎杀碎片集市价格与 Attribute 吸收规划）** 与 **GreenhouseTracker（温室突变农业产出与收益精算器）**。

[![Release](https://img.shields.io/badge/Release-alpha%200.4.1-blue.svg)](https://github.com/Squishy707/SkyStreetHelper/releases)
[![Python](https://img.shields.io/badge/Python-3.10%2B-green.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100%2B-teal.svg)](https://fastapi.tiangolo.com/)
[![License](https://img.shields.io/badge/License-MIT-orange.svg)](LICENSE)

---

## 🌟 核心功能一览

### 💎 工具一：GemFlipper (Forge Gem-Flipping / 宝石倒卖与锻炉利润终端)
针对 SkyBlock 锻炉（The Forge）与集市（Bazaar）宝石生态量身定制：
- **实时盘口**：BZ Api 读取 `sell_summary` 与 `buy_summary` 订单簿前排深度，还原挂单成本与秒买、秒卖利润。
- **品质换算**：支持 Rough ➔ Flawed ➔ ★Perfect 链路核算；支持自动计算配方数量、单炉耗时与每小时净利润（Coins/Hour）。
- **断供 / 断求预警**：对零挂单或流动性枯竭商品标记高亮，杜绝虚假定价误导。
- **NPC 保底回收价套利**：集市价格暴跌触发破发套利时即时提示。
- **中英文双语检索**：支持快速键入宝石英文名称（如 `flawed`, `topaz`, `apparatus`）实时过滤比价。

---

### 🔮 工具二：BazaarShardTracker (Shard Price Tracking / 猎杀碎片集市与 Attribute 规划器)
专为 October 2026 最新猎杀系统（Hunting & Shards）打造的养成与配装助手（Oct. 6th, 2026 冰洞解谜更新）：
- **325 种全 Shard 本地权威词典**：收录全稀有度碎片，包含 Attribute 词条、用途类型（Combat,..., Global 等）、Family 族群与获取途径（How to Hunt）。
- **玩家 Attribute 同步**：输入 IGN 玩家 ID（与 Profile 存档名），直连 SkyShards API 同步当前已吸收（Syphoned）层数、剩余待吃数量与 SkyBlock XP 获取进度。
- **集市最低全满成本量化**：分别计算 **Buy Order 价** 与 **Instant Buy 价**，提供清晰柱状图和热度指标。
- **紧凑视图 / 详细视图双模切换**：
  - **紧凑模式**：高密度排版，总览核心参数；
  - **详细模式**：完整展示词条效果与刷取攻略。
- **双轨数据导出**：支持导出个人 Shard 养成进度报告，或单独导出全量 Shard 词典表格。

---

### 🌱 工具三：GreenhouseTracker (Mutation Output Calculator / 温室突变农业产出与收益精算器)
专为 October 2026 最新温室（Greenhouse）突变种植系统量身打造：
- **农作物与突变产出公式**：
  - 农作物掉落：`(1 + Yield%) × Evergreen Chip (最高x1.60) × 原始农作物掉落 × [(ff/100) + 1] × 修正值 × 总突变数`
  - 突变掉落：`(1 + Yield%) × 修正值 × 总突变数`
  - 每日基础收益（核心保底）：`∑ 各作物掉落总数 × 对应原版作物官方 NPC 单价`
  - 突变集市收益：`突变总数 × Bazaar 实时市价`
- **Yield 总和配置器**：
  - 温室升级加成（最高 +20%）；
  - 独特基础作物加成（每株 +2.5%，最高 +25%，支持新 Shard 替代免种机制）；
  - 突变`Has Effect`效果 Buff（+20%、+30%、-20%、-30% 可选）；
  - 免疫效果（Immunity）保护机制：勾选免疫时负面 Debuff 自动清零。
- **突变数量与温室规模自动联动**：
  - 单温室突变变数量、温室座数快选；
  - 支持手动填写总数，自适应锁定与解锁。
- **特殊阶段倍率精准匹配**：
  - **All-in Aloe（全押芦荟）** 和 **Magic Jellybean（魔力软糖豆）** stage和倍率可选。
- **游戏背包 / Sack 层级折算展示**：
  - 自动将海量农作物掉落换算为单行表格（`T2 (Compacted/E-Block)`, `T1 (Enchanted)`, `T0 (Vanilla)`）与价值汇总；
- **39 种全温室可种植突变排布规划与比价大表**：
  - 包含底物条件、单温室上限容量、13 列原版作物拆分掉落、单株 NPC 基础收益、单温室全满总价与实时 Bazaar 价格，支持一键载入至精算器；
  - 附带离线表格 `backend/data/greenhouse_mutations.xlsx`，支持即时下载与自定义维护。

---

## 🚀 普通玩家极速上手 (无需安装 Python)

便携版：

1. 前往 GitHub 仓库右侧的 [**Releases**](https://github.com/Squishy707/SkyStreetHelper/releases) 页面；
2. 找到最新版本（如 `alpha 0.4.1`），在附件列表下载 **`SkyStreetHelper_0.4.1.exe`**；
3. 将 `.exe` 放置在任意文件夹中，**双击直接运行**；
4. 程序启动后会自动打开系统默认浏览器，访问 `http://localhost:8000` 即可开始使用；
5. **安全退出**：可在网页顶栏点击红色的 `[关闭服务]` 按钮，或在终端按 `Ctrl + C`。

---

## 💻 开发者源码运行、部署与打包指南

如果你希望克隆本项目到本地运行、部署在自己的个人主页/服务器，或自行打包 `.exe`，请按以下步骤操作：

### 1. 克隆代码仓库
```bash
git clone https://github.com/Squishy707/SkyStreetHelper.git
cd SkyStreetHelper
```

### 2. 创建并激活虚拟环境 (推荐)
```bash
# Windows PowerShell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

### 3. 安装依赖库
```bash
pip install -r requirements.txt
```

### 4. 启动本地服务
- **方式 A（Windows 一键脚本）**：直接双击运行根目录下的 `start.bat`（停止服务可双击 `stop.bat` 或点击网页右上角 `[关闭服务]`）。
- **方式 B（命令行启动）**：
  ```bash
  python run_server.py
  ```
- **方式 C（服务器 / 个人主页生产环境部署）**：
  ```bash
  uvicorn backend.app:app --host 0.0.0.0 --port 8000
  ```
  > 详细 Docker 与 Nginx 反向代理部署方案请参阅 [`WORKFLOW.md`](WORKFLOW.md)。

### 5. 自行打包独立可执行文件 (.exe)
```bash
pip install pyinstaller
python build_exe.py
```
- 打包产物将自动输出至 `dist/SkyStreetHelper_0.4.1.exe`（及带时间戳归档副本）。

---

## 📁 项目目录结构

```text
SkyStreetHelper/
├── backend/                  # 后端 FastAPI 业务核心
│   ├── app.py                # 主路由控制器 (API 端点、静态资源挂载)
│   ├── bazaar_service.py     # Hypixel Bazaar 实时盘口抓取与计算
│   ├── shard_service.py      # Shards 词典加载、SkyShards API 玩家进度同步
│   ├── greenhouse_service.py # 温室突变字典、掉落收益计算引擎
│   └── data/                 # 离线种子词典与数据表格
│       ├── shard_dictionary.xlsx     # 325 种 Shards 权威离线词典
│       ├── shard_data.json           # Shards 结构化元数据
│       ├── greenhouse_mutations.xlsx # 39 种温室突变与 14 种原版作物 NPC 价格表
│       └── greenhouse_mutations.json # 温室突变元数据与阶段倍率
├── static/                   # 前端现代化单页应用 (Vanilla JS + CSS3)
│   ├── index.html            # 主界面入口 (三工具 Tab 切换、白天/夜间主题)
│   ├── app.js                # GemFlipper 核心交互与实时重绘
│   ├── shard_tracker.js      # BazaarShardTracker 渲染与玩家档案同步
│   ├── greenhouse.js         # 温室突变收益精算器交互与大表渲染
│   └── style.css             # 响应式布局与日间/夜间样式表
├── run_server.py             # 统一启动脚本 (含 UTF-8 控制台自适应、浏览器唤起与优雅关机)
├── build_exe.py              # PyInstaller 单文件自动化打包构建脚本
├── start.bat / stop.bat      # Windows 快速启停便捷批处理 (纯 ASCII 防乱码)
├── requirements.txt          # Python 依赖清单
├── .gitignore                # Git 忽略规则 (过滤 build/dist/scratch 产物与本地缓存)
├── WORKFLOW.md               # 服务器生产环境 Docker / Nginx 部署说明
└── README.md                 # 项目使用与开发说明文档
```

---

## 📌 版本更新日志 (Changelog)

### alpha 0.4.1 (2026-10-13)
- **品牌升级**：项目正式定名为 **SkyStreetHelper**（副标题：`Hypixel Skyblock Helper: Forge Gem-Flipping, Shard Price Tracking and Mutation Output Calculator`）；
- **修复**：启动脚本优化；
- **优化**：农作物图标放大；
- **新增**：选择待测突变作物区域新增实时检索框，支持按名称、拼音与稀有度模糊过滤；
- **重构**：突变大表 13 种农作物掉落可视化。

### alpha 0.4.0 (2026-10-12)
- **新增**：全新第三大独立模块 **GreenhouseTracker（温室突变农业产出与收益精算器）** 上线；

### alpha 0.3.0 - 0.3.3 (2026-10-11)
- **新增**：全新子工具 **BazaarShardTracker** 上线，接入 SkyShards API 与 325 种猎杀碎片本地字典。
- **优化**：视觉优化。

---

## ⚠️ 免责声明 (Disclaimer)

- 本项目为开源爱好者独立开发，与 Hypixel Inc. 或 Mojang Studios 官方无任何隶属关系。
- 本项目仍在开发中，不定期更新，可能有数据异常、计算错误。
- 项目内展示的数据源分别来自于 Hypixel 公共 API (`https://api.hypixel.net`) 与社区 SkyShards API (`https://skyshards.com/api`)，数据受网络延迟或游戏内盘口突变影响，仅供参考。
- 本项目在开发过程中使用了人工智能（AI）辅助工具（如 Copilot / ChatGPT / Gemini 等）来生成部分代码、优化架构或编写文档。
