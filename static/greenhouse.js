/**
 * SkyblockTracker - Greenhouse Mutations Calculator Logic (alpha 0.4.1)
 * 农业（突变）收益-产出-ff计算小工具
 */

const CROP_COLUMNS = [
  { key: 'Wheat', label: '小麦', icon: '🌾', color: '#facc15', bg: 'rgba(250, 204, 21, 0.08)' },
  { key: 'Carrot', label: '胡萝卜', icon: '🥕', color: '#fb923c', bg: 'rgba(251, 146, 60, 0.08)' },
  { key: 'Potato', label: '马铃薯', icon: '🥔', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.08)' },
  { key: 'Pumpkin', label: '南瓜', icon: '🎃', color: '#ea580c', bg: 'rgba(234, 88, 12, 0.08)' },
  { key: 'Melon Slice', label: '西瓜', icon: '🍉', color: '#4ade80', bg: 'rgba(74, 222, 128, 0.08)' },
  { key: 'Cocoa Beans', label: '可可豆', icon: '🍫', color: '#d97706', bg: 'rgba(217, 119, 6, 0.08)' },
  { key: 'Cactus', label: '仙人掌', icon: '🌵', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.08)' },
  { key: 'Sugar Cane', label: '甘蔗', icon: '🎋', color: '#a3e635', bg: 'rgba(163, 230, 53, 0.08)' },
  { key: 'Nether Wart', label: '下界疣', icon: '🍄', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.08)' },
  { key: 'Mushroom', label: '蘑菇', icon: '🍄', color: '#d8b4fe', bg: 'rgba(216, 180, 254, 0.08)' },
  { key: 'Sunflower', label: '向日葵', icon: '🌻', color: '#fde047', bg: 'rgba(253, 224, 71, 0.08)' },
  { key: 'Moonflower', label: '月光花', icon: '🌙', color: '#7dd3fc', bg: 'rgba(125, 211, 252, 0.08)' },
  { key: 'Wild Rose', label: '野玫瑰', icon: '🌹', color: '#fb7185', bg: 'rgba(251, 113, 133, 0.08)' }
];

const GREENHOUSE_STATE = {
  loaded: false,
  mutations: [],
  baseCrops: [],
  npcPrices: {},
  aloeStages: {},
  jellybeanStages: {},
  
  // Current Calculation Inputs
  selectedMutationId: 'ALL_IN_ALOE',
  farmingFortune: 3100,
  greenhouseUpgrade: 20.0,
  uniqueCropsBonus: 25.0,
  positiveBuff: 0.0,
  negativeDebuff: 0.0,
  hasImmunity: false,
  evergreenChip: 1.60,
  
  // Scale & Multiplier Controls (Requirement 4)
  mutationsPerGh: 1, // 0 - 100
  greenhouseCount: 1, // 0, 1, 2, 3
  autoCalcTotal: true,
  totalMutations: 1,
  
  // Custom Mutation Multiplier / Stage
  currentStage: 15, // For Aloe: 15 (86x); For Jellybean: 120 (10x)
  customMultiplier: 86.0,
  customDrops: null, // If user modifies base drops
  
  // Table View & Filtering
  tableSearch: '',
  tableRarityFilter: 'ALL',
  tableSortCol: 'npc_single',
  tableSortDir: 'desc'
};

// 1. 初始化入口
async function initGreenhouseTracker() {
  if (!GREENHOUSE_STATE.loaded) {
    await fetchGreenhouseData();
  } else {
    recalculateGreenhouse();
  }
}

// 2. 从后端 API 获取数据
async function fetchGreenhouseData() {
  try {
    const res = await fetch('/api/greenhouse/mutations');
    if (!res.ok) throw new Error('网络请求异常: ' + res.status);
    const data = await res.json();
    
    GREENHOUSE_STATE.mutations = data.mutations || [];
    GREENHOUSE_STATE.baseCrops = data.base_crops || [];
    GREENHOUSE_STATE.npcPrices = data.npc_prices || {};
    GREENHOUSE_STATE.aloeStages = data.aloe_stages || {};
    GREENHOUSE_STATE.jellybeanStages = data.jellybean_stages || {};
    GREENHOUSE_STATE.loaded = true;

    // 填充突变下拉选择框
    populateMutationSelector();
    // 初始化事件绑定
    initGreenhouseEvents();
    // 渲染阶段选择框
    updateStageSelectorUI();
    // 渲染比价大表
    renderGreenhouseTable();
    // 执行首轮计算
    recalculateGreenhouse();
  } catch (err) {
    console.error('加载温室突变数据失败:', err);
    showGreenhouseToast('加载温室突变数据失败: ' + err.message, 'error');
  }
}

// 3. 填充突变下拉选择器 (支持关键词实时检索过滤)
function populateMutationSelector(filterQuery = '') {
  const sel = document.getElementById('ghMutationSelect');
  if (!sel) return;

  const query = (filterQuery || '').trim().toLowerCase();
  sel.innerHTML = '';

  const filtered = GREENHOUSE_STATE.mutations.filter(m => {
    if (!query) return true;
    return m.name_en.toLowerCase().includes(query) ||
           (m.name_zh && m.name_zh.toLowerCase().includes(query)) ||
           m.rarity.toLowerCase().includes(query) ||
           m.id.toLowerCase().includes(query);
  });

  if (filtered.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '未找到匹配突变作物';
    opt.disabled = true;
    sel.appendChild(opt);
    return;
  }

  let hasSelected = false;
  filtered.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = `[${m.rarity}] ${m.name_en} (${m.name_zh || ''})`;
    if (m.id === GREENHOUSE_STATE.selectedMutationId) {
      opt.selected = true;
      hasSelected = true;
    }
    sel.appendChild(opt);
  });

  if (!hasSelected && filtered.length > 0) {
    sel.value = filtered[0].id;
    onSelectMutation(filtered[0].id);
  }

  if (!sel.dataset.listenerAttached) {
    sel.dataset.listenerAttached = 'true';
    sel.addEventListener('change', (e) => {
      if (e.target.value) {
        onSelectMutation(e.target.value);
      }
    });
  }
}

// 4. 选择突变时的联动
function onSelectMutation(mutId) {
  GREENHOUSE_STATE.selectedMutationId = mutId;
  const target = GREENHOUSE_STATE.mutations.find(m => m.id === mutId);
  if (!target) return;

  // 重置自定义掉落微调
  GREENHOUSE_STATE.customDrops = null;

  // 更新阶段选择 UI
  if (mutId === 'ALL_IN_ALOE') {
    GREENHOUSE_STATE.currentStage = 15;
    GREENHOUSE_STATE.customMultiplier = GREENHOUSE_STATE.aloeStages[15] || 86.0;
  } else if (mutId === 'MAGIC_JELLYBEAN') {
    GREENHOUSE_STATE.currentStage = 120;
    GREENHOUSE_STATE.customMultiplier = GREENHOUSE_STATE.jellybeanStages[120] || 10.0;
  } else {
    GREENHOUSE_STATE.currentStage = 1;
    GREENHOUSE_STATE.customMultiplier = target.default_multiplier || 1.0;
  }

  // 默认根据目标突变自带的效果微调正负buff建议
  if (target.yield_buff > 0) {
    const pSel = document.getElementById('ghPositiveBuffSelect');
    if (pSel) pSel.value = target.yield_buff.toString();
    GREENHOUSE_STATE.positiveBuff = target.yield_buff;
  }
  if (target.yield_debuff < 0) {
    const nSel = document.getElementById('ghNegativeDebuffSelect');
    if (nSel) nSel.value = target.yield_debuff.toString();
    GREENHOUSE_STATE.negativeDebuff = target.yield_debuff;
  }
  if (target.has_immunity) {
    const immCheck = document.getElementById('ghImmunityCheck');
    if (immCheck) immCheck.checked = true;
    GREENHOUSE_STATE.hasImmunity = true;
  }

  updateStageSelectorUI();
  updateTargetMutationCard(target);
  recalculateGreenhouse();
}

// 5. 阶段选择 UI 动态展示 (Aloe 4~27, Jellybean 12~120, 普通)
function updateStageSelectorUI() {
  const container = document.getElementById('ghStageSelectorContainer');
  const stageDesc = document.getElementById('ghStageDesc');
  const mutId = GREENHOUSE_STATE.selectedMutationId;

  if (!container) return;

  if (mutId === 'ALL_IN_ALOE') {
    container.classList.remove('hidden');
    container.innerHTML = `
      <label class="block text-xs font-bold text-amber-300 mb-1 flex items-center justify-between">
        <span><i class="fa-solid fa-layer-group mr-1"></i>All-in Aloe 生长阶段 (Stage 4 ~ 27)</span>
        <span class="text-[10px] text-amber-400 font-mono font-normal">当前倍率: <strong class="text-white text-xs">${GREENHOUSE_STATE.customMultiplier}x</strong></span>
      </label>
      <select id="ghAloeStageSelect" class="w-full bg-[#111520] border border-amber-500/50 rounded-lg px-3 py-2 text-xs font-bold text-amber-200 outline-none focus:border-amber-400">
        ${Object.entries(GREENHOUSE_STATE.aloeStages).map(([st, mult]) => {
          const resetRisk = Math.min(72, (parseInt(st) - 3) * 3);
          const isSelected = parseInt(st) === GREENHOUSE_STATE.currentStage;
          return `<option value="${st}" ${isSelected ? 'selected' : ''}>阶段 Stage ${st} (倍率 ${mult}x | 重置概率 ${resetRisk}%)</option>`;
        }).join('')}
      </select>
      <p class="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
        <i class="fa-solid fa-circle-info text-amber-400 mr-1"></i>阶段越高掉落倍率呈指数暴增，但每级均有重置风险。玩家实测推荐：<strong>Stage 13~14</strong>期望最高，<strong>Stage 15</strong>为 86x。
      </p>
    `;
    const sel = document.getElementById('ghAloeStageSelect');
    if (sel) {
      sel.addEventListener('change', (e) => {
        const st = parseInt(e.target.value);
        GREENHOUSE_STATE.currentStage = st;
        GREENHOUSE_STATE.customMultiplier = GREENHOUSE_STATE.aloeStages[st] || 1.0;
        recalculateGreenhouse();
      });
    }
  } else if (mutId === 'MAGIC_JELLYBEAN') {
    container.classList.remove('hidden');
    container.innerHTML = `
      <label class="block text-xs font-bold text-purple-300 mb-1 flex items-center justify-between">
        <span><i class="fa-solid fa-layer-group mr-1"></i>Magic Jellybean 阶段 (Stage 12 ~ 120)</span>
        <span class="text-[10px] text-purple-300 font-mono font-normal">当前倍率: <strong class="text-white text-xs">${GREENHOUSE_STATE.customMultiplier}x</strong></span>
      </label>
      <select id="ghJellybeanStageSelect" class="w-full bg-[#111520] border border-purple-500/50 rounded-lg px-3 py-2 text-xs font-bold text-purple-200 outline-none focus:border-purple-400">
        ${Object.entries(GREENHOUSE_STATE.jellybeanStages).map(([st, mult]) => {
          const isSelected = parseInt(st) === GREENHOUSE_STATE.currentStage;
          return `<option value="${st}" ${isSelected ? 'selected' : ''}>阶段 Stage ${st} (倍率 ${mult}x | 每12阶段+1x)</option>`;
        }).join('')}
      </select>
      <p class="text-[10px] text-slate-400 mt-1.5 leading-relaxed">
        <i class="fa-solid fa-circle-info text-purple-400 mr-1"></i>软糖豆不腐烂，可安心成长至 120 阶段拉满 10x 掉落！
      </p>
    `;
    const sel = document.getElementById('ghJellybeanStageSelect');
    if (sel) {
      sel.addEventListener('change', (e) => {
        const st = parseInt(e.target.value);
        GREENHOUSE_STATE.currentStage = st;
        GREENHOUSE_STATE.customMultiplier = GREENHOUSE_STATE.jellybeanStages[st] || 1.0;
        recalculateGreenhouse();
      });
    }
  } else {
    // 普通突变
    container.classList.remove('hidden');
    container.innerHTML = `
      <label class="block text-xs font-bold text-slate-300 mb-1 flex items-center justify-between">
        <span><i class="fa-solid fa-calculator mr-1"></i>收获修正值 (Multiplier)</span>
        <span class="text-[10px] text-slate-400 font-mono">默认: 1.0x</span>
      </label>
      <div class="flex items-center space-x-2">
        <input id="ghCustomMultInput" type="number" step="0.1" min="0" max="10000" value="${GREENHOUSE_STATE.customMultiplier}" 
          class="w-full bg-[#111520] border border-[#262e45] rounded-lg px-3 py-2 text-xs font-bold text-white outline-none focus:border-indigo-500 font-mono">
        <button onclick="resetCustomMultiplier()" class="px-2.5 py-2 bg-[#181d2c] hover:bg-slate-700 text-slate-300 text-xs rounded-lg whitespace-nowrap border border-[#262e45]">重置</button>
      </div>
      <p class="text-[10px] text-slate-500 mt-1">此突变无特殊多阶段加成，默认修正值为 1.0x。</p>
    `;
    const inp = document.getElementById('ghCustomMultInput');
    if (inp) {
      inp.addEventListener('input', (e) => {
        GREENHOUSE_STATE.customMultiplier = parseFloat(e.target.value) || 1.0;
        recalculateGreenhouse();
      });
    }
  }
}

function resetCustomMultiplier() {
  const target = GREENHOUSE_STATE.mutations.find(m => m.id === GREENHOUSE_STATE.selectedMutationId);
  GREENHOUSE_STATE.customMultiplier = target ? (target.default_multiplier || 1.0) : 1.0;
  updateStageSelectorUI();
  recalculateGreenhouse();
}

// 6. 更新选中突变卡片基础信息
function updateTargetMutationCard(target) {
  const card = document.getElementById('ghTargetMutationInfo');
  if (!card || !target) return;

  const rarityColor = getRarityHexColor(target.rarity);
  const dropsStr = Object.entries(target.base_drops).map(([k, v]) => `${v}x ${k}`).join(', ') || '无基础掉落';

  card.innerHTML = `
    <div class="flex items-center justify-between border-b border-[#262e45] pb-2 mb-2.5">
      <div class="flex items-center space-x-2">
        <span class="px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase" style="background-color: ${rarityColor}20; color: ${rarityColor}; border: 1px solid ${rarityColor}40;">
          ${target.rarity}
        </span>
        <span class="font-bold text-sm text-white">${target.name_en}</span>
        <span class="text-xs text-slate-400">${target.name_zh || ''}</span>
      </div>
      <div class="text-[11px] font-mono text-slate-400">
        尺寸: <strong class="text-white">${target.size}</strong> | 土壤: <strong class="text-amber-300">${target.growth_surface}</strong>
      </div>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
      <div class="bg-[#111520] p-2 rounded-lg border border-[#262e45]">
        <span class="text-slate-400 block text-[10px]">周边底物生长需求:</span>
        <span class="font-medium text-slate-200">${target.substrates_text || '无特殊需求'}</span>
      </div>
      <div class="bg-[#111520] p-2 rounded-lg border border-[#262e45]">
        <span class="text-slate-400 block text-[10px]">单温室理论最大株数:</span>
        <span class="font-bold text-amber-400">${target.max_per_gh} 株</span>
        <button onclick="setPerGhCount(${target.max_per_gh})" class="ml-2 text-[10px] text-indigo-400 hover:text-indigo-300 underline font-mono">一键套用</button>
      </div>
    </div>
    <div class="mt-2 text-xs bg-[#111520] p-2 rounded-lg border border-[#262e45] flex items-center justify-between">
      <div>
        <span class="text-slate-400 text-[10px] block">单株原始作物基础掉落:</span>
        <span class="font-mono text-emerald-300 font-bold">${dropsStr}</span>
      </div>
      <div class="text-right">
        <span class="text-slate-400 text-[10px] block">实时 Bazaar 单价:</span>
        <span class="font-mono text-amber-300 font-bold">${target.bazaar_sell_price ? target.bazaar_sell_price.toLocaleString() + ' C' : '未上架 / 0'}</span>
      </div>
    </div>
  `;
}

// 7. 突变数量与温室规模调节联动 (Requirement 4)
function setPerGhCount(val) {
  GREENHOUSE_STATE.mutationsPerGh = Math.max(0, Math.min(100, parseInt(val) || 0));
  const inp = document.getElementById('ghPerGhInput');
  if (inp) inp.value = GREENHOUSE_STATE.mutationsPerGh;

  syncTotalMutations();
  recalculateGreenhouse();
}

function setGreenhouseCount(val) {
  const parsed = Math.max(0, Math.min(3, parseInt(val) || 0));
  GREENHOUSE_STATE.greenhouseCount = parsed;
  
  // 更新按钮样式
  for (let i = 0; i <= 3; i++) {
    const btn = document.getElementById(`ghCountBtn_${i}`);
    if (btn) {
      if (i === parsed) {
        btn.className = "px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white shadow-sm transition active:scale-95";
      } else {
        btn.className = "px-3 py-1.5 rounded-lg text-xs font-bold bg-[#111520] hover:bg-slate-700 text-slate-300 border border-[#262e45] transition active:scale-95";
      }
    }
  }

  syncTotalMutations();
  recalculateGreenhouse();
}

function onAutoCalcTotalToggle(e) {
  GREENHOUSE_STATE.autoCalcTotal = e.target.checked;
  const perGhInput = document.getElementById('ghPerGhInput');
  const perGhPresets = document.getElementById('ghPerGhPresets');
  const ghCountGroup = document.getElementById('ghCountGroup');

  if (GREENHOUSE_STATE.autoCalcTotal) {
    if (perGhInput) perGhInput.disabled = false;
    if (perGhPresets) perGhPresets.classList.remove('opacity-40', 'pointer-events-none');
    if (ghCountGroup) ghCountGroup.classList.remove('opacity-40', 'pointer-events-none');
    syncTotalMutations();
  } else {
    if (perGhInput) perGhInput.disabled = true;
    if (perGhPresets) perGhPresets.classList.add('opacity-40', 'pointer-events-none');
    if (ghCountGroup) ghCountGroup.classList.add('opacity-40', 'pointer-events-none');
  }
  recalculateGreenhouse();
}

function onTotalMutationsManualChange(val) {
  const parsed = Math.max(0, parseInt(val) || 0);
  GREENHOUSE_STATE.totalMutations = parsed;

  // 当用户直接修改总突变数时，自动关闭勾选框并锁定前两个文本框
  const checkbox = document.getElementById('ghAutoCalcTotalCheck');
  if (checkbox && checkbox.checked) {
    checkbox.checked = false;
    onAutoCalcTotalToggle({ target: checkbox });
  }

  recalculateGreenhouse();
}

function syncTotalMutations() {
  if (GREENHOUSE_STATE.autoCalcTotal) {
    GREENHOUSE_STATE.totalMutations = GREENHOUSE_STATE.mutationsPerGh * GREENHOUSE_STATE.greenhouseCount;
    const totalInput = document.getElementById('ghTotalMutationsInput');
    if (totalInput) totalInput.value = GREENHOUSE_STATE.totalMutations;
  }
}

// 8. 核心公式与收益实时运算 (Local Client-Side Calculation with Exact Formula)
function recalculateGreenhouse() {
  const target = GREENHOUSE_STATE.mutations.find(m => m.id === GREENHOUSE_STATE.selectedMutationId);
  if (!target) return;

  // 1. 读取基础输入参数
  const ff = GREENHOUSE_STATE.farmingFortune;
  const ghUp = GREENHOUSE_STATE.greenhouseUpgrade;
  const uniqBonus = GREENHOUSE_STATE.uniqueCropsBonus;
  const pBuff = GREENHOUSE_STATE.positiveBuff;
  const nDebuff = GREENHOUSE_STATE.negativeDebuff;
  const hasImm = GREENHOUSE_STATE.hasImmunity;
  const chip = GREENHOUSE_STATE.evergreenChip;
  const mult = GREENHOUSE_STATE.customMultiplier;
  const totalMuts = GREENHOUSE_STATE.totalMutations;

  // 2. Yield 规则核算
  // 若植物受到免疫效果，负面效果记为 0；正负取加和
  const actualDebuff = hasImm ? 0.0 : nDebuff;
  const totalYieldPct = ghUp + uniqBonus + pBuff + actualDebuff;
  const yieldMultiplier = 1.0 + (totalYieldPct / 100.0);

  // 更新公式 Yield 徽章展示
  const yieldSummaryBadge = document.getElementById('ghYieldSummaryBadge');
  if (yieldSummaryBadge) {
    yieldSummaryBadge.innerHTML = `
      Yield总和: <strong class="text-white">+${totalYieldPct.toFixed(1)}%</strong> 
      (乘数: <strong class="text-lime-300">x${yieldMultiplier.toFixed(3)}</strong>)
      ${hasImm ? '<span class="ml-1 text-[10px] text-emerald-400 font-bold">[免疫生效]</span>' : ''}
    `;
  }

  // 3. 基础掉落字典
  const dropsDict = GREENHOUSE_STATE.customDrops || target.base_drops || {};

  // 4. 计算每种基础作物的产出与收益
  const ffFactor = (ff / 100.0) + 1.0;
  let totalNpcRevenue = 0.0;
  const cropResults = [];

  for (const [cropName, baseCount] of Object.entries(dropsDict)) {
    // 农作物掉落 = (1 + yield总和%) * Evergreen chip加成 * 原始农作物掉落 * ((农业幸运 + 对应作物幸运)/100 + 1) * 修正值 * 总突变数
    const singleDrop = yieldMultiplier * chip * baseCount * ffFactor * mult;
    const totalDrop = singleDrop * totalMuts;
    const npcPrice = GREENHOUSE_STATE.npcPrices[cropName] || 4.0;
    const cropValue = totalDrop * npcPrice;
    totalNpcRevenue += cropValue;

    // Sack / 背包分级折算 (25600 紧实, 160 附魔, 普通)
    const compacted = Math.floor(totalDrop / 25600);
    const remComp = totalDrop % 25600;
    const enchanted = Math.floor(remComp / 160);
    const normal = Math.round((remComp % 160) * 10) / 10;

    cropResults.push({
      cropName,
      baseCount,
      singleDrop,
      totalDrop,
      npcPrice,
      cropValue,
      compacted,
      enchanted,
      normal
    });
  }

  // 5. 突变本体掉落计算
  // 突变掉落 = (1 + yield总和%) * 修正值 * 总突变数
  const singleMutDrop = yieldMultiplier * mult;
  const totalMutDrop = singleMutDrop * totalMuts;
  const bzPrice = target.bazaar_sell_price || 0.0;
  const totalMutBzRevenue = totalMutDrop * bzPrice;

  // All-in Aloe 碎片折算
  let aloeFragments = 0;
  let aloeFull = 0;
  let aloeLeftover = 0;
  if (target.id === 'ALL_IN_ALOE') {
    aloeFragments = totalMutDrop;
    aloeFull = Math.floor(aloeFragments / 9);
    aloeLeftover = Math.round((aloeFragments % 9) * 10) / 10;
  }

  // 6. 渲染看板展示
  renderResultsDashboard({
    target,
    totalNpcRevenue,
    totalMutDrop,
    totalMutBzRevenue,
    grandTotalRevenue: totalNpcRevenue + totalMutBzRevenue,
    cropResults,
    aloeDetails: target.id === 'ALL_IN_ALOE' ? { aloeFragments, aloeFull, aloeLeftover } : null,
    totalMuts
  });
}

// 9. 渲染结果看板 (Dashboard KPI & Cards)
function renderResultsDashboard(data) {
  // KPI 1: 原版农作物基础收益 (NPC价) —— 最重要指标
  const npcRevEl = document.getElementById('ghNpcRevenueDisplay');
  if (npcRevEl) {
    npcRevEl.textContent = formatCoinsCompact(data.totalNpcRevenue) + ' Coins';
    npcRevEl.title = `精确数值: ${Math.round(data.totalNpcRevenue).toLocaleString()} Coins`;
  }

  // KPI 2: 突变本体集市收益
  const mutRevEl = document.getElementById('ghMutRevenueDisplay');
  if (mutRevEl) {
    mutRevEl.textContent = formatCoinsCompact(data.totalMutBzRevenue) + ' Coins';
    mutRevEl.title = `精确数值: ${Math.round(data.totalMutBzRevenue).toLocaleString()} Coins`;
  }

  // KPI 3: 综合总收益
  const grandRevEl = document.getElementById('ghGrandRevenueDisplay');
  if (grandRevEl) {
    grandRevEl.textContent = formatCoinsCompact(data.grandTotalRevenue) + ' Coins';
    grandRevEl.title = `精确数值: ${Math.round(data.grandTotalRevenue).toLocaleString()} Coins`;
  }

  // KPI 4: 突变掉落数量
  const mutDropEl = document.getElementById('ghMutDropCountDisplay');
  if (mutDropEl) {
    if (data.aloeDetails) {
      mutDropEl.innerHTML = `
        <span class="text-amber-400 font-bold">${data.aloeDetails.aloeFull}</span> 株芦荟 
        <span class="text-xs text-slate-400">(+${data.aloeDetails.aloeLeftover} 碎片)</span>
      `;
    } else {
      mutDropEl.textContent = `${Math.round(data.totalMutDrop * 10) / 10} 颗`;
    }
  }

  // 渲染作物掉落分级折算表格 (每种作物一行，放大图标，Sack分级重命名为 T2 / T1 / T0)
  const cropsContainer = document.getElementById('ghCropsBreakdownContainer');
  const badgeEl = document.getElementById('ghCropsTotalMutBadge');
  if (badgeEl) badgeEl.textContent = data.totalMuts;

  if (!cropsContainer) return;

  if (data.cropResults.length === 0) {
    cropsContainer.innerHTML = `
      <div class="p-6 text-center text-slate-500 bg-[#111520] rounded-xl border border-[#262e45]">
        <i class="fa-solid fa-seedling text-3xl mb-2 text-slate-600 block"></i>
        当前选中的突变没有基础农作物掉落（如特殊观赏或阶段专属作物）
      </div>
    `;
    return;
  }

  let totalYieldAllCrops = 0;
  data.cropResults.forEach(c => totalYieldAllCrops += c.totalDrop);

  cropsContainer.innerHTML = `
    <div class="rounded-xl border border-[#262e45] bg-[#111520]/80 overflow-hidden shadow-inner">
      <table class="w-full text-left text-xs border-collapse">
        <thead class="bg-[#151926] text-slate-400 font-bold border-b border-[#262e45] uppercase text-[11px] tracking-wider select-none">
          <tr>
            <th class="py-3 px-4">原版农作物 (Crop)</th>
            <th class="py-3 px-3 text-right">单株原始掉落</th>
            <th class="py-3 px-4 text-right">本次总产出数量</th>
            <th class="py-3 px-4">游戏内 Sack / 背包层级换算</th>
            <th class="py-3 px-4 text-right">NPC 单价</th>
            <th class="py-3 px-4 text-right">NPC 收益合计</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-[#262e45]/50 text-slate-300">
          ${data.cropResults.map(c => {
            const cropCol = CROP_COLUMNS.find(x => x.key === c.cropName) || { color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' };
            const emoji = getCropEmoji(c.cropName);
            const zhName = getCropZhName(c.cropName);
            return `
              <tr class="hover:bg-slate-800/30 transition">
                <!-- 作物图标与名称 (放大作物图标) -->
                <td class="py-3 px-4 whitespace-nowrap">
                  <div class="flex items-center space-x-3">
                    <span class="w-12 h-12 rounded-xl border flex items-center justify-center text-2xl sm:text-3xl shadow-sm shrink-0" 
                          style="background-color: ${cropCol.bg}; border-color: ${cropCol.color}40;">
                      ${emoji}
                    </span>
                    <div>
                      <span class="font-extrabold text-sm text-white block">${c.cropName}</span>
                      <span class="text-xs text-slate-400 font-medium">${zhName}</span>
                    </div>
                  </div>
                </td>

                <!-- 单株原始掉落 -->
                <td class="py-3 px-3 text-right whitespace-nowrap font-mono text-slate-300">
                  ${Math.round(c.singleDrop).toLocaleString()} 颗
                </td>

                <!-- 本次总产出数量 -->
                <td class="py-3 px-4 text-right whitespace-nowrap">
                  <span class="font-mono font-extrabold text-base text-emerald-300 block">${Math.round(c.totalDrop).toLocaleString()}</span>
                  <span class="text-[10px] text-slate-400 font-mono">总颗数</span>
                </td>

                <!-- Sack 背包层级换算 (T2 / T1 / T0) -->
                <td class="py-3 px-4">
                  <div class="flex flex-wrap items-center gap-1.5 font-mono text-xs">
                    ${c.compacted > 0 ? `
                      <span class="px-2.5 py-1 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold" title="紧实级 (25,600 普通作物折合 1 个)">
                        +${c.compacted.toLocaleString()} T2 (Compacted/E-Block)
                      </span>
                    ` : ''}
                    ${c.enchanted > 0 ? `
                      <span class="px-2.5 py-1 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-bold" title="附魔级 (160 普通作物折合 1 个)">
                        +${c.enchanted.toLocaleString()} T1 (Enchanted)
                      </span>
                    ` : ''}
                    <span class="px-2.5 py-1 rounded-md bg-slate-700/40 text-slate-300 border border-slate-600/40 font-medium" title="普通散装作物">
                      +${c.normal.toLocaleString()} T0 (Vanilla)
                    </span>
                  </div>
                </td>

                <!-- NPC 单价 -->
                <td class="py-3 px-4 text-right whitespace-nowrap font-mono text-xs text-slate-300">
                  ${c.npcPrice} Coins
                </td>

                <!-- NPC 收益合计 -->
                <td class="py-3 px-4 text-right whitespace-nowrap">
                  <span class="font-mono font-extrabold text-amber-300 text-sm block">${Math.round(c.cropValue).toLocaleString()}</span>
                  <span class="text-[10px] text-slate-400 font-mono">Coins</span>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
        <tfoot class="bg-[#151926]/90 border-t border-[#262e45] text-xs font-bold text-slate-300">
          <tr>
            <td class="py-2.5 px-4 font-sans text-slate-400">农作物产出合计 (${data.cropResults.length} 种作物)</td>
            <td class="py-2.5 px-3"></td>
            <td class="py-2.5 px-4 text-right font-mono text-emerald-400 font-extrabold">${Math.round(totalYieldAllCrops).toLocaleString()} 颗</td>
            <td class="py-2.5 px-4 text-slate-500 text-[11px] font-normal">全温室 ${data.totalMuts} 株收获累计</td>
            <td class="py-2.5 px-4"></td>
            <td class="py-2.5 px-4 text-right font-mono text-amber-300 font-extrabold text-sm">${Math.round(data.totalNpcRevenue).toLocaleString()} Coins</td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;
}

// 10. 全突变规划与比价大表渲染 (Leaderboard Table)
function renderGreenhouseTable() {
  const tbody = document.getElementById('ghMasterTableBody');
  if (!tbody) return;

  let filtered = [...GREENHOUSE_STATE.mutations];

  // 1. 关键词检索
  if (GREENHOUSE_STATE.tableSearch) {
    const q = GREENHOUSE_STATE.tableSearch.toLowerCase();
    filtered = filtered.filter(m => 
      m.name_en.toLowerCase().includes(q) || 
      (m.name_zh && m.name_zh.toLowerCase().includes(q)) ||
      m.rarity.toLowerCase().includes(q) ||
      m.growth_surface.toLowerCase().includes(q) ||
      m.substrates_text.toLowerCase().includes(q)
    );
  }

  // 2. 稀有度筛选
  if (GREENHOUSE_STATE.tableRarityFilter !== 'ALL') {
    filtered = filtered.filter(m => m.rarity === GREENHOUSE_STATE.tableRarityFilter);
  }

  // 3. 计算每种突变在当前参数下的单株收益与单温室全满收益
  const ffFactor = (GREENHOUSE_STATE.farmingFortune / 100.0) + 1.0;
  const chip = GREENHOUSE_STATE.evergreenChip;
  
  const enrichedList = filtered.map(m => {
    // 默认倍率
    let mMult = m.default_multiplier || 1.0;
    if (m.id === 'ALL_IN_ALOE') mMult = 86.0; // 默认 Stage 15
    if (m.id === 'MAGIC_JELLYBEAN') mMult = 10.0; // 默认 Stage 120

    // Yield
    const actualDebuff = m.has_immunity ? 0 : m.yield_debuff;
    const yPct = 20.0 + 25.0 + m.yield_buff + actualDebuff;
    const yMult = 1.0 + (yPct / 100.0);

    // 单株基础农作物 NPC 收益
    let singleNpcRev = 0;
    for (const [cname, cnt] of Object.entries(m.base_drops || {})) {
      const drop = yMult * chip * cnt * ffFactor * mMult;
      const p = GREENHOUSE_STATE.npcPrices[cname] || 4.0;
      singleNpcRev += drop * p;
    }

    // 单温室全满收益 (单株 * 单温室上限)
    const ghMaxRev = singleNpcRev * (m.max_per_gh || 16);

    return {
      ...m,
      calc_multiplier: mMult,
      single_npc_rev: singleNpcRev,
      gh_max_rev: ghMaxRev
    };
  });

  // 4. 排序
  enrichedList.sort((a, b) => {
    const col = GREENHOUSE_STATE.tableSortCol;
    let va = a[col], vb = b[col];
    if (col === 'npc_single') { va = a.single_npc_rev; vb = b.single_npc_rev; }
    if (col === 'npc_gh_max') { va = a.gh_max_rev; vb = b.gh_max_rev; }
    if (col === 'bz_price') { va = a.bazaar_sell_price || 0; vb = b.bazaar_sell_price || 0; }
    if (col === 'max_per_gh') { va = a.max_per_gh; vb = b.max_per_gh; }
    if (col && col.startsWith('crop_')) {
      const cropKey = col.replace('crop_', '');
      const getVal = (item) => {
        if (!item.base_drops) return 0;
        if (cropKey === 'Mushroom') {
          return (item.base_drops['Red Mushroom'] || item.base_drops['Brown Mushroom'] || 0);
        }
        return (item.base_drops[cropKey] || 0);
      };
      va = getVal(a);
      vb = getVal(b);
    }
    
    if (typeof va === 'string') {
      return GREENHOUSE_STATE.tableSortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    }
    return GREENHOUSE_STATE.tableSortDir === 'asc' ? (va || 0) - (vb || 0) : (vb || 0) - (va || 0);
  });

  // 5. 渲染表格行
  if (enrichedList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="20" class="text-center py-8 text-slate-500">没有符合条件的突变作物</td></tr>`;
    return;
  }

  tbody.innerHTML = enrichedList.map((m, idx) => {
    const rColor = getRarityHexColor(m.rarity);
    const isSelected = m.id === GREENHOUSE_STATE.selectedMutationId;

    return `
      <tr class="hover:bg-slate-800/40 transition border-b border-[#262e45]/40 ${isSelected ? 'bg-indigo-950/20' : ''}">
        <!-- 突变名称 -->
        <td class="py-2.5 px-3 whitespace-nowrap">
          <div class="flex items-center space-x-2">
            <span class="w-2 h-2 rounded-full shrink-0" style="background-color: ${rColor}"></span>
            <div>
              <span class="font-bold text-xs" style="color: ${rColor}">${m.name_en}</span>
              <span class="text-[10px] text-slate-400 block">${m.name_zh || ''}</span>
            </div>
          </div>
        </td>

        <!-- 稀有度与尺寸 -->
        <td class="py-2.5 px-2 whitespace-nowrap text-xs">
          <span class="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold" style="background-color: ${rColor}15; color: ${rColor}; border: 1px solid ${rColor}30;">
            ${m.rarity}
          </span>
          <span class="text-[10px] text-slate-400 ml-1 font-mono">${m.size}</span>
        </td>

        <!-- 单温室上限与土壤 -->
        <td class="py-2.5 px-2 text-center whitespace-nowrap text-xs">
          <span class="font-bold text-amber-400 font-mono">${m.max_per_gh}</span> <span class="text-[10px] text-slate-400">株</span>
          <span class="block text-[10px] text-slate-500">${m.growth_surface}</span>
        </td>

        <!-- 13 种作物独立列 (掉落物为0的严格留空，其他正常显示数值与专属主题色) -->
        ${CROP_COLUMNS.map(col => {
          let val = 0;
          if (col.key === 'Mushroom') {
            val = (m.base_drops['Red Mushroom'] || m.base_drops['Brown Mushroom'] || 0);
          } else {
            val = (m.base_drops[col.key] || 0);
          }

          if (val > 0) {
            return `
              <td class="py-2.5 px-1.5 text-center whitespace-nowrap font-mono font-bold text-xs" 
                  style="color: ${col.color}; background-color: ${col.bg};" 
                  title="${col.label} (${col.key}): ${val.toLocaleString()} 颗">
                ${val.toLocaleString()}
              </td>
            `;
          } else {
            return `<td class="py-2.5 px-1.5 text-center whitespace-nowrap"></td>`;
          }
        }).join('')}

        <!-- 单株 NPC 基础收益 -->
        <td class="py-2.5 px-2 text-right whitespace-nowrap text-xs font-mono font-bold text-emerald-400">
          ${m.single_npc_rev > 0 ? formatCoinsCompact(m.single_npc_rev) + ' C' : '-'}
        </td>

        <!-- 单温室全满 NPC 收益 -->
        <td class="py-2.5 px-2 text-right whitespace-nowrap text-xs font-mono font-extrabold text-amber-300 bg-amber-500/5">
          ${m.gh_max_rev > 0 ? formatCoinsCompact(m.gh_max_rev) + ' Coins' : '-'}
        </td>

        <!-- 实时 Bazaar 价格 -->
        <td class="py-2.5 px-2 text-right whitespace-nowrap text-xs font-mono text-slate-300">
          ${m.bazaar_sell_price ? Math.round(m.bazaar_sell_price).toLocaleString() + ' C' : '<span class="text-slate-600">-</span>'}
        </td>

        <!-- 操作按钮 -->
        <td class="py-2.5 px-2 text-center whitespace-nowrap">
          <button onclick="loadMutationIntoCalculator('${m.id}')" class="px-2 py-1 rounded bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/40 text-[10px] font-bold transition active:scale-95">
            精算 <i class="fa-solid fa-arrow-up ml-0.5 text-[9px]"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// 11. 一键载入目标突变至上方精算器
function loadMutationIntoCalculator(mutId) {
  const searchInput = document.getElementById('ghMutationSearchInput');
  if (searchInput) searchInput.value = '';
  populateMutationSelector('');

  const sel = document.getElementById('ghMutationSelect');
  if (sel) sel.value = mutId;
  onSelectMutation(mutId);

  // 平滑滚动回顶部计算面板
  const topPanel = document.getElementById('ghCalculatorTopSection');
  if (topPanel) {
    topPanel.scrollIntoView({ behavior: 'smooth' });
  }
}

// 12. 格式化辅助函数
function getRarityHexColor(rarity) {
  switch (rarity) {
    case 'COMMON': return '#ffffff';
    case 'UNCOMMON': return '#55ff55';
    case 'RARE': return '#5555ff';
    case 'EPIC': return '#aa00aa';
    case 'LEGENDARY': return '#ffaa00';
    case 'SPECIAL': return '#ff5555';
    default: return '#aaaaaa';
  }
}

function getCropEmoji(name) {
  const map = {
    'Wheat': '🌾',
    'Carrot': '🥕',
    'Potato': '🥔',
    'Pumpkin': '🎃',
    'Melon Slice': '🍉',
    'Cocoa Beans': '🍫',
    'Cactus': '🌵',
    'Sugar Cane': '🎋',
    'Nether Wart': '🍄',
    'Red Mushroom': '🍄',
    'Brown Mushroom': '🍄',
    'Sunflower': '🌻',
    'Moonflower': '🌙',
    'Wild Rose': '🌹'
  };
  return map[name] || '🌱';
}

function getCropZhName(name) {
  const map = {
    'Wheat': '小麦',
    'Carrot': '胡萝卜',
    'Potato': '马铃薯',
    'Pumpkin': '南瓜',
    'Melon Slice': '西瓜',
    'Cocoa Beans': '可可豆',
    'Cactus': '仙人掌',
    'Sugar Cane': '甘蔗',
    'Nether Wart': '下界疣',
    'Red Mushroom': '红蘑菇',
    'Brown Mushroom': '棕蘑菇',
    'Mushroom': '蘑菇',
    'Sunflower': '向日葵',
    'Moonflower': '月光花',
    'Wild Rose': '野玫瑰'
  };
  return map[name] || '';
}

function formatCoinsCompact(num) {
  if (!num || isNaN(num)) return '0';
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'k';
  return Math.round(num).toLocaleString();
}

function showGreenhouseToast(msg, type = 'info') {
  // 简易提示消息
  console.log(`[Greenhouse Toast] [${type}] ${msg}`);
}

// 13. 快捷微调农业幸运 (ff)
function adjustFf(delta) {
  const inp = document.getElementById('ghFfInput');
  if (!inp) return;
  const current = parseInt(inp.value) || 3100;
  const nextVal = Math.max(0, Math.min(5000, current + delta));
  inp.value = nextVal;
  GREENHOUSE_STATE.farmingFortune = nextVal;
  const disp = document.getElementById('ghFfDisplay');
  if (disp) disp.textContent = nextVal;
  recalculateGreenhouse();
  renderGreenhouseTable();
}

// 14. 表格表头排序交互
function sortGhTable(col) {
  if (GREENHOUSE_STATE.tableSortCol === col) {
    GREENHOUSE_STATE.tableSortDir = GREENHOUSE_STATE.tableSortDir === 'asc' ? 'desc' : 'asc';
  } else {
    GREENHOUSE_STATE.tableSortCol = col;
    GREENHOUSE_STATE.tableSortDir = 'desc';
  }
  renderGreenhouseTable();
}

// 15. 初始化全部用户输入事件绑定
function initGreenhouseEvents() {
  // Farming Fortune Input
  const ffInput = document.getElementById('ghFfInput');
  if (ffInput) {
    ffInput.addEventListener('input', (e) => {
      const val = Math.max(0, Math.min(5000, parseInt(e.target.value) || 0));
      GREENHOUSE_STATE.farmingFortune = val;
      const disp = document.getElementById('ghFfDisplay');
      if (disp) disp.textContent = val;
      recalculateGreenhouse();
      renderGreenhouseTable();
    });
  }

  // Greenhouse Upgrade Range
  const upRange = document.getElementById('ghUpgradeRange');
  if (upRange) {
    upRange.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value) || 0;
      GREENHOUSE_STATE.greenhouseUpgrade = val;
      const disp = document.getElementById('ghUpgradeDisplay');
      if (disp) disp.textContent = `+${val.toFixed(1)}%`;
      recalculateGreenhouse();
      renderGreenhouseTable();
    });
  }

  // Unique Crops Range
  const uniqRange = document.getElementById('ghUniqueRange');
  if (uniqRange) {
    uniqRange.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value) || 0;
      GREENHOUSE_STATE.uniqueCropsBonus = val;
      const disp = document.getElementById('ghUniqueDisplay');
      if (disp) disp.textContent = `+${val.toFixed(1)}%`;
      recalculateGreenhouse();
      renderGreenhouseTable();
    });
  }

  // Positive Buff Select
  const pBuffSel = document.getElementById('ghPositiveBuffSelect');
  if (pBuffSel) {
    pBuffSel.addEventListener('change', (e) => {
      GREENHOUSE_STATE.positiveBuff = parseFloat(e.target.value) || 0;
      recalculateGreenhouse();
      renderGreenhouseTable();
    });
  }

  // Negative Debuff Select
  const nDebuffSel = document.getElementById('ghNegativeDebuffSelect');
  if (nDebuffSel) {
    nDebuffSel.addEventListener('change', (e) => {
      GREENHOUSE_STATE.negativeDebuff = parseFloat(e.target.value) || 0;
      recalculateGreenhouse();
      renderGreenhouseTable();
    });
  }

  // Immunity Checkbox
  const immCheck = document.getElementById('ghImmunityCheck');
  if (immCheck) {
    immCheck.addEventListener('change', (e) => {
      GREENHOUSE_STATE.hasImmunity = e.target.checked;
      recalculateGreenhouse();
      renderGreenhouseTable();
    });
  }

  // Evergreen Chip Range
  const chipRange = document.getElementById('ghChipRange');
  if (chipRange) {
    chipRange.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value) || 1.0;
      GREENHOUSE_STATE.evergreenChip = val;
      const disp = document.getElementById('ghChipDisplay');
      if (disp) disp.textContent = `x${val.toFixed(2)}`;
      recalculateGreenhouse();
      renderGreenhouseTable();
    });
  }

  // Per Greenhouse Mutations Input
  const perGhInput = document.getElementById('ghPerGhInput');
  if (perGhInput) {
    perGhInput.addEventListener('input', (e) => {
      setPerGhCount(e.target.value);
    });
  }

  // Auto Calc Total Checkbox
  const autoCheck = document.getElementById('ghAutoCalcTotalCheck');
  if (autoCheck) {
    autoCheck.addEventListener('change', onAutoCalcTotalToggle);
  }

  // Total Mutations Input
  const totalInput = document.getElementById('ghTotalMutationsInput');
  if (totalInput) {
    totalInput.addEventListener('input', (e) => {
      onTotalMutationsManualChange(e.target.value);
    });
  }

  // Table Search Input
  const searchInput = document.getElementById('ghTableSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      GREENHOUSE_STATE.tableSearch = e.target.value;
      renderGreenhouseTable();
    });
  }

  // Table Rarity Select
  const raritySel = document.getElementById('ghTableRaritySelect');
  if (raritySel) {
    raritySel.addEventListener('change', (e) => {
      GREENHOUSE_STATE.tableRarityFilter = e.target.value;
      renderGreenhouseTable();
    });
  }

  // Mutation Selector Search Input
  const mutSearchInput = document.getElementById('ghMutationSearchInput');
  if (mutSearchInput) {
    mutSearchInput.addEventListener('input', (e) => {
      populateMutationSelector(e.target.value);
    });
  }
}

