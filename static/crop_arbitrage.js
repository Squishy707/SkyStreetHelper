/**
 * SkyStreetHelper - Crop Arbitrage & Panic Dump Radar Logic (alpha 0.5.0)
 * 农作物集市倾销与破发套利雷达 (应对 2026-10-30 测试服 NPC 卖价大削弱)
 * 支持多渠道买入进货 (BO, IB, T1合成)、多渠道卖出 (NPC现价, 集市挂单, 集市秒卖, 削弱底线)
 * 深度集成 NPC 每日 500M 出售上限与集市 15.00 B 流水限额风控
 */

const ALL_CROP_FAMILIES = [
  'CACTUS', 'CARROT', 'COCOA_BEANS', 'MELON_SLICE', 'MOONFLOWER',
  'RED_MUSHROOM', 'BROWN_MUSHROOM', 'NETHER_WART', 'POTATO', 'PUMPKIN',
  'SUGAR_CANE', 'SUNFLOWER', 'WHEAT', 'WILD_ROSE'
];

const ALL_CROP_TIERS = ['T0', 'T1', 'T2'];

const cropArbitrageState = {
  data: null,
  buyMode: 'bazaar_buy_order', // 'bazaar_buy_order', 'bazaar_insta_buy', 'craft_from_t1_bo', 'craft_from_t1_ib'
  sellMode: 'npc_live',        // 'npc_live', 'bazaar_sell_offer', 'bazaar_insta_sell', 'hold_until_nerf'
  selectedFamilies: new Set(['all']),
  selectedTiers: new Set(['all']),
  searchQuery: '',
  sortField: 'cap_profit',     // 'cap_profit', 'unit_profit', 'unit_roi', 'nerf_floor', 'volume', 'buy_cost'
  sortAsc: false,
  chart: null,
  loaded: false,
  isLoading: false,
  // 模拟器状态
  simCropId: 'ENCHANTED_SUGAR_CANE',
  simBuyMode: 'craft_from_t1_bo',
  simSellMode: 'npc_live'
};

// 1. 初始化入口
function initCropArbitrage() {
  if (!cropArbitrageState.loaded) {
    fetchCropArbitrageData();
  }
}

// 2. 数据获取与轮询
async function fetchCropArbitrageData(force = false) {
  cropArbitrageState.isLoading = true;
  updateCropRefreshIndicator(true);

  try {
    const res = await fetch(`/api/crops/arbitrage?_t=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
    const data = await res.json();
    cropArbitrageState.data = data;
    cropArbitrageState.loaded = true;

    renderCropArbitrageView();
  } catch (err) {
    console.error('[CropArbitrage] 数据加载失败:', err);
    showCropToast('获取农作物套利数据失败，请检查网络或后端状态', 'error');
  } finally {
    cropArbitrageState.isLoading = false;
    updateCropRefreshIndicator(false);
  }
}

function updateCropRefreshIndicator(spinning) {
  const icon = document.getElementById('cropRefreshIcon');
  if (icon) {
    if (spinning) icon.classList.add('fa-spin');
    else icon.classList.remove('fa-spin');
  }
}

// 3. 核心计算辅助器：根据当前买入模式获取单件实际买入成本
function getEffectiveBuyCost(item, buyMode = cropArbitrageState.buyMode) {
  if (item.tier === 'T2') {
    if (buyMode === 'craft_from_t1_bo') return (item.craft_bo_cost > 0) ? item.craft_bo_cost : item.buy_order_price;
    if (buyMode === 'craft_from_t1_ib') return (item.craft_ib_cost > 0) ? item.craft_ib_cost : item.insta_buy_price;
  }
  if (buyMode === 'bazaar_insta_buy') return item.insta_buy_price;
  return item.buy_order_price;
}

// 4. 核心计算辅助器：根据当前卖出渠道获取单件实际卖出收入
function getEffectiveSellPrice(item, sellMode = cropArbitrageState.sellMode) {
  if (sellMode === 'npc_live') return item.npc_live;
  if (sellMode === 'hold_until_nerf') return item.npc_nerfed;
  if (sellMode === 'bazaar_sell_offer') return item.sell_offer_price;
  if (sellMode === 'bazaar_insta_sell') return item.insta_sell_price;
  return item.npc_live;
}

// 5. 主渲染器
function renderCropArbitrageView() {
  if (!cropArbitrageState.data) return;

  renderCropSummaryKPIs();
  renderCropArbitrageChart();
  updateCropFilterButtonUI();
  renderCropArbitrageTable();
}

// 6. 渲染核心概览 KPI 卡片
function renderCropSummaryKPIs() {
  const summary = cropArbitrageState.data.summary;
  if (!summary) return;

  const panicValEl = document.getElementById('cropPanicVal');
  const panicBadgeEl = document.getElementById('cropPanicBadge');
  const panicAdviceEl = document.getElementById('cropPanicAdvice');
  if (panicValEl) panicValEl.textContent = `${summary.panic_index} / 100`;
  if (panicBadgeEl) {
    panicBadgeEl.textContent = summary.panic_level;
    panicBadgeEl.style.color = summary.panic_color;
  }
  if (panicAdviceEl) panicAdviceEl.textContent = summary.panic_advice;

  // 计算当前买卖组合下的最优项目
  let bestCapProfit = 0;
  let bestCapItem = null;
  let profitableCount = 0;
  let permanentSafeCount = 0;

  cropArbitrageState.data.items.forEach(item => {
    const buyCost = getEffectiveBuyCost(item);
    const sellPrice = getEffectiveSellPrice(item);
    const profit = sellPrice - buyCost;
    if (profit > 0 && buyCost > 0) {
      profitableCount++;
      const capUnits = (sellPrice > 0) ? (500_000_000.0 / sellPrice) : 0;
      const capProfit = capUnits * profit;
      if (capProfit > bestCapProfit) {
        bestCapProfit = capProfit;
        bestCapItem = item;
      }
    }
    if (item.npc_nerfed >= buyCost && buyCost > 0) {
      permanentSafeCount++;
    }
  });

  const ibOppsEl = document.getElementById('cropKpiIbOpps');
  const boOppsEl = document.getElementById('cropKpiBoOpps');
  const maxRoiEl = document.getElementById('cropKpiMaxRoi');
  const maxRoiItemEl = document.getElementById('cropKpiMaxRoiItem');
  const safeCountEl = document.getElementById('cropKpiSafeCount');

  if (ibOppsEl) ibOppsEl.textContent = `${profitableCount} 款盈利`;
  if (boOppsEl) boOppsEl.textContent = bestCapProfit > 0 ? `+${(bestCapProfit / 1e6).toFixed(1)}M` : '--';
  if (maxRoiEl) {
    if (bestCapItem) {
      const bCost = getEffectiveBuyCost(bestCapItem);
      const sPrice = getEffectiveSellPrice(bestCapItem);
      const roi = bCost > 0 ? ((sPrice - bCost) / bCost) * 100 : 0;
      maxRoiEl.textContent = `+${roi.toFixed(1)}%`;
    } else {
      maxRoiEl.textContent = '--%';
    }
  }
  if (maxRoiItemEl) maxRoiItemEl.textContent = bestCapItem ? `日利顶格: ${bestCapItem.name}` : '暂无显著套利标的';
  if (safeCountEl) safeCountEl.textContent = `${permanentSafeCount} 款安全垫`;

  const updateTimeEl = document.getElementById('cropDataUpdateTime');
  if (updateTimeEl) updateTimeEl.textContent = cropArbitrageState.data.updated_at;
}

// 7. 渲染套利对比图表 (Chart.js)
function renderCropArbitrageChart() {
  const canvas = document.getElementById('cropArbitrageChart');
  if (!canvas || typeof Chart === 'undefined') return;

  let items = [...cropArbitrageState.data.items];

  // 计算当前模式的单件净利润与 500M 满额净纯利
  const computedList = items.map(item => {
    const buyCost = getEffectiveBuyCost(item);
    const sellPrice = getEffectiveSellPrice(item);
    const unitProfit = sellPrice - buyCost;
    const unitRoi = buyCost > 0 ? (unitProfit / buyCost) * 100 : 0;
    const capUnits = (sellPrice > 0) ? (500_000_000.0 / sellPrice) : 0;
    const capProfitM = (capUnits * unitProfit) / 1e6; // 百万 Coins
    return {
      item,
      buyCost,
      sellPrice,
      unitProfit,
      unitRoi,
      capProfitM: Math.max(0, capProfitM)
    };
  });

  computedList.sort((a, b) => b.capProfitM - a.capProfitM);
  const topItems = computedList.slice(0, 10);

  const labels = topItems.map(x => `${x.item.icon} ${x.item.name}`);
  const capProfitData = topItems.map(x => x.capProfitM);
  const roiData = topItems.map(x => Math.max(0, x.unitRoi));

  const isDark = document.documentElement.classList.contains('dark');
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';
  const textColor = isDark ? '#94a3b8' : '#475569';

  if (cropArbitrageState.chart) {
    cropArbitrageState.chart.destroy();
  }

  const ctx = canvas.getContext('2d');
  cropArbitrageState.chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: '💰 500M NPC 满额套现净利润 (M Coins)',
          data: capProfitData,
          backgroundColor: 'rgba(245, 158, 11, 0.8)',
          borderColor: '#f59e0b',
          borderWidth: 1.5,
          borderRadius: 6
        },
        {
          label: '📈 单件投资回报率 (ROI %)',
          data: roiData,
          backgroundColor: 'rgba(59, 130, 246, 0.75)',
          borderColor: '#3b82f6',
          borderWidth: 1.5,
          borderRadius: 6
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: textColor,
            font: { size: 11, weight: 'bold' },
            boxWidth: 14
          }
        },
        tooltip: {
          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)',
          titleColor: isDark ? '#f8fafc' : '#0f172a',
          bodyColor: isDark ? '#cbd5e1' : '#334155',
          borderColor: isDark ? '#334155' : '#cbd5e1',
          borderWidth: 1,
          padding: 10
        }
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: { color: textColor, font: { family: 'ui-monospace, monospace', size: 10 } }
        },
        y: {
          grid: { display: false },
          ticks: { color: textColor, font: { size: 11, weight: '600' } }
        }
      }
    }
  });
}

// 8. 渲染核心套利精算大表 (Master Arbitrage Table)
function renderCropArbitrageTable() {
  const tbody = document.getElementById('cropTableBody');
  const countBadge = document.getElementById('cropMatchedCountBadge');
  if (!tbody || !cropArbitrageState.data) return;

  let items = [...cropArbitrageState.data.items];

  // 1. 过滤：按品类 (复选组合)
  const isAllFamilies = cropArbitrageState.selectedFamilies.has('all');
  if (!isAllFamilies) {
    items = items.filter(x => cropArbitrageState.selectedFamilies.has(x.family));
  }

  // 2. 过滤：按形态等级 (复选组合 T0, T1, T2)
  const isAllTiers = cropArbitrageState.selectedTiers.has('all');
  if (!isAllTiers) {
    items = items.filter(x => cropArbitrageState.selectedTiers.has(x.tier));
  }

  // 3. 过滤：按搜索关键词
  if (cropArbitrageState.searchQuery) {
    const q = cropArbitrageState.searchQuery.toLowerCase().trim();
    items = items.filter(x => 
      (x.name && x.name.toLowerCase().includes(q)) || 
      (x.id && x.id.toLowerCase().includes(q)) ||
      (x.family && x.family.toLowerCase().includes(q))
    );
  }

  // 4. 排序：针对当前选中的 buyMode 与 sellMode 动态计算排序值
  const field = cropArbitrageState.sortField;
  const asc = cropArbitrageState.sortAsc;

  items.sort((a, b) => {
    const costA = getEffectiveBuyCost(a);
    const revA = getEffectiveSellPrice(a);
    const pnlA = revA - costA;
    const roiA = costA > 0 ? (pnlA / costA) * 100 : 0;
    const capProfitA = (revA > 0) ? (500_000_000.0 / revA) * pnlA : 0;
    const nerfPnlA = a.npc_nerfed - costA;

    const costB = getEffectiveBuyCost(b);
    const revB = getEffectiveSellPrice(b);
    const pnlB = revB - costB;
    const roiB = costB > 0 ? (pnlB / costB) * 100 : 0;
    const capProfitB = (revB > 0) ? (500_000_000.0 / revB) * pnlB : 0;
    const nerfPnlB = b.npc_nerfed - costB;

    let va = 0, vb = 0;
    if (field === 'cap_profit') { va = capProfitA; vb = capProfitB; }
    else if (field === 'unit_profit') { va = pnlA; vb = pnlB; }
    else if (field === 'unit_roi') { va = roiA; vb = roiB; }
    else if (field === 'nerf_floor') { va = nerfPnlA; vb = nerfPnlB; }
    else if (field === 'volume') { va = a.buy_volume + a.sell_volume; vb = b.buy_volume + b.sell_volume; }
    else if (field === 'buy_cost') { va = costA; vb = costB; }
    else { va = capProfitA; vb = capProfitB; }

    if (va === vb) return 0;
    return asc ? (va - vb) : (vb - va);
  });

  if (countBadge) countBadge.textContent = `${items.length} / ${cropArbitrageState.data.items.length}`;

  if (items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="py-12 text-center text-slate-500 text-sm">
          <i class="fa-solid fa-wheat-awn-circle-exclamation text-3xl mb-2 text-slate-600 block"></i>
          未找到符合当前多选条件的农作物项，请尝试勾选更多品类或等级
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = items.map(item => {
    const buyCost = getEffectiveBuyCost(item);
    const sellPrice = getEffectiveSellPrice(item);
    const unitProfit = roundCoins(sellPrice - buyCost);
    const unitRoi = buyCost > 0 ? roundCoins((unitProfit / buyCost) * 100) : 0.0;
    const isProfit = unitProfit > 0;

    // 500M NPC 满额测算
    const capUnits = (sellPrice > 0) ? Math.floor(500_000_000.0 / sellPrice) : 0;
    const capCost = roundCoins(capUnits * buyCost);
    const capProfit = roundCoins(capUnits * unitProfit);
    const bzTurnoverPct = roundCoins((capCost / 15_000_000_000.0) * 100);

    // 烂在手里底线测算 (改版削弱后 NPC 价格 - 当前买入成本)
    const nerfPnl = roundCoins(item.npc_nerfed - buyCost);
    const nerfRoi = buyCost > 0 ? roundCoins((nerfPnl / buyCost) * 100) : 0.0;
    const isNerfSafe = nerfPnl >= 0;

    // 稀有度分级色彩配置 (T0 仅图标边框为灰色，底色与图标保持原色; T1 绿色; T2 蓝色)
    let tierConfig = {
      iconBoxClass: 'crop-tier-t0-icon bg-[#111520] border-slate-700/60',
      nameClass: 'crop-tier-t0-name text-slate-300 font-bold',
      pillClass: 'crop-tier-t0-pill bg-slate-800/60 text-slate-400 border-slate-700',
      pillLabel: 'T0 Standard',
      badgeHtml: ''
    };

    if (item.tier === 'T1') {
      tierConfig = {
        iconBoxClass: 'crop-tier-t1-icon bg-emerald-950/30 border-emerald-500/50 shadow-sm shadow-emerald-950/30',
        nameClass: 'crop-tier-t1-name text-emerald-400 font-bold',
        pillClass: 'crop-tier-t1-pill bg-emerald-500/15 text-emerald-300 border border-emerald-500/40',
        pillLabel: 'T1 Enchanted',
        badgeHtml: '<span class="crop-corner-badge crop-corner-t1" title="T1 附魔形态 (Enchanted)">✨</span>'
      };
    } else if (item.tier === 'T2') {
      tierConfig = {
        iconBoxClass: 'crop-tier-t2-icon bg-blue-950/30 border-blue-500/50 shadow-sm shadow-blue-950/30',
        nameClass: 'crop-tier-t2-name text-blue-400 font-bold',
        pillClass: 'crop-tier-t2-pill bg-blue-500/15 text-blue-300 border border-blue-500/40',
        pillLabel: 'T2 Compacted',
        badgeHtml: '<span class="crop-corner-badge crop-corner-t2" title="T2 紧实形态 (Compacted)">📦</span>'
      };
    }

    const tierPill = `<span class="px-1.5 py-0.2 rounded text-[10px] font-bold border ${tierConfig.pillClass}">${tierConfig.pillLabel}</span>`;

    // T2 合成对比胶囊
    let craftComparisonHtml = '';
    if (item.tier === 'T2' && item.craft_bo_cost > 0) {
      const saving = item.craft_bo_saving;
      if (saving > 0) {
        craftComparisonHtml = `
          <div class="mt-1 text-[10px] flex items-center gap-1 font-mono">
            <span class="text-slate-400">160×T1: ${formatCompactNum(item.craft_bo_cost)}</span>
            <span class="px-1.5 py-0.2 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold" title="购买160个T1原料手动合成较直接买T2可立省 ${saving.toLocaleString()} Coins">
              ★ 合成立省 +${formatCompactNum(saving)}
            </span>
          </div>
        `;
      } else {
        craftComparisonHtml = `
          <div class="mt-1 text-[10px] flex items-center gap-1 font-mono text-slate-500">
            <span>160×T1: ${formatCompactNum(item.craft_bo_cost)}</span>
            <span>(直买省 +${formatCompactNum(-saving)})</span>
          </div>
        `;
      }
    }

    // 卖出渠道标签说明
    let sellChannelBadge = '';
    if (cropArbitrageState.sellMode === 'npc_live') sellChannelBadge = '<span class="text-[10px] text-emerald-400 font-sans font-bold">NPC 现行收购</span>';
    else if (cropArbitrageState.sellMode === 'hold_until_nerf') sellChannelBadge = '<span class="text-[10px] text-purple-400 font-sans font-bold">削弱后新 NPC</span>';
    else if (cropArbitrageState.sellMode === 'bazaar_sell_offer') sellChannelBadge = '<span class="text-[10px] text-blue-400 font-sans font-bold">集市挂单售出</span>';
    else sellChannelBadge = '<span class="text-[10px] text-amber-400 font-sans font-bold">集市秒卖 (价低)</span>';

    return `
      <tr class="hover:bg-slate-800/40 border-b border-[#262e45]/50 transition group">
        <!-- 1. 标的与形态 (T0 灰色, T1 绿色, T2 蓝色) -->
        <td class="py-3 px-3.5 whitespace-nowrap">
          <div class="flex items-center space-x-2.5">
            <span class="relative w-8 h-8 rounded-lg border flex items-center justify-center text-base shrink-0 shadow-sm select-none ${tierConfig.iconBoxClass}">
              <span>${item.icon}</span>
              ${tierConfig.badgeHtml}
            </span>
            <div class="min-w-0">
              <div class="flex items-center space-x-1.5 flex-nowrap">
                <span class="text-xs sm:text-sm font-semibold truncate ${tierConfig.nameClass}">${item.name}</span>
                ${tierPill}
              </div>
              <div class="text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
                <span class="truncate">${item.id}</span>
                <span class="text-slate-600">•</span>
                <span>= ${item.multiplier.toLocaleString()} base</span>
              </div>
            </div>
          </div>
        </td>

        <!-- 2. 买入成本 (含 T2 vs T1 合成对比) -->
        <td class="py-3 px-3 whitespace-nowrap font-mono text-xs">
          <div class="flex flex-col">
            <div class="flex items-baseline space-x-1.5">
              <span class="font-extrabold text-blue-400 text-sm tabular-nums">${buyCost > 0 ? buyCost.toLocaleString() : '--'}</span>
              <span class="text-[10px] text-slate-500">Coins</span>
            </div>
            ${craftComparisonHtml}
          </div>
        </td>

        <!-- 3. 卖出变现价格 -->
        <td class="py-3 px-3 whitespace-nowrap font-mono text-xs">
          <div class="flex flex-col space-y-0.5">
            <div class="flex items-baseline space-x-1.5">
              <span class="font-extrabold text-slate-200 text-sm tabular-nums">${sellPrice > 0 ? sellPrice.toLocaleString() : '--'}</span>
              <span class="text-[10px] text-slate-500">Coins</span>
            </div>
            <div>${sellChannelBadge}</div>
          </div>
        </td>

        <!-- 4. 单件净盈亏 (Unit PnL & ROI) -->
        <td class="py-3 px-3 whitespace-nowrap font-mono text-right text-xs">
          <div>
            <span class="font-black text-sm block tabular-nums ${isProfit ? 'text-emerald-400' : 'text-rose-400'}">
              ${isProfit ? '+' : ''}${unitProfit.toLocaleString()} Coins
            </span>
            <span class="text-[10px] font-bold px-1.5 py-0.2 rounded border inline-block mt-0.5 ${
              isProfit 
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' 
                : 'bg-rose-500/15 text-rose-300 border-rose-500/30'
            }">
              ${isProfit ? '+' : ''}${unitRoi.toFixed(1)}% ROI
            </span>
          </div>
        </td>

        <!-- 5. 500M NPC 满额纯利 (限额最大化) -->
        <td class="py-3 px-3 whitespace-nowrap font-mono text-right text-xs">
          <div>
            <span class="font-black text-sm block tabular-nums ${capProfit > 0 ? 'text-amber-300' : 'text-slate-500'}">
              ${capProfit > 0 ? '+' + formatCoinsCompact(capProfit) : '0 C'}
            </span>
            <span class="text-[10px] text-slate-400 block mt-0.5">
              需本金: ${formatCoinsCompact(capCost)}
            </span>
          </div>
        </td>

        <!-- 6. 改版穿仓底线 (烂在手里直到削弱) -->
        <td class="py-3 px-3 whitespace-nowrap font-mono text-center text-xs" title="正式服现行: ${item.npc_live.toLocaleString()} C | 10.30测试: ${(item.npc_nerf_v1 || item.npc_nerfed).toLocaleString()} C | 11.03二次大砍: ${(item.npc_nerf_v2 || item.npc_nerfed).toLocaleString()} C">
          <div>
            <span class="font-bold text-xs block ${isNerfSafe ? 'text-emerald-400' : 'text-rose-400'}">
              ${isNerfSafe ? '🛡️ 保底 +' : '⚠️ 穿仓 '}${nerfPnl.toLocaleString()} C
            </span>
            <span class="text-[10px] ${isNerfSafe ? 'text-emerald-500' : 'text-rose-500'}">
              (${isNerfSafe ? '+' : ''}${nerfRoi.toFixed(1)}% 11.03新底)
            </span>
          </div>
        </td>

        <!-- 7. 24h 成交量 / 15B 流水占比 -->
        <td class="py-3 px-3 whitespace-nowrap font-mono text-right text-xs">
          <div class="flex flex-col items-end space-y-0.5">
            <span class="text-slate-300 text-[11px]">${(item.buy_volume + item.sell_volume).toLocaleString()}</span>
            <span class="text-[10px] text-slate-500 font-sans">
              满额占流水: <strong class="text-indigo-400">${bzTurnoverPct}%</strong>
            </span>
          </div>
        </td>

        <!-- 8. 单车精算与一键盯盘按钮 -->
        <td class="py-3 px-3 whitespace-nowrap text-right">
          <div class="flex items-center justify-end space-x-1.5">
            <button onclick="openCropSimModal('${item.id}')" class="px-2 py-1 rounded bg-[#111520] hover:bg-indigo-600 border border-[#262e45] hover:border-indigo-500 text-slate-300 hover:text-white text-xs font-semibold transition active:scale-95 shadow-sm" title="一键模拟不同采购模式、出货渠道及 500M 满额收益">
              <i class="fa-solid fa-calculator mr-1"></i>精算
            </button>
            <button onclick="openOrderTrackerWithPrefill('${item.id}', '${item.name}', ${buyCost}, 'buy_order')" class="px-2 py-1 rounded bg-amber-500/10 hover:bg-amber-600 border border-amber-500/30 hover:border-amber-500 text-amber-300 hover:text-white text-xs font-semibold transition active:scale-95 shadow-sm" title="加入挂单雷达实时盯盘与被压价提醒">
              <i class="fa-solid fa-crosshairs mr-1"></i>盯盘
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// 9. 状态交互函数
function setCropBuyMode(mode) {
  cropArbitrageState.buyMode = mode;
  const btns = document.querySelectorAll('.crop-buymode-btn');
  btns.forEach(btn => {
    if (btn.getAttribute('data-buymode') === mode) {
      btn.className = "crop-buymode-btn active px-2.5 py-1.5 rounded-lg text-xs font-bold transition bg-indigo-600 text-white shadow-sm border border-indigo-500";
    } else {
      btn.className = "crop-buymode-btn px-2.5 py-1.5 rounded-lg text-xs font-bold transition bg-[#181d2c] text-slate-300 hover:text-white border border-[#262e45]";
    }
  });

  renderCropSummaryKPIs();
  renderCropArbitrageChart();
  renderCropArbitrageTable();
}

function setCropSellMode(mode) {
  cropArbitrageState.sellMode = mode;
  const btns = document.querySelectorAll('.crop-sellmode-btn');
  btns.forEach(btn => {
    if (btn.getAttribute('data-sellmode') === mode) {
      let activeBg = "bg-indigo-600";
      if (mode === 'npc_live') activeBg = "bg-emerald-600";
      else if (mode === 'hold_until_nerf') activeBg = "bg-purple-600";
      btn.className = `crop-sellmode-btn active px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${activeBg} text-white shadow-sm border border-transparent`;
    } else {
      btn.className = "crop-sellmode-btn px-2.5 py-1.5 rounded-lg text-xs font-bold transition bg-[#181d2c] text-slate-300 hover:text-white border border-[#262e45]";
    }
  });

  renderCropSummaryKPIs();
  renderCropArbitrageChart();
  renderCropArbitrageTable();
}

// 多选组合：作物品类
function toggleCropFamilyFilter(family) {
  if (family === 'all') {
    cropArbitrageState.selectedFamilies = new Set(['all']);
  } else {
    if (cropArbitrageState.selectedFamilies.has('all')) {
      cropArbitrageState.selectedFamilies = new Set([family]);
    } else {
      if (cropArbitrageState.selectedFamilies.has(family)) {
        cropArbitrageState.selectedFamilies.delete(family);
        if (cropArbitrageState.selectedFamilies.size === 0) {
          cropArbitrageState.selectedFamilies = new Set(['all']);
        }
      } else {
        cropArbitrageState.selectedFamilies.add(family);
        if (cropArbitrageState.selectedFamilies.size === ALL_CROP_FAMILIES.length) {
          cropArbitrageState.selectedFamilies = new Set(['all']);
        }
      }
    }
  }

  updateCropFilterButtonUI();
  renderCropArbitrageTable();
}

// 多选组合：压缩等级
function toggleCropTierFilter(tier) {
  if (tier === 'all') {
    cropArbitrageState.selectedTiers = new Set(['all']);
  } else {
    if (cropArbitrageState.selectedTiers.has('all')) {
      cropArbitrageState.selectedTiers = new Set([tier]);
    } else {
      if (cropArbitrageState.selectedTiers.has(tier)) {
        cropArbitrageState.selectedTiers.delete(tier);
        if (cropArbitrageState.selectedTiers.size === 0) {
          cropArbitrageState.selectedTiers = new Set(['all']);
        }
      } else {
        cropArbitrageState.selectedTiers.add(tier);
        if (cropArbitrageState.selectedTiers.size === ALL_CROP_TIERS.length) {
          cropArbitrageState.selectedTiers = new Set(['all']);
        }
      }
    }
  }

  updateCropFilterButtonUI();
  renderCropArbitrageTable();
}

// 更新多选按钮高亮 UI
function updateCropFilterButtonUI() {
  const isAllFamilies = cropArbitrageState.selectedFamilies.has('all') || cropArbitrageState.selectedFamilies.size === ALL_CROP_FAMILIES.length;
  const famBtns = document.querySelectorAll('.crop-fam-btn');
  famBtns.forEach(btn => {
    const f = btn.getAttribute('data-family');
    const isActive = (f === 'all') ? isAllFamilies : (!isAllFamilies && cropArbitrageState.selectedFamilies.has(f));
    if (isActive) {
      btn.className = "crop-fam-btn active px-2.5 py-1 rounded-md text-[11px] font-bold transition bg-indigo-600 text-white shadow-sm border border-indigo-500";
    } else {
      btn.className = "crop-fam-btn px-2.5 py-1 rounded-md text-[11px] font-bold transition bg-[#111520] text-slate-300 hover:text-white border border-[#262e45]";
    }
  });

  const isAllTiers = cropArbitrageState.selectedTiers.has('all') || cropArbitrageState.selectedTiers.size === ALL_CROP_TIERS.length;
  const tierBtns = document.querySelectorAll('.crop-tier-btn');
  tierBtns.forEach(btn => {
    const t = btn.getAttribute('data-tier');
    const isActive = (t === 'all') ? isAllTiers : (!isAllTiers && cropArbitrageState.selectedTiers.has(t));
    if (isActive) {
      if (t === 'T0') {
        btn.className = "crop-tier-btn active px-2.5 py-1 rounded-md text-[11px] font-bold transition bg-slate-700 text-slate-200 shadow-sm border border-slate-500";
      } else if (t === 'T1') {
        btn.className = "crop-tier-btn active px-2.5 py-1 rounded-md text-[11px] font-bold transition bg-emerald-600 text-white shadow-sm border border-emerald-500";
      } else if (t === 'T2') {
        btn.className = "crop-tier-btn active px-2.5 py-1 rounded-md text-[11px] font-bold transition bg-blue-600 text-white shadow-sm border border-blue-500";
      } else {
        btn.className = "crop-tier-btn active px-2.5 py-1 rounded-md text-[11px] font-bold transition bg-indigo-600 text-white shadow-sm border border-indigo-500";
      }
    } else {
      btn.className = "crop-tier-btn px-2.5 py-1 rounded-md text-[11px] font-bold transition bg-[#111520] text-slate-300 hover:text-white border border-[#262e45]";
    }
  });
}

function onCropSearchInput() {
  const inp = document.getElementById('cropSearchInput');
  if (inp) {
    cropArbitrageState.searchQuery = inp.value;
    renderCropArbitrageTable();
  }
}

function setCropSort(field) {
  if (cropArbitrageState.sortField === field) {
    cropArbitrageState.sortAsc = !cropArbitrageState.sortAsc;
  } else {
    cropArbitrageState.sortField = field;
    cropArbitrageState.sortAsc = false;
  }
  renderCropArbitrageTable();
}

// 10. 搬砖收益模拟器 (Calculator Modal)
function openCropSimModal(cropId) {
  cropArbitrageState.simCropId = cropId;
  cropArbitrageState.simBuyMode = cropArbitrageState.buyMode;
  cropArbitrageState.simSellMode = cropArbitrageState.sellMode;

  const modal = document.getElementById('cropSimModal');
  if (!modal || !cropArbitrageState.data) return;

  const item = cropArbitrageState.data.items.find(x => x.id === cropId);
  if (!item) return;

  document.getElementById('cropSimTitle').innerHTML = `${item.icon} ${item.name} 搬砖精算器`;
  
  // 更新买卖方式选择器 UI
  updateSimSelectorUI();

  // 默认填入 1 背包 (2,240 件)
  document.getElementById('cropSimQtyInput').value = "2240";
  recalcCropSim();

  modal.classList.remove('hidden');
}

function closeCropSimModal() {
  const modal = document.getElementById('cropSimModal');
  if (modal) modal.classList.add('hidden');
}

function updateSimSelectorUI() {
  const item = cropArbitrageState.data.items.find(x => x.id === cropArbitrageState.simCropId);
  if (!item) return;

  const craftBtn = document.getElementById('simBuyCraftBtn');
  if (craftBtn) {
    if (item.tier === 'T2') {
      craftBtn.style.display = 'inline-block';
      craftBtn.textContent = `📦 160×T1合成 (${item.t1_name})`;
    } else {
      craftBtn.style.display = 'none';
      if (cropArbitrageState.simBuyMode.startsWith('craft_')) {
        cropArbitrageState.simBuyMode = 'bazaar_buy_order';
      }
    }
  }

  // 高亮选中按钮
  const buyBtns = document.querySelectorAll('.sim-buy-btn');
  buyBtns.forEach(btn => {
    if (btn.getAttribute('data-simbuy') === cropArbitrageState.simBuyMode) {
      btn.className = "sim-buy-btn px-2.5 py-1.5 rounded-lg text-xs font-bold transition bg-indigo-600 text-white shadow-sm";
    } else {
      btn.className = "sim-buy-btn px-2.5 py-1.5 rounded-lg text-xs font-bold transition bg-[#181d2c] text-slate-300 hover:text-white border border-[#262e45]";
    }
  });

  const sellBtns = document.querySelectorAll('.sim-sell-btn');
  sellBtns.forEach(btn => {
    if (btn.getAttribute('data-simsell') === cropArbitrageState.simSellMode) {
      btn.className = "sim-sell-btn px-2.5 py-1.5 rounded-lg text-xs font-bold transition bg-emerald-600 text-white shadow-sm";
    } else {
      btn.className = "sim-sell-btn px-2.5 py-1.5 rounded-lg text-xs font-bold transition bg-[#181d2c] text-slate-300 hover:text-white border border-[#262e45]";
    }
  });
}

function setSimBuyMode(mode) {
  cropArbitrageState.simBuyMode = mode;
  updateSimSelectorUI();
  recalcCropSim();
}

function setSimSellMode(mode) {
  cropArbitrageState.simSellMode = mode;
  updateSimSelectorUI();
  recalcCropSim();
}

function setCropSimQtyPreset(qty) {
  const inp = document.getElementById('cropSimQtyInput');
  if (inp) {
    inp.value = qty;
    recalcCropSim();
  }
}

function setCropSimQtyMax500M() {
  if (!cropArbitrageState.data) return;
  const item = cropArbitrageState.data.items.find(x => x.id === cropArbitrageState.simCropId);
  if (!item) return;

  const sellPrice = getEffectiveSellPrice(item, cropArbitrageState.simSellMode);
  if (sellPrice <= 0) return;

  const maxQty = Math.floor(500_000_000.0 / sellPrice);
  const inp = document.getElementById('cropSimQtyInput');
  if (inp) {
    inp.value = maxQty;
    recalcCropSim();
  }
}

function recalcCropSim() {
  if (!cropArbitrageState.data) return;
  const item = cropArbitrageState.data.items.find(x => x.id === cropArbitrageState.simCropId);
  if (!item) return;

  const qty = parseInt(document.getElementById('cropSimQtyInput').value) || 0;
  const unitBuyCost = getEffectiveBuyCost(item, cropArbitrageState.simBuyMode);
  const unitSellPrice = getEffectiveSellPrice(item, cropArbitrageState.simSellMode);

  const totalCost = qty * unitBuyCost;
  const totalRev = qty * unitSellPrice;
  const netProfit = totalRev - totalCost;
  const roi = totalCost > 0 ? ((netProfit / totalCost) * 100) : 0;

  // 额度与流水占用
  const npc500mPct = Math.min(100.0, (totalRev / 500_000_000.0) * 100);
  const bz15bPct = (totalCost / 15_000_000_000.0) * 100;

  document.getElementById('cropSimUnitPriceDisplay').textContent = `${unitBuyCost.toLocaleString()} Coins / 件`;
  document.getElementById('cropSimSellPriceDisplay').textContent = `${unitSellPrice.toLocaleString()} Coins / 件`;
  document.getElementById('cropSimTotalCostDisplay').textContent = `${Math.round(totalCost).toLocaleString()} Coins`;
  document.getElementById('cropSimTotalRevDisplay').textContent = `${Math.round(totalRev).toLocaleString()} Coins`;

  const profitEl = document.getElementById('cropSimNetProfitDisplay');
  if (profitEl) {
    profitEl.textContent = `${netProfit >= 0 ? '+' : ''}${Math.round(netProfit).toLocaleString()} Coins (${roi.toFixed(1)}% ROI)`;
    profitEl.className = `font-mono font-black text-base ${netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;
  }

  // 额度进度展示
  const npcMeterEl = document.getElementById('cropSimNpcMeterText');
  const npcBarEl = document.getElementById('cropSimNpcMeterBar');
  if (npcMeterEl) npcMeterEl.textContent = `${(totalRev / 1e6).toFixed(1)}M / 500.0M (${npc500mPct.toFixed(1)}%)`;
  if (npcBarEl) npcBarEl.style.width = `${Math.min(100, npc500mPct)}%`;

  const bzMeterEl = document.getElementById('cropSimBzMeterText');
  const bzBarEl = document.getElementById('cropSimBzMeterBar');
  if (bzMeterEl) bzMeterEl.textContent = `${(totalCost / 1e6).toFixed(1)}M / 15,000M (${bz15bPct.toFixed(2)}%)`;
  if (bzBarEl) bzBarEl.style.width = `${Math.min(100, bz15bPct * 5)}%`; // 稍微视觉放大一点
}

// 辅助工具：数值格式化
function roundCoins(num) {
  return Math.round(num * 10) / 10;
}

function formatCompactNum(num) {
  if (num >= 1e6) return (num / 1e6).toFixed(1) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(1) + 'k';
  return Math.round(num).toString();
}

function showCropToast(msg, type = 'info') {
  if (typeof showToast === 'function') {
    showToast(msg, type);
  } else {
    alert(msg);
  }
}

// ==============================================================================
// 10. Crop Nerf & Arbitrage Mechanism Modal Handlers
// ==============================================================================
function openCropNerfModal() {
  const modal = document.getElementById('cropNerfModal');
  if (modal) modal.classList.remove('hidden');
}

function closeCropNerfModal() {
  const modal = document.getElementById('cropNerfModal');
  if (modal) modal.classList.add('hidden');
}
