# Hypixel SkyBlock 宝石倒卖追踪系统 (Gemstone Flipper Pro)
## 统一翻译规范与术语标准手册 (Translation & Nomenclature Guide)

> **版本**：v2.1.0  
> **适用范围**：全项目代码库（前端 HTML/JS、后端 Python 引擎、API 响应字段、数据导出与文档体系）  
> **制定宗旨**：严格遵循 Hypixel SkyBlock 官方游戏命名与社区约定，统一中文用词，消除模糊营销词汇，建立清晰严谨的品质等级与配方复杂度分级标准。

---

## 一、 宝石品质等级 (Quality / Tier) 统一标准

在 Hypixel SkyBlock 中，宝石按品质层级严格遵循 **80:1 单向递增进阶**。品质名称必须严格按照下表统一，杜绝同义词混用：

| 英文 (En) | 规范中文 (Cn) | 游戏稀有度 (Rarity) | 官方标准配色 | 星号标注规则 | 倒卖实战特征与推荐用词规范 |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **Rough** | **粗糙** | Common (普通) | `#cbd5e1` (灰白) | 无 | **高单量/慎用**（需 35+ 笔挂单，易卡单堵仓，极不推荐） |
| **Flawed** | **微瑕** | Uncommon (罕见) | `#22c55e` (绿色) | 无 | **[推荐]**（首选原料，约 0.45 满单/炉，折价深、流通快） |
| **Fine** | **精致** | Rare (稀有) | `#3b82f6` (蓝色) | 无 | **[快速]**（单炉仅需 400 颗，秒挂单秒成交，点 5 次合成进炉） |
| **Flawless** | **无瑕** | Epic (史诗) | `#c084fc` (紫色) | 无 | **[免合成]**（单炉仅需 5 颗，直接配合水晶入炉，价差利润最薄） |
| **Perfect** | **完美** | Legendary (传奇) | `#fbbf24` (金色) | **强制带有 ★ 标注** | **锻造终极目标**（产出物，仅在 Bazaar 挂单出售，NPC 拒收） |

### 1.1 ★ 标注规范（强制要求）
- **适用对象**：**仅限** Perfect (完美) 级别宝石。
- **英文书写格式**：`★Perfect [Gem] Gemstone`（例如：`★Perfect Topaz Gemstone`、`★Perfect Ruby Gemstone`）。
- **中文书写格式**：`★完美 [宝石名]宝石`（例如：`★完美 黄玉宝石`、`★完美 红宝石`）。
- **缩写/徽章格式**：`★Perfect`、`★完美`。
- **严禁事项**：严禁在 Rough、Flawed、Fine、Flawless 等其他非终极品质上附加前置星号。

### 1.2 推荐标签与说明用词规范（词汇白名单与黑名单）
为了保持工具的专业性与中立性，代码与说明文本严禁使用浮夸营销词汇，必须采用简短直观的实用术语：

| 禁用/过时用词 (Blacklist) | 规范统一用词 (Whitelist) | 应用场景示例 |
| :--- | :--- | :--- |
| `主打黄金推荐`、`最佳甜点级别` | **`[推荐]`**、`推荐品质` | `Flawed 微瑕 [推荐]` |
| `极速省心`、`最省力` | **`[快速]`** | `Fine 精致 [快速]` |
| `无需批量`、`零合成` | **`[免合成]`** | `Flawless 无瑕 [免合成]` |
| `主推最优` | **`推荐`** | `挂单出售 (Sell Offer - 推荐)` |
| `极不推荐`、`盲点` | **`高单量/繁琐`** | `Rough 粗糙 [高单量/繁琐]` |
| `破损`、`瑕疵` | **`微瑕`** | 统一指代 Flawed 品质 |
| `优良`、`精细` | **`精致`** | 统一指代 Fine 品质 |

---

## 二、 12 种宝石品类 (Gemstone Types) 统一标准

全服 12 种宝石的英文标识、中文译名、属性特征、专属符号与官方主题色标准定义如下：

| 宝石代码 (Key) | 英文名称 (En) | 规范中文 (Cn) | 符号图标 | 专属官方色号 | 赋予属性 (Stat) | 繁杂度分级 | 终极产物标注规范 |
| :--- | :--- | :--- | :---: | :---: | :--- | :---: | :--- |
| `AMBER` | Amber | 琥珀 | ⸕ | `#f59e0b` | Mining Speed (采矿速度) | S级 | `★Perfect Amber Gemstone` |
| `TOPAZ` | Topaz | 黄玉 | ✧ | `#fbbf24` | Pristine (原石几率) | S级 | `★Perfect Topaz Gemstone` |
| `SAPPHIRE` | Sapphire | 蓝宝石 | ✎ | `#38bdf8` | Intelligence (智力) | A级 | `★Perfect Sapphire Gemstone` |
| `AMETHYST` | Amethyst | 紫水晶 | ✦ | `#c084fc` | Defense (防御力) | B级 | `★Perfect Amethyst Gemstone` |
| `JADE` | Jade | 翡翠 | ☘ | `#22c55e` | Mining Fortune (采矿幸运) | B级 | `★Perfect Jade Gemstone` |
| `JASPER` | Jasper | 碧玉 | ✦ | `#fb7185` | Strength (力量) | C级 | `★Perfect Jasper Gemstone` |
| `RUBY` | Ruby | 红宝石 | ❤ | `#ef4444` | Health (生命值) | C级 | `★Perfect Ruby Gemstone` |
| `ONYX` | Onyx | 黑玛瑙 / 缟玛瑙 | ☠ | `#64748b` | Crit Damage (暴击伤害) | GTMS only | `★Perfect Onyx Gemstone` |
| `CITRINE` | Citrine | 黄水晶 | ❖ | `#f97316` | Foraging Fortune (伐木幸运) | GTMS only | `★Perfect Citrine Gemstone` |
| `PERIDOT` | Peridot | 橄榄石 | ☘ | `#84cc16` | Farming Fortune (农业幸运) | GTMS only | `★Perfect Peridot Gemstone` |
| `AQUAMARINE` | Aquamarine | 海蓝宝石 | ☂ | `#06b6d4` | Fishing Speed (钓鱼速度) | GTMS only | `★Perfect Aquamarine Gemstone` |
| `OPAL` | Opal | **蛋白石** | ❂ | `#e2e8f0` | True Defense (真实防御) | OPAL | `★Perfect Opal Gemstone` |

> **特别说明**：`OPAL` 过去在部分场合被称为“欧珀”，本项目全系统统一规范为 **`蛋白石`**。

---

## 三、 配方繁杂度 / 水晶获取难度分级标准 (CN Matrix)

锻造每颗 ★Perfect 宝石均需要 1 颗对应水晶，根据获取场景、跑图耗时与额外经济成本，将原数字等级 (5, 3, 2, 1, 0, -1) 正式升级为直观阶梯：

| 规范等级代码 | 完整标准全称 | 涵盖宝石品类 | 水晶获取方式与核心机制 | 额外单颗成本 | 商业倒卖走量建议 |
| :---: | :--- | :--- | :--- | :---: | :--- |
| **S级**<br>*(原 5)* | **S级: 速刷** | 琥珀 (Amber)<br>黄玉 (Topaz) | 哥布林女皇巢穴持 King's Scent 直接采摘；熔岩神庙打怪放水晶即刷。 | **0 Coins** | **最高优先级**。零金币成本，无限快速反复刷取，工业化高频倒卖首选。 |
| **A级**<br>*(原 3)* | **A级: 蓝宝石** | 蓝宝石 (Sapphire) | 先行者城市交 Precursor Apparatus 装置兑换。 | **约 1M Coins** | **高优先级**。水晶稳定刷取，但单次必须扣除约 0.8M-1.2M 道具采购成本。 |
| **B级**<br>*(原 2)* | **B级: 慢刷** | 紫水晶 (Amethyst)<br>翡翠 (Jade) | 紫水晶需丛林神庙带钥匙跑酷；翡翠需迪万矿洞开箱寻找 4 件工具。 | **Amethyst: 约 240k**<br>**Jade: 0 Coins** | **中等优先级**。可循环获取，但单次包含跑酷解密与探图流程损耗。 |
| **C级**<br>*(原 1)* | **C级: 限跑水晶/冰洞偶得** | 碧玉 (Jasper)<br>红宝石 (Ruby) | 水晶核探险 (Nucleus Run) 提交 5 颗水晶最终偶得，或冰川矿井奇遇开箱掉落。 | **0 Coins**<br>(消耗个人库存) | **低优先级**。无法高频稳定量产，适合手头有探险库存时制作。 |
| **GTMS only**<br>*(原 0)* | **GTMS only: 仅限冰洞偶得** | 黑玛瑙 (Onyx)<br>黄水晶 (Citrine)<br>橄榄石 (Peridot)<br>海蓝宝石 (Aquamarine) | 仅在冰川隧道矿井 (Glacite Mineshafts) 探险中，从冰冻尸体与开箱稀有偶得。 | **0 Coins**<br>(消耗个人库存) | **特种高利标的**。单颗价差极大（常年 5M-10M+），但受限于水晶偶得率，不可全天候稳定走量。 |
| **OPAL**<br>*(原 -1)* | **OPAL: 蛋白石** | 蛋白石 (Opal) | 同样出自冰川矿井，但非 Great Forger 成就刚需，属性为 True Defense，市场热度较低。 | **0 Coins** | **低流通标的**。非必要不建议重仓囤积原料。 |

---

## 四、 交易行为与订单术语统一对照

| 英文缩写 | 英文全称 | 统一中文术语 | 业务含义说明 |
| :--- | :--- | :--- | :--- |
| **BO** | Buy Order | **订单预购 / 预购挂单** | 采购原料的标准方式（以当前最高买单挂出，享有最高折价） |
| **IB** | Instant Buy | **秒买现货 / 即时买入** | 快速拿货方式（直接吃掉卖单，成本较高，适合快速填满锻炉） |
| **SO** | Sell Offer | **挂单出售 / 挂售价** | 售出 ★Perfect 产物的标准方式（扣除 1% 税率后获得最大化纯利） |
| **IS** | Instant Sell | **秒卖现货 / 秒卖变现** | 应急平仓方式（用于大盘踩踏行情的快速止损与保底估算） |
| **NPC** | NPC Shop | **NPC 商店保底收购** | 游戏底层兜底：仅 Rough、Flawed、Fine 允许出售，Flawless / Perfect 严禁出售 |

---

## 五、 代码开发规范约定

1. **后端数据实体字段**：
   - 必须提供 `tier_cn` 与 `tier_en` 规范键名；
   - 必须提供 `cn_grade`（如 `"S级"`、`"GTMS only"`）与 `cn_label`（如 `"S级: 速刷"`）；
   - 针对目标完美宝石必须附带 `perfect_target_name`（如 `"★Perfect Topaz Gemstone"`）与 `perfect_target_cn`（如 `"★完美 黄玉宝石"`）。
2. **前端界面渲染**：
   - 所有展现 Perfect / 完美的组件（包含下拉列表、表头、卡片、徽章、弹窗）均必须包含 `★` 符号；
   - 主表格完美宝石估值列名称统一为 **`★完美宝石价值（当前）`**，支持动态点击排序，标题与数值统一采用金色高亮加大字号；
   - 买入品质列与完美宝石价值列均需配置 **SkyCofl 外部市场行情方形快捷按钮**，链接格式统一为：
     - 原料品质链接：`https://sky.coflnet.com/item/{TIER}_{GEM}_GEM`（如 `ROUGH_TOPAZ_GEM`、`FLAWED_TOPAZ_GEM`）；
     - ★完美宝石链接：`https://sky.coflnet.com/item/PERFECT_{GEM}_GEM`（如 `PERFECT_TOPAZ_GEM`）；
   - 配方繁杂度全局过滤快捷按钮规范为：`[全选]`、`[仅低成本(S)]`、`[仅容易(S/A级)]`、`[仅CN五水晶(S/A/B级)]`、`[全不选]`；
   - 文本配色遵循 Hypixel 官方配色标准：粗糙 (灰白)、微瑕 (绿色)、精致 (蓝色)、无瑕 (紫色)、★完美 (金色)。
