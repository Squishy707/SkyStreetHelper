# SkyStreetHelper (alpha 0.4.1)

> **Hypixel Skyblock Helper: Forge Gem-Flipping, Shard Price Tracking and Mutation Output Calculator**
>
> 一款专为 Hypixel SkyBlock 玩家打造的高性能、低延迟、现代化集市量化交易与角色养成追踪工具箱。
> 内置三大独立核心工具：**GemFlipper（宝石锻造与倒卖利润监控）**、**BazaarShardTracker（猎杀碎片集市价格与 Attribute 吸收规划）** 与 **GreenhouseTracker（温室突变农业产出与收益精算器）**。

[![Release](https://img.shields.io/badge/Release-alpha%200.4.1-blue.svg)](https://github.com/QianhyNyaU/SkyStreetHelper/releases)
[![Python](https://img.shields.io/badge/Python-3.10%2B-green.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100%2B-teal.svg)](https://fastapi.tiangolo.com/)
[![License](https://img.shields.io/badge/License-MIT-orange.svg)](LICENSE)

---

## 🌟 核心功能一览

### 💎 工具一：GemFlipper (Forge Gem-Flipping / 宝石倒卖与锻炉利润终端)
针对 Hypixel SkyBlock 锻炉（The Forge）与集市（Bazaar）宝石生态量身定制：
- **实时盘口深度驱动**：告别平滑滞后的 `quick_status`，实时读取 `sell_summary` 与 `buy_summary` 订单簿前排深度，毫秒级还原挂单成本与秒买秒卖利润。
- **严格 80:1 锻造进阶模型**：支持 Rough ➔ Flawed ➔ Fine ➔ Flawless ➔ ★Perfect 完整链路核算，自动计算单炉耗时与每小时净利润（Coins/Hour）。
- **断供 / 断求异常自动预警**：对零挂单或流动性枯竭商品标记高亮徽章，杜绝虚假定价误导。
- **NPC 保底回收价套利**：内置 12 种标准与冰川宝石 NPC 兜底回收线，当集市价格暴跌触发破发套利时即时提示。
- **全览表中英文双语检索**：支持快速键入宝石英文名称（如 `flawed`, `topaz`, `apparatus`）实时过滤比价。
- **白天 / 暗黑双主题自适应**：精心调校的轻拟物主题与快捷热键支持。

---

### 🔮 工具二：BazaarShardTracker (Shard Price Tracking / 猎杀碎片集市与 Attribute 规划器)
专为 October 2026 最新猎杀系统（Hunting & Shards）打造的养成与配装助手：
- **325 种全 Shard 本地权威词典**：完整收录 C1~C37, U1~U74, R1~R90, E1~E89, L1~L35 全稀有度碎片，包含 Attribute 词条、用途类型（Combat, Mining, Fishing, Global 等）、Family 族群与精准获取途径（How to Hunt）。
- **玩家 Attribute 菜单进度一键同步**：输入 IGN 玩家 ID（与 Profile 存档名），直连 SkyShards API 同步当前已吸收（Syphoned）层数、剩余待吃数量与 SkyBlock XP 获取进度。
- **集市最低全满成本量化**：分别计算 **Buy Order 挂单预购总价** 与 **Instant Buy 秒买总价**，提供清晰柱状图与热度指标。
- **紧凑视图 / 详细视图双模切换**：
  - **紧凑模式**：单行高密度排版，专为 1080P 电脑端优化，无横向滚动条，一屏总览数十项核心参数；
  - **详细模式**：折叠式描述文本框与获取途径图标悬停气泡，完整展示词条效果与刷取攻略。
- **双轨数据导出**：支持一键导出个人 Shard 养成进度报告，或单独导出全量 Shard 词典 Excel 表格。

---

### 🌱 工具三：GreenhouseTracker (Mutation Output Calculator / 温室突变农业产出与收益精算器)
专为 October 2026 最新温室（Greenhouse）突变种植系统量身打造：
- **严谨落地的农作物与突变产出公式**：
  - 农作物掉落：`(1 + Yield%) × Evergreen Chip (最高x1.60) × 原始农作物掉落 × [(ff/100) + 1] × 修正值 × 总突变数`
  - 突变掉落：`(1 + Yield%) × 修正值 × 总突变数`
  - 每日基础收益（核心保底）：`∑ 各作物掉落总数 × 对应原版作物官方 NPC 单价`
  - 突变集市收益：`突变总数 × Bazaar 实时市价`
- **灵活的 Yield 总和配置器**：
  - 温室升级加成（最高 +20%）；
  - 独特基础作物加成（每株 +2.5%，最高 +25%，支持新 Shard 替代免种机制）；
  - 突变自带效果 Buff（+20%、+30% 取最高值）与 Debuff（-20%、-30% 取最低值）；
  - 免疫效果（Immunity）保护机制：勾选免疫时负面 Debuff 自动清零！
- **突变数量与温室规模自动联动**：
  - 单温室突变数（提供 0, 1, 16, 46, 64, 72 理论上限, 100 常数一键套用）；
  - 温室座数（0, 1, 2, 3 座一键切换）；
  - 自动计算总突变数联动复选框：支持手动覆盖总数，自适应锁定与解锁。
- **特殊阶段倍率精准匹配**：
  - **All-in Aloe（全押芦荟）**：Stage 4 ~ 27 完整阶段与倍率表（默认 Stage 15 为 86x，实测单株约 893,850 颗各作物，自动折算完整 Aloe 与零头碎片）；
  - **Magic Jellybean（魔力软糖豆）**：Stage 12 ~ 120 阶段倍率联动；
- **游戏背包 / Sack 层级折算展示**：
  - 自动将海量农作物掉落换算为单行表格（`T2 (Compacted/E-Block)`, `T1 (Enchanted)`, `T0 (Vanilla)`）与价值汇总；
- **39 种全温室可种植突变排布规划与比价大表**：
  - 包含底物条件、单温室上限容量、13 列原版作物拆分掉落、单株 NPC 基础收益、单温室全满总价与实时 Bazaar 价格，支持一键载入至精算器；
  - 附带离线权威本地表格 `backend/data/greenhouse_mutations.xlsx`，支持即时下载与自定义维护。

---

## 🚀 普通玩家极速上手 (无需安装 Python)

如果你是普通玩家，无需配置任何编程环境，推荐直接使用预编译的独立便携版：

1. 前往 GitHub 仓库右侧的 [**Releases**](https://github.com/QianhyNyaU/SkyStreetHelper/releases) 页面；
2. 找到最新版本（如 `alpha 0.4.1`），在附件列表下载 **`SkyStreetHelper_0.4.1.exe`**；
3. 将 `.exe` 放置在任意文件夹中，**双击直接运行**；
4. 程序启动后会自动打开系统默认浏览器，访问 `http://localhost:8000` 即可开始使用；
5. **安全退出**：可在网页顶栏点击红色的 `[关闭服务]` 按钮，或在黑窗口按 `Ctrl + C`。

---

## 💻 开发者源码运行、部署与打包指南

如果你希望克隆本项目到本地运行、部署在自己的个人主页/服务器，或自行打包 `.exe`，请按以下步骤操作：

### 1. 克隆代码仓库
```bash
git clone https://github.com/QianhyNyaU/SkyStreetHelper.git
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
- **修复**：重构 `start.bat` 与 `stop.bat` 为纯 ASCII + CRLF 批处理并交由 `run_server.py` 托管 UTF-8 控制台横幅输出，彻底根治 Windows `cmd.exe` 代码页切换导致的 `'cho' 不是内部或外部命令` 等乱码报错；
- **优化**：🌻 原版农作物图标放大，配合专属色系背景胶囊，辨识度显著提升；
- **新增**：选择待测突变作物区域新增实时检索框，支持按名称、拼音与稀有度模糊过滤；
- **重构**：全突变比价大表将单一基础掉落物列拆分为 13 种农作物专属列，零掉落严格留空，支持一键点击表头排序；
- **清洗**：剔除不可种植的特殊道具项目：玫瑰龙蛋 (`ROSE_DRAGON_EGG`) 与杰瑞之种 (`JERRYFLOWER`)；
- **规范**：原版农作物产出与 Sack 背包折算重构为响应式单行数据表，规范重命名为 `T2 (Compacted/E-Block)`、`T1 (Enchanted)`、`T0 (Vanilla)`。

### alpha 0.4.0 (2026-10-12)
- **新增**：全新第三大独立模块 **GreenhouseTracker（温室突变农业产出与收益精算器）** 上线；
- **落地**：完整实现温室作物掉落、突变掉落、每日基础 NPC 现金流与集市收益严谨数学公式；
- **新增**：Yield 总和配置器（温室升级、独特作物加成、突变 Buff/Debuff、免疫清零保护）；
- **新增**：突变数量调节乘数（0, 1, 16, 46, 64, 72, 100 快速选择）与温室数量乘数（0~3座）自动联动计算；
- **新增**：All-in Aloe（Stage 4~27，默认 Stage 15 为 86x）与 Magic Jellybean（Stage 12~120）多阶段倍率选择；
- **新增**：作物掉落 Agronomy Sack 层级折算；
- **新增**：全温室突变作物规划与收益排布大表，支持一键载入精算；
- **新增**：离线 master Excel 字典 `greenhouse_mutations.xlsx`，支持界面一键下载与自定义热重载。

### alpha 0.3.3 (2026-10-12)
- **修复**：解决 `backend/shard_service.py` 缺少 `import sys` 导致的命名异常。
- **优化**：针对 1080P 显示器重构 ShardTracker 表格排版，新增独立的 `Remaining` 列。
- **更新**：更新矿业节（Mining Fiesta）24/7 常驻机制说明并修正历史时间预测组件。

### alpha 0.3.0 ~ 0.3.2 (2026-10-11)
- **新增**：全新子工具 **BazaarShardTracker** 上线，接入 SkyShards API 与 325 种猎杀碎片本地字典。

---

## ⚠️ 免责声明 (Disclaimer)

- 本项目为开源爱好者独立开发，与 Hypixel Inc. 或 Mojang Studios 官方无任何隶属关系。
- 项目内展示的数据源分别来自于 Hypixel 公共 API (`https://api.hypixel.net`) 与社区 SkyShards API (`https://skyshards.com/api`)，数据受网络延迟或游戏内盘口突变影响，仅供参考。
