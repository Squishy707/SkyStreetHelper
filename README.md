# SkyStreetHelper (alpha 0.5.1)

> 🪦 **Rest in peace, farmers!**  
> **再见了，所有的农批。**  
> *(致敬在 2026-10-30 与 2026-11-03 连续两次测试服 NPC 收购底价断崖大砍中灰飞烟灭的农业时代。被动收割已死，害虫捕猎当立；悲报已至，集市踩踏，唯有量化套利永存。)*

> **Hypixel Skyblock Helper: Forge Gem-Flipping, Shard Price Tracking, Greenhouse Mutations, Crop Dump Arbitrage and Order Radar**
> **Hypixel Skyblock 助手：宝石锻造倒卖、集市Shard询价、温室突变精算、农作物破发套利与集市挂单盯盘雷达**

> 为 Hypixel SkyBlock 玩家打造的高性能、低延迟、现代化集市量化交易与 Profile 养成追踪工具。

> 五大独立工具：**GemFlipper（宝石锻造与倒卖利润监控）**、**BazaarShardTracker（Shard碎片集市价格与 Attribute 吸收规划）**、**GreenhouseTracker（温室突变农业产出与收益精算器）**、**CropArbitrage（农作物集市倾销与破发套利雷达）** 与 **OrderTracker（集市挂单雷达与实时盯盘监控系统）**。

> [!IMPORTANT]
> **Language & Localization Notice / 界面语言与检索说明**
> - **中文**：Hypixel SkyBlock 游戏物品数据以英文为标准基准。本项目用户界面（User Interface, UI）采用中文呈现，**全面支持直接键入英文游戏原名进行检索与查询**，但目前**暂无开发全英文界面的计划**。
> - **English**: While Hypixel SkyBlock content is natively in English—and this tool **fully supports searching items using their official English in-game names**—the user interface (UI) is designed exclusively in **Simplified Chinese**. There are currently **no plans** to support an English UI localization.


[![Release](https://img.shields.io/badge/Release-alpha%200.5.1-blue.svg)](https://github.com/Squishy707/SkyStreetHelper/releases)
[![Python](https://img.shields.io/badge/Python-3.10%2B-green.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100%2B-teal.svg)](https://fastapi.tiangolo.com/)
[![License](https://img.shields.io/badge/License-MIT-orange.svg)](LICENSE)

---

## 🌟 核心功能

### 💎 工具一：GemFlipper (Forge Gem-Flipping / 宝石倒卖与锻炉利润查询)
针对 SkyBlock 锻炉（The Forge）与集市（Bazaar）宝石定制：
- **实时盘口**：BZ API 读取 `sell_summary` 与 `buy_summary` 订单，还原挂单成本与秒买、秒卖利润。
- **品质换算**：支持 Rough ➔ Flawed ➔ ★Perfect 链路核算；支持自动计算配方数量、单炉耗时与每小时净利润（Coins/Hour）。
- **断供 / 断求预警**：对零挂单或流动性枯竭商品标记高亮。
- **NPC 保底回收价套利**：集市价格暴跌触发破发套利时即时提示。
- **中英文双语检索**：支持快速键入宝石英文名称过滤。

---

### 🔮 工具二：BazaarShardTracker (Shard Price Tracking / 猎杀碎片集市与 Attribute 规划器)
为猎杀系统（Hunting & Shards）打造的养成与配装助手（Oct. 6th, 2026 冰洞解谜更新）：
- **325 种全 Shard 词典**：收录全稀有度碎片，包含 Attribute 词条、用途类型、Family 族群与获取途径（How to Hunt）。
- **玩家 Attribute 同步**：输入 IGN，直连 SkyShards API 同步当前已吸收（Syphoned）层数、剩余待吃数量与 SkyBlock XP 获取进度。
- **拉满成本量化**：分别计算 **Buy Order 价** 与 **Instant Buy 价**，提供清晰柱状图和热度指标。
- **紧凑视图 / 详细视图双模切换**：
  - **紧凑模式**：高密度排版，总览核心参数；
  - **详细模式**：完整展示词条效果与刷取攻略。
- **数据导出**：导出个人 Shard 养成进度报告，或导出 Shard 词典表格。

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
  - 突变 `Has Effect` 效果 Buff（+20%、+30%、-20%、-30% 可选）；
  - 免疫效果（Immunity）保护机制：勾选免疫时负面 Debuff 自动清零。
- **突变数量与温室规模自动联动**：
  - 单温室突变数量、温室座数快选；
  - 支持手动填写总数，自适应锁定与解锁。
- **特殊阶段倍率精准匹配**：
  - **All-in Aloe（全押芦荟）** 和 **Magic Jellybean（魔力软糖豆）** Stage 和倍率可选。
- **游戏背包 / Sack 层级折算展示**：
  - 农作物数量换算（`T2 (Compacted/E-Block)`, `T1 (Enchanted)`, `T0 (Vanilla)`）与价值汇总；
- **39 种全温室可种植突变排布规划与比价大表**：
  - 包含底物条件、单温室上限容量、13 列原版作物拆分掉落、单株 NPC 基础收益、单温室全满总价与实时 Bazaar 价格，支持一键载入至精算器；
  - 附带离线表格 `backend/data/greenhouse_mutations.xlsx`，支持即时下载与自定义维护。

---

### 🌾 工具四：CropArbitrage (Crop Dump Arbitrage / 农作物集市倾销与破发套利雷达)
专为测试服经济平衡草案（2026-10-30 Testing #1 & 2026-11-03 Testing #2 二次追加大砍）与全服集市踩踏抛售打造的零风险量化套利终端：
- **45 种全级作物与衍生标的**：全面覆盖 15 种原版农作物（T0 Standard / 标准）、15 种附魔形态（T1 Enchanted / 附魔）与 15 种紧实形态（T2 Compacted / 紧实）。
- **多版本双基准套利核算**：
  - **正式服现价 Live NPC（实时无风险变现窗口）**：由于目前测试服削弱尚未实装正式服，系统以正式服原始高额收购价为准，即买即转赚取确定性利差；
  - **测试服新价 Nerfed NPC（终极安全垫）**：实时以 11.03 Testing #2 二次追加大砍（西瓜降至 0.5C、南瓜 3C、仙人掌/胡萝卜/土豆 1.5C 等，总跌幅 50%~75%）测算最严苛穿仓底线与安全垫。
- **多渠道采购与销售策略**：
  - 买入：集市预购（Buy Order）、即时秒买（Insta-Buy），对 T2 作物独家提供购入 T1 手动合成成本（160:1 折算）与立省差价对比；
  - 卖出：转手 NPC 现行收购、NPC 削弱后新价、集市秒卖（Insta-Sell）、集市挂单（Sell Offer）。
- **硬性上限额度考量**：整合 NPC 每日出货限额（NPC Daily Limit）与玩家集市每日流水上限（如 15.00 B），自动推算满额净利润与流水消耗占比。
- **单车搬砖精算器**：内置常用容量预设（1 背包 2,240 件 / 1 大号 Sack 20,000 件等），一键推算搬砖本金与净回款。
- **全要素组合过滤与导出**：支持农作物种类与 T0/T1/T2 形态等级多选复选，支持一键导出 CSV 实时大表。

---

### 🎯 工具五：OrderTracker (Bazaar Order Tracker & Radar / 集市挂单雷达与实时盯盘监控系统)
深度解决 Hypixel 集市挂单被恶意竞价（Outbid）与成交状态无法感知的痛点，实现秒级盯盘：
- **实时队列排位与压单量（Queue Ranking & Ahead Volume）**：直观展示目标挂单在前 30 档中的顺位（#1 ~ #30），精确统计排在自己前方的压单总量与挂单数。
- **榜首最优竞价与加价夺回建议（+0.1 Reclaim Price）**：实时计算与榜首最优价差额，智能给出加价/降价夺回榜首的建议价格，并支持一键复制到剪贴板。
- **精细化脱离盘口与撤单判定（Order Book Clearance Logic）**：
  - **倾销砸盘穿透**：榜首价跌穿目标价时，判定为大单倾销瞬间吞并，100% 完全成交；
  - **队首自然撮合**：在队首顺位（#1）脱离盘口时，判定为散户小额交易消化完毕，100% 完全成交；
  - **非队首主动撤单**：在非队首（#2+）顺位且前方高价单仍在时脱离盘口，精准识别为用户主动撤单；
  - **深度脱离盘口**：被 30 档以上的新增挂单挤出视窗时发出深度压盘提醒。
- **成交推进与交易类型识别**：动态感知档位剩余量，智能区分「倾销大单扫盘」与「散户自然撮合」。
- **多维立体警报**：集成 Web Audio API 纯合成警报音效、浏览器原生桌面通知（Notification）与网页标题交替闪烁。
- **盘口深度可视化弹窗（Live Depth Book Visualizer）**：一键调出目标标的前 20 档买卖单深度分布柱状图，高亮显示个人挂单位置。
- **全局悬浮雷达胶囊（Floating Radar Dock）**：常驻屏幕右下角，跨 Tab 全局监控挂单被超越与完成动态。

---

## 🚀 快速开始

便携版（无需安装 Python）：

1. 前往 GitHub 仓库右侧的 [**Releases**](https://github.com/Squishy707/SkyStreetHelper/releases) 页面；
2. 找到最新版本（`alpha 0.5.1`），在附件列表下载 **`SkyStreetHelper_0.5.1.exe`**；
3. 将 `.exe` 放置在任意文件夹中，**双击直接运行**；
4. 程序启动后会自动打开系统默认浏览器，访问 `http://localhost:8000` 即可开始使用；
5. **安全退出**：可在网页顶栏点击红色的 `[关闭服务]` 按钮，或在终端按 `Ctrl + C`。

---

## 💻 开发者指南

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
- 打包产物将自动输出至 `dist/SkyStreetHelper_0.5.1.exe`（及带时间戳归档副本）。

---

## 📁 项目目录结构

```text
SkyStreetHelper/
├── backend/                  # 后端 FastAPI 业务核心
│   ├── app.py                # 主路由控制器 (API 端点、静态资源挂载)
│   ├── bazaar_service.py     # Hypixel Bazaar 实时盘口抓取与计算
│   ├── shard_service.py      # Shards 词典加载、SkyShards API 玩家进度同步
│   ├── greenhouse_service.py # 温室突变字典、掉落收益计算引擎
│   ├── crop_arbitrage_service.py # 农作物集市倾销与破发套利引擎
│   ├── tracker_service.py    # 集市挂单深度、脱离盘口与成交侦测引擎
│   └── data/                 # 离线种子词典与数据表格
│       ├── shard_dictionary.csv      # 325 种 Shards 权威离线词典
│       ├── shard_data.json           # Shards 结构化元数据
│       ├── greenhouse_mutations.csv  # 39 种温室突变与 14 种原版作物 NPC 价格表
│       └── greenhouse_mutations.json # 温室突变元数据与阶段倍率
├── static/                   # 前端现代化单页应用 (Vanilla JS + CSS3)
│   ├── index.html            # 主界面入口 (五大工具 Tab 切换、白天/夜间主题)
│   ├── app.js                # GemFlipper 核心交互与实时重绘
│   ├── shard_tracker.js      # BazaarShardTracker 渲染与玩家档案同步
│   ├── greenhouse.js         # 温室突变收益精算器交互与大表渲染
│   ├── crop_arbitrage.js     # 农作物倾销套利雷达核心交互与模拟器
│   ├── order_tracker.js      # 集市挂单雷达、音效警报与盘口深度渲染
│   └── style.css             # 响应式布局与日间/夜间高对比度样式表
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

### alpha 0.5.1 (2026-11-04)
- **农业二次大砍深度追踪（November 3 Alpha Testing #2 接入）**：
  - **连续削弱追踪**：接入官方 2026-11-03 发布的第二版测试草案（Testing #2），西瓜腰斩至 0.5C、南瓜压降至 3.0C、仙人掌/胡萝卜/土豆/甘蔗/下界疣统一压降至 1.5C、可可豆降至 1.0C、蘑菇 3.5C，累计跌幅扩大至 50%~75%；
  - **正式服原价基准保护**：由于官方尚未实装两次大砍中的任何一次，系统坚守正式服现行高额回收价计算无风险即时变现利润；
  - **终极穿仓底线（Safe Floor）与双重安全垫**：大表第 6 列全线接入 Testing #2 最严苛底价作为风控基准，精准识别跌破新底价的「双重绝对防穿仓品种」；
  - **大砍演进全景弹窗（Crop Nerf Modal）**：全新上线 15 大农作物从「正式服现行原价」➔「10.30 初版测试」➔「11.03 二次大砍」的三阶段价格演进大表，并附官方双贴直达按钮。
- **全站视觉体验深度重构（黑曜石量化终端 Scheme A & 浅色模式全覆写）**：
  - **金融级等宽排版**：全量启用 `tabular-nums` 与 JetBrains Mono 风格等宽数字栈，彻底解决财务数据列对齐抖动；
  - **浅色模式（Light Mode）全白底无缝覆写**：全面修正暗黑 Token 在浅色模式下的残留，彻底消除「黑底黑字不可见」与色块割裂问题；
  - **选项卡与徽标修复**：清除导航 Tab 中的重复 Emoji 麦穗，重塑激活态高反差琥珀徽章，达到 WCAG AA 级无障碍阅读标准；
  - **农作物品阶微徽标系统（Micro Corner Badge）**：
    - T0（标准 / Standard）：100% 还原基础作物鲜艳生动色彩，仅边框采用低调中性浅灰，彻底移除灰度滤镜；
    - T1（附魔 / Enchanted）：右上角锚定迷你附魔星芒微徽标（`✨`）与翡翠荧光框；
    - T2（紧实 / Compacted）：右上角锚定迷你致密方块微徽标（`📦`）与蓝晶高阶框；
    - 根除多 Emoji 拼接造成的容器横向溢出与裁剪换行 bug。
- **325 种 Attribute Shard 数据全面对齐与维护**：
  - 同步权威社区 SkyShards.com 最新数据：移除废弃词条（L61 Burningsoul、E53 Folf、U107 Chocobun 及重复 R72 Flora）；
  - 补充新词条（C48 Rabbit Youth、U73 Fiesta Fortune、R28 Catacombs Cap、L52 Flora）；
  - 将 E48 Inferno Demonlord 准确映射至集市代码 `SHARD_BURNINGSOUL`。
- **界面语言与检索说明醒目化**：
  - 在 README 顶部规范嵌入 GitHub GFM `> [!IMPORTANT]` 原生警示框，提供规范地道的中英双语界面与物品名称检索指引。

### alpha 0.5.0 (2026-10-31)
- **全新模块上线：农作物集市倾销与破发套利雷达（CropArbitrage）**：
  - **背景响应**：针对 2026-10-29/30 Hypixel 测试服发布的农作物 NPC 卖价大削弱开发者公告（小麦 6➔2.5C、土豆/胡萝卜 3➔2C、南瓜 10➔4.5C 等）引发的全服集市恐慌性砸盘踩踏，紧急上线破发套利监测系统；
  - **45 种全级作物与衍生标的**：全面覆盖 15 种原版农作物（T0 Standard / 标准）、15 种附魔形态（T1 Enchanted / 附魔）与 15 种紧实形态（T2 Compacted / 紧实）；
  - **双重保底核算体系**：独家提供「正式服现行高价 Live NPC（实时无风险变现窗口）」与「测试服削弱新价 Nerfed NPC（终极安全垫）」双重核算标准；
  - **精算采购策略与 T2 合成对比**：支持挂单买入（Buy Order）与秒买（Insta-Buy），对 T2 紧实作物直观展示「买入 T1 手动合成（160:1 折算）成本」与立省差价；
  - **限额考量**：整合 NPC 每日出货限额（NPC Daily Limit）与个人集市每日流水上限（如 15.00 B），自动推算满额净利润与流水消耗占比；
  - **单车搬砖精算器**：内置「单车搬砖精算器」弹窗，支持 1 背包 2,240 件 / 1 大号 Sack 20,000 件等预设，一键推算搬砖本金与净回款；
  - **全要素组合筛选与导出**：支持农作物种类与 T0/T1/T2 形态等级多选复选，支持一键导出 CSV 实时大表。
- **全新模块上线：集市挂单雷达与实时盯盘监控系统（Bazaar Order Tracker & Radar）**：
  - **实时顺位与排队压单量**：精准呈现目标挂单在盘口前 30 档内的实时排位（#1 ~ #30）及前方排队压单总量与单数；
  - **夺榜建议挂价（+0.1 Reclaim Price）**：实时比对榜首竞价，智能给出加价/降价夺回榜首建议挂单价，支持一键复制到剪贴板；
  - **精细化脱离盘口与撤单判定状态机**：
    - 倾销砸盘穿透（Dumper Sweep）：榜首价跌穿目标价时判定为遭遇倾销大单砸穿，100% 完全成交；
    - 队首自然撮合（Retail Fulfillment）：队首 #1 挂单脱离盘口判定为被散户小单自然消化完毕，100% 完全成交；
    - 非队首主动撤单（Cancelled by User）：在前方仍有高价单时非榜首脱离，判定为用户主动撤单，卡片置灰；
    - 深度压盘挤出（Outbid Deep）：被挤出前 30 档深度时发出深度脱离预警。
  - **多维立体警报系统**：内置 Web Audio API 纯合成警报音效、浏览器原生桌面通知（Notification）与网页标题交替闪烁；
  - **盘口深度可视化弹窗**：支持查看目标标的前 20 档买卖单深度分布柱状图，直观标记用户挂单；
  - **全局悬浮雷达胶囊**：常驻屏幕右下角，跨 Tab 全局监控挂单被超越与完成动态。
- **视觉规范与交互体验全面重构**：
  - **浅色模式（Light Mode）高对比度重绘**：优化情报横幅、恐慌指数看板与数据表格字色层级，彻底消除浅色背景文字辨识度不足问题；
  - **选项卡与图标排版优化**：修复农作物雷达 Tab 按钮中的重复图标与激活态徽章对比度；重构 T1/T2 农作物图标为精炼单 Emoji，根除横向溢出问题；T0 作物图标保留自然原色，仅边框采用低调浅灰；
  - **多选复选交互优化**：农作物与等级筛选按钮升级为可自由多选组合的多维过滤器。
- **市长与日历机制校正**：
  - 针对 2026 市长系统重构，全面标记旧版采矿节（Mining Fiesta）分场离散排期已废止，适配 Cole 特技激活期间「24/7 全程常驻生效」的全新机制。

### alpha 0.4.2 (2026-10-21)
- **白天模式（Light Mode）高对比度与辨识度深度重构**：
  - **收益图表切换栏**：优化全宝石净利润排行、原料品质收益差与利润-风险四象限图表切换 Tab 背景及高亮文本色彩，彻底消除激活态对比度不足问题；
  - **碎片属性追踪（ShardTracker）**：重绘“视图模式”（完整模式 / 紧凑模式）、“展示条数”（Top 10 / 20 / 50 / 100 / 全部）及策略/品质筛选按钮，修正激活选中态高亮与非选中态底色；
  - **温室突变农业精算终端（GreenhouseTracker）**：
    - 全面改造大型科技框体底色与边框投影，优化数学公式代码卡片、乘数徽章与输入配置面板浅色呈现；
    - 优化温室座数（0, 1, 2, 3 座）与理论株数预设按钮，提升标签文字与数值清晰度；
    - 重绘“原版农作物基础收益 (NPC价)”核心保底 KPI 1 卡片背景与数值字色层级，确保收益一目了然；
    - 农作物产出合计汇总行（Tfoot）与 Sack 分级换算徽标样式优化，全面改善浅色主题下的数据可读性。

### alpha 0.4.1 (2026-10-13)
- **品牌升级**：项目正式定名为 **SkyStreetHelper**；
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
