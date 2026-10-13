/**
 * SkyBlock Gemstone Flipper Pro - Frontend Logic
 * Real-time API sync, Chart.js visualizations, filtering, dual selling modes, and simulator modal.
 */

// Global State
let appState = {
  forges: 1,
  hotmLevel: 7,
  quickForgeLevel: 20,
  coleActive: false,
  taxRate: 0.01,
  sellingMode: 'OFFER', // 'OFFER' (Sell Offer - Main) or 'INSTANT' (Instant Sell - Panic Dump)
  selectedCNs: new Set([5, 3, 2, 1, 0, -1]), // Global multi-checkbox set
  selectedQualities: new Set(['FLAWED']), // Default only T2 Flawed selected
  selectedGems: new Set(['TOPAZ', 'AMBER', 'SAPPHIRE', 'JADE', 'AMETHYST', 'JASPER', 'RUBY', 'AQUAMARINE', 'ONYX', 'CITRINE', 'PERIDOT', 'OPAL']),
  batchSliderTier: 'FLAWED', // Decoupled batch forge raw material tier (FLAWED / FINE / ROUGH)
  currentTheme: 'light', // Default to Light Mode (白色界面)
  tierFilter: 'FLAWED',
  gemFilter: 'all',
  searchQuery: '',
  sortKey: 'profit',
  sortAsc: false,
  autoRefreshInterval: 0, // Default to OFF as requested
  autoRefreshTimer: null,
  activeChartTab: 'leaderboard',
  chartInstance: null,
  lastCalculationData: null,
  currentSimGem: null,
  currentSimTier: 'FLAWED',
  currentQuantity: 32000,
  currentQuantityMultiplier: 1,
  lastUpdatedMs: null
};

// 12 Gemstones Ordered by Complexity (S -> GTMS)
const GEM_LIST = [
  { key: 'TOPAZ', name: 'Topaz', name_cn: '黄玉', icon: '✧', color: '#fbbf24', stat: 'Pristine', grade: 'S级: 速刷', desc: 'Magma Barrage / 击杀怪放水晶 / 无限刷' },
  { key: 'AMBER', name: 'Amber', name_cn: '琥珀', icon: '⸕', color: '#f59e0b', stat: 'Mining Speed', grade: 'S级: 速刷', desc: 'Goblin Queen / 持King\'s Scent免费无限刷' },
  { key: 'SAPPHIRE', name: 'Sapphire', name_cn: '蓝宝石', icon: '✎', color: '#38bdf8', stat: 'Intelligence', grade: 'A级: 蓝宝石', desc: 'Precursor City (需Apparatus/约1M成本)' },
  { key: 'JADE', name: 'Jade', name_cn: '翡翠', icon: '☘', color: '#22c55e', stat: 'Mining Fortune', grade: 'B级: 慢刷', desc: 'Mines of Divan (搜寻4件矿工工具解密)' },
  { key: 'AMETHYST', name: 'Amethyst', name_cn: '紫水晶', icon: '❈', color: '#a855f7', stat: 'Defense', grade: 'B级: 慢刷', desc: 'Jungle Temple (需Jungle Key钥匙跑酷)' },
  { key: 'JASPER', name: 'Jasper', name_cn: '碧玉', icon: '❁', color: '#f43f5e', stat: 'Strength', grade: 'C级: 限跑水晶', desc: 'Nucleus Run 跑水晶偶得 / 冰川矿井开箱' },
  { key: 'RUBY', name: 'Ruby', name_cn: '红宝石', icon: '❤', color: '#ef4444', stat: 'Health', grade: 'C级: 限跑水晶', desc: 'Nucleus Run 跑水晶偶得 / 冰川矿井开箱' },
  { key: 'AQUAMARINE', name: 'Aquamarine', name_cn: '海蓝宝石', icon: '☂', color: '#06b6d4', stat: 'Fishing Speed', grade: 'GTMS only', desc: '仅限冰川隧道矿井 (Glacite Mineshaft)' },
  { key: 'ONYX', name: 'Onyx', name_cn: '缟玛瑙', icon: '☠', color: '#64748b', stat: 'Crit Damage', grade: 'GTMS only', desc: '仅限冰川隧道矿井 (Glacite Mineshaft)' },
  { key: 'CITRINE', name: 'Citrine', name_cn: '黄水晶', icon: '☘', color: '#ea580c', stat: 'Foraging Fortune', grade: 'GTMS only', desc: '仅限冰川隧道矿井 (Glacite Mineshaft)' },
  { key: 'PERIDOT', name: 'Peridot', name_cn: '橄榄石', icon: '☘', color: '#84cc16', stat: 'Farming Fortune', grade: 'GTMS only', desc: '仅限冰川隧道矿井 (Glacite Mineshaft)' },
  { key: 'OPAL', name: 'Opal', name_cn: '蛋白石', icon: '❂', color: '#e2e8f0', stat: 'True Defense', grade: 'OPAL: 蛋白石', desc: '冰川矿井偶得 / 非GT任务刚需 / 市场小众' }
];

// Interactive Quantity Snap Configurations (Aligned Mathematically with Slider Track)
const SNAP_CONFIGS = {
  FLAWED: {
    tierKey: 'Flawed',
    unitsPerFlawless: 6400,
    unitsPerPerfect: 32000,
    unitLabel: '微瑕 (Flawed)',
    snaps: [
      { value: 0, label: '0', desc: '-' },
      { value: 6400, label: '6.4k', desc: '0.2炉' },
      { value: 32000, label: '32k ★', desc: '1炉', highlight: true },
      { value: 64000, label: '64k', desc: '2炉' },
      { value: 71680, label: '71.7k ★', desc: '1满单', highlight: true },
      { value: 96000, label: '96k', desc: '3炉' },
      { value: 128000, label: '128k', desc: '4炉' },
      { value: 160000, label: '160k', desc: '5炉' },
      { value: 192000, label: '192k', desc: '6炉' },
      { value: 224000, label: '224k ★', desc: '7炉满', highlight: true },
      { value: 320000, label: '320k', desc: '10炉' }
    ],
    defaultIndex: 2 // 32000 (1炉)
  },
  FINE: {
    tierKey: 'Fine',
    unitsPerFlawless: 80,
    unitsPerPerfect: 400,
    unitLabel: '精致 (Fine)',
    snaps: [
      { value: 0, label: '0', desc: '-' },
      { value: 80, label: '80', desc: '0.2炉' },
      { value: 400, label: '400 ★', desc: '1炉', highlight: true },
      { value: 800, label: '800', desc: '2炉' },
      { value: 1200, label: '1.2k', desc: '3炉' },
      { value: 1600, label: '1.6k', desc: '4炉' },
      { value: 2000, label: '2k', desc: '5炉' },
      { value: 2400, label: '2.4k', desc: '6炉' },
      { value: 2800, label: '2.8k ★', desc: '7炉满', highlight: true },
      { value: 4000, label: '4k', desc: '10炉' },
      { value: 71680, label: '71.7k ★', desc: '1满单', highlight: true }
    ],
    defaultIndex: 2 // 400 (1炉)
  },
  FLAWLESS: {
    tierKey: 'Flawless',
    unitsPerFlawless: 1,
    unitsPerPerfect: 5,
    unitLabel: '无瑕 (Flawless)',
    snaps: [
      { value: 0, label: '0', desc: '-' },
      { value: 5, label: '5 ★', desc: '1炉', highlight: true },
      { value: 10, label: '10', desc: '2炉' },
      { value: 15, label: '15', desc: '3炉' },
      { value: 20, label: '20', desc: '4炉' },
      { value: 25, label: '25', desc: '5炉' },
      { value: 30, label: '30', desc: '6炉' },
      { value: 35, label: '35 ★', desc: '7炉满', highlight: true },
      { value: 40, label: '40', desc: '8炉' },
      { value: 45, label: '45', desc: '9炉' },
      { value: 50, label: '50', desc: '10炉' }
    ],
    defaultIndex: 1 // 5 (1炉)
  },
  ROUGH: {
    tierKey: 'Rough',
    unitsPerFlawless: 512000,
    unitsPerPerfect: 2560000,
    unitLabel: '粗糙 (Rough)',
    snaps: [
      { value: 0, label: '0', desc: '-' },
      { value: 71680, label: '71.7k', desc: '1单' },
      { value: 512000, label: '512k', desc: '1无瑕' },
      { value: 2560000, label: '2.56M ★', desc: '1炉', highlight: true },
      { value: 5120000, label: '5.12M', desc: '2炉' },
      { value: 17920000, label: '17.9M ★', desc: '7炉满', highlight: true }
    ],
    defaultIndex: 3 // 2560000 (1炉)
  }
};

// ==========================================
// Hypixel Official Rarity & Quality Themes
// Rough: 灰白 (White/Gray) | Flawed: 绿 (Green) | Fine: 蓝 (Blue) | Flawless: 紫 (Purple) | Perfect: 金 (Gold)
// ==========================================
const TIER_THEMES = {
  ROUGH: {
    name: 'Rough',
    cnName: '粗糙',
    rarity: 'Common',
    rarityCn: '普通 (灰白)',
    color: '#cbd5e1',
    badgeCls: 'bg-slate-400/10 text-slate-300 border border-slate-400/30'
  },
  FLAWED: {
    name: 'Flawed',
    cnName: '微瑕',
    rarity: 'Uncommon',
    rarityCn: '罕见 (绿)',
    color: '#22c55e',
    badgeCls: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/40'
  },
  FINE: {
    name: 'Fine',
    cnName: '精致',
    rarity: 'Rare',
    rarityCn: '稀有 (蓝)',
    color: '#3b82f6',
    badgeCls: 'bg-blue-500/15 text-blue-400 border border-blue-500/40'
  },
  FLAWLESS: {
    name: 'Flawless',
    cnName: '无瑕',
    rarity: 'Epic',
    rarityCn: '史诗 (紫)',
    color: '#c084fc',
    badgeCls: 'bg-purple-500/15 text-purple-400 border border-purple-500/40'
  },
  PERFECT: {
    name: '★Perfect',
    cnName: '★完美',
    rarity: 'Legendary',
    rarityCn: '传奇 (金)',
    color: '#fbbf24',
    badgeCls: 'bg-amber-500/15 text-amber-300 border border-amber-500/40'
  }
};

function getTierTheme(tier) {
  const key = (tier || '').toUpperCase();
  return TIER_THEMES[key] || TIER_THEMES.FLAWED;
}

function getTierBadge(tier) {
  const theme = getTierTheme(tier);
  const isPerfect = (tier || '').toUpperCase() === 'PERFECT';
  const displayName = isPerfect ? '★Perfect' : theme.name;
  const displayCn = isPerfect ? '★完美' : theme.cnName;
  return `<span class="${theme.badgeCls} px-2 py-0.5 rounded text-[11px] font-mono font-bold tracking-wide shadow-sm" title="品质: ${displayName} (${displayCn} • ${theme.rarityCn})">${displayName}</span>`;
}

// Local Timezone Formatter (YYYY-MM-DD HH:mm:ss accurate to seconds)
function formatDateTimeLocal(timestamp) {
  if (!timestamp) return '--';
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return '--';
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = d.getFullYear();
  const MM = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const HH = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${yyyy}-${MM}-${dd} ${HH}:${mm}:${ss}`;
}

// Relative time string helper
function getTimeAgoString(ms) {
  if (!ms) return '';
  const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diffSec < 5) return '（刚刚）';
  if (diffSec < 60) return `（${diffSec}秒前）`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `（${diffMin}分前）`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `（${diffHour}小时前）`;
  const diffDay = Math.floor(diffHour / 24);
  return `（${diffDay}天前）`;
}

// Live-ticking System Clock & Relative Time Updater
function initSystemClock() {
  const updateClock = () => {
    const now = Date.now();
    const el = document.getElementById('systemLocalTime');
    if (el) {
      el.innerText = formatDateTimeLocal(now);
    }
    if (appState.lastUpdatedMs) {
      const agoEl = document.getElementById('bazaarTimeAgo');
      if (agoEl) {
        agoEl.innerText = getTimeAgoString(appState.lastUpdatedMs);
      }
    }
  };
  updateClock();
  setInterval(updateClock, 1000);
}

// Auto-dismissing Top Toast (Display ~1 second)
function showTopToast(message, type = 'success') {
  let container = document.getElementById('topToastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'topToastContainer';
    container.className = 'fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center space-y-2 pointer-events-none';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  const isSuccess = type === 'success';
  const icon = isSuccess ? 'fa-circle-check text-emerald-400' : 'fa-circle-exclamation text-rose-400';
  const borderCls = isSuccess ? 'border-emerald-500/50 shadow-emerald-500/20' : 'border-rose-500/50 shadow-rose-500/20';

  toast.className = `top-toast-card flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-[#111520]/95 backdrop-blur-md text-slate-100 text-xs font-semibold border ${borderCls} shadow-xl transition-all duration-300 transform -translate-y-3 opacity-0 pointer-events-auto`;
  toast.innerHTML = `<i class="fa-solid ${icon} text-sm"></i><span>${message}</span>`;
  container.appendChild(toast);

  // Trigger entrance transition
  requestAnimationFrame(() => {
    toast.classList.remove('-translate-y-3', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');
  });

  // Auto-dismiss in ~1 second (1000ms display)
  setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('-translate-y-3', 'opacity-0');
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, 1000);
}

// ==========================================
// Theme (Light / Dark) Toggle
// ==========================================
function initTheme() {
  const savedTheme = localStorage.getItem('gemflipper_theme') || 'light';
  setTheme(savedTheme);
}

function setTheme(theme) {
  appState.currentTheme = theme;
  localStorage.setItem('gemflipper_theme', theme);
  const html = document.documentElement;
  if (theme === 'dark') {
    html.classList.add('dark');
    html.classList.remove('light');
  } else {
    html.classList.remove('dark');
    html.classList.add('light');
  }
  updateThemeUI();
  if (appState.lastCalculationData) {
    updateChart();
    if (appState.lastCalculationData.event_context) {
      renderFiestaPanel(appState.lastCalculationData.event_context);
    }
  }
}

function toggleTheme() {
  const nextTheme = appState.currentTheme === 'dark' ? 'light' : 'dark';
  setTheme(nextTheme);
}

function updateThemeUI() {
  const btn = document.getElementById('themeToggleBtn');
  const icon = document.getElementById('themeToggleIcon');
  const text = document.getElementById('themeToggleText');
  if (!btn) return;
  if (appState.currentTheme === 'dark') {
    if (icon) icon.className = 'fa-solid fa-sun text-amber-300';
    if (text) text.innerText = '浅色';
    btn.title = '切换至浅色模式 (白色界面)';
  } else {
    if (icon) icon.className = 'fa-solid fa-moon text-indigo-400';
    if (text) text.innerText = '深色';
    btn.title = '切换至深色模式 (暗黑主题)';
  }
}

// ==========================================
// Quality (Tier) Filter (Row 1 & Row 2)
// ==========================================
let t1PressTimer = null;
let t1Unlocked = false;

function initQualityFilterEvents() {
  const roughBtn = document.getElementById('qualityBtn_ROUGH');
  if (roughBtn) {
    const startPress = () => {
      roughBtn.classList.add('t1-pressing');
      t1PressTimer = setTimeout(() => {
        roughBtn.classList.remove('t1-pressing');
        t1Unlocked = true;
        toggleQualityFilter('ROUGH', true);
      }, 1000);
    };

    const cancelPress = () => {
      if (t1PressTimer) {
        clearTimeout(t1PressTimer);
        t1PressTimer = null;
      }
      roughBtn.classList.remove('t1-pressing');
    };

    roughBtn.addEventListener('mousedown', startPress);
    roughBtn.addEventListener('mouseup', cancelPress);
    roughBtn.addEventListener('mouseleave', cancelPress);
    roughBtn.addEventListener('touchstart', startPress, { passive: true });
    roughBtn.addEventListener('touchend', cancelPress);
    roughBtn.addEventListener('touchcancel', cancelPress);

    roughBtn.addEventListener('click', () => {
      if (t1Unlocked) {
        t1Unlocked = false;
        return;
      }
      if (!appState.selectedQualities.has('ROUGH')) {
        showTopToast('⚠️ T1 粗糙石单量极大，需长按 1 秒解锁', 'error');
      } else {
        toggleQualityFilter('ROUGH', false);
      }
    });
  }

  updateQualityFilterUI();
}

function toggleQualityFilter(tier, isUnlock = false) {
  if (appState.selectedQualities.has(tier)) {
    if (appState.selectedQualities.size <= 1) {
      showTopToast('请至少保留一个宝石品质筛选', 'error');
      return;
    }
    appState.selectedQualities.delete(tier);
    showTopToast(`已隐藏 ${tier} 品质`, 'success');
  } else {
    appState.selectedQualities.add(tier);
    const msg = tier === 'ROUGH' ? '已解锁并展示 T1 粗糙石' : `已添加展示 ${tier} 品质`;
    showTopToast(msg, 'success');
  }
  updateQualityFilterUI();
  renderTable();
  updateChart();
}

function presetQualityOnlyT2() {
  appState.selectedQualities = new Set(['FLAWED']);
  updateQualityFilterUI();
  renderTable();
  updateChart();
  showTopToast('已筛选: 只展示 T2 Flawed 微瑕', 'success');
}

function presetQualityT2toT4() {
  appState.selectedQualities = new Set(['FLAWED', 'FINE', 'FLAWLESS']);
  updateQualityFilterUI();
  renderTable();
  updateChart();
  showTopToast('已筛选: 展示 T2-T4 (微瑕/精致/无瑕)', 'success');
}

function updateQualityFilterUI() {
  ['ROUGH', 'FLAWED', 'FINE', 'FLAWLESS'].forEach(tier => {
    const btn = document.getElementById(`qualityBtn_${tier}`);
    const check = document.getElementById(`qualityCheck_${tier}`);
    if (!btn || !check) return;
    const isSelected = appState.selectedQualities.has(tier);
    const theme = getTierTheme(tier);

    if (isSelected) {
      btn.className = `quality-btn-3b-2g filter-card-3a bg-[#111520] border-2 rounded-xl px-2.5 py-1.5 cursor-pointer transition relative flex items-center justify-between text-xs select-none shadow-sm overflow-hidden ${tier === 'ROUGH' ? 't1-longpress-wrapper' : ''}`;
      btn.style.borderColor = theme.color;
      btn.style.boxShadow = `0 0 12px ${theme.color}33`;
      check.className = 'w-4 h-4 rounded flex items-center justify-center text-[10px] text-white shrink-0';
      check.style.backgroundColor = theme.color;
      check.style.borderColor = theme.color;
      check.innerHTML = '<i class="fa-solid fa-check"></i>';
    } else {
      btn.className = `quality-btn-3b-2g filter-card-3a bg-[#111520] border border-slate-700/60 rounded-xl px-2.5 py-1.5 cursor-pointer hover:border-slate-500 transition relative flex items-center justify-between text-xs select-none overflow-hidden ${tier === 'ROUGH' ? 't1-longpress-wrapper' : ''}`;
      btn.style.borderColor = '';
      btn.style.boxShadow = 'none';
      check.className = 'w-4 h-4 rounded border border-slate-600 flex items-center justify-center text-[10px] text-white shrink-0';
      check.style.backgroundColor = 'transparent';
      check.style.borderColor = '';
      check.innerHTML = '<i class="fa-solid fa-check hidden"></i>';
    }
  });
}

// ==========================================
// Gem Type Filter (Row 3 & Row 4)
// ==========================================
function renderGemSquareButtons() {
  const container = document.getElementById('gemSquareButtonsContainer');
  if (!container) return;

  container.innerHTML = GEM_LIST.map(g => {
    const isSelected = appState.selectedGems.has(g.key);
    let borderStyle = isSelected 
      ? `border: 2px solid ${g.color}; background-color: ${g.color}22; box-shadow: 0 0 10px ${g.color}44;` 
      : `border: 1px solid #262e45; opacity: 0.35;`;

    return `
      <button onclick="toggleGemSelection('${g.key}')" 
              id="gemBtn_${g.key}"
              class="gem-btn-b gem-btn-a rounded-xl transition flex flex-col items-center justify-center cursor-pointer active:scale-95 group relative"
              style="${borderStyle}"
              title="${g.name} (${g.name_cn}) • ${g.grade} • ${g.stat}\n获取: ${g.desc}">
        <span class="text-xl font-bold transition transform group-hover:scale-110" style="color: ${g.color}; text-shadow: 0 0 8px ${g.color}88;">
          ${g.icon}
        </span>
      </button>
    `;
  }).join('');
}

function toggleGemSelection(gemKey) {
  if (appState.selectedGems.has(gemKey)) {
    if (appState.selectedGems.size <= 1) {
      showTopToast('请至少保留一个宝石品类', 'error');
      return;
    }
    appState.selectedGems.delete(gemKey);
  } else {
    appState.selectedGems.add(gemKey);
  }
  updateGemButtonsUI();
  renderTable();
  updateChart();
}

function updateGemButtonsUI() {
  GEM_LIST.forEach(g => {
    const btn = document.getElementById(`gemBtn_${g.key}`);
    if (!btn) return;
    const isSelected = appState.selectedGems.has(g.key);
    if (isSelected) {
      btn.style.border = `2px solid ${g.color}`;
      btn.style.backgroundColor = `${g.color}22`;
      btn.style.boxShadow = `0 0 10px ${g.color}44`;
      btn.style.opacity = '1.0';
    } else {
      btn.style.border = '1px solid #262e45';
      btn.style.backgroundColor = 'transparent';
      btn.style.boxShadow = 'none';
      btn.style.opacity = '0.35';
    }
  });
}

function presetGemCategory(category) {
  if (category === 'LOW_COST') {
    appState.selectedGems = new Set(['TOPAZ', 'AMBER']);
    showTopToast('已筛选: 超低成本 (Topaz, Amber)', 'success');
  } else if (category === 'FAST') {
    appState.selectedGems = new Set(['TOPAZ', 'AMBER', 'SAPPHIRE']);
    showTopToast('已筛选: 快速刷取 (Topaz, Amber, Sapphire)', 'success');
  } else if (category === 'NUCLEUS_5') {
    appState.selectedGems = new Set(['TOPAZ', 'AMBER', 'SAPPHIRE', 'JADE', 'AMETHYST']);
    showTopToast('已筛选: 跑水晶五大 (Topaz, Amber, Sapphire, Jade, Amethyst)', 'success');
  } else if (category === 'CH_7') {
    appState.selectedGems = new Set(['TOPAZ', 'AMBER', 'SAPPHIRE', 'JADE', 'AMETHYST', 'JASPER', 'RUBY']);
    showTopToast('已筛选: 水晶洞七大 (五大 + Jasper, Ruby)', 'success');
  } else if (category === 'GTMS') {
    appState.selectedGems = new Set(['TOPAZ', 'AMBER', 'SAPPHIRE', 'JADE', 'AMETHYST', 'JASPER', 'RUBY', 'AQUAMARINE', 'ONYX', 'CITRINE', 'PERIDOT']);
    showTopToast('已筛选: 包含GTMS (前11种宝石，不含 Opal)', 'success');
  } else if (category === 'ALL') {
    appState.selectedGems = new Set(GEM_LIST.map(g => g.key));
    showTopToast('已筛选: 全选所有宝石品类 (包含 OPAL)', 'success');
  }
  updateGemButtonsUI();
  renderTable();
  updateChart();
}

// ==========================================
// Copy Bazaar Command (/bz {tier} {gem} gem)
// ==========================================
function copyBazaarCommand(tier, gem) {
  const t = (tier || '').toLowerCase();
  const g = (gem || '').toLowerCase();
  const cmd = `/bz ${t} ${g} gem`;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(cmd).then(() => {
      showTopToast(`已复制: ${cmd}`, 'success');
    }).catch(() => {
      fallbackCopyText(cmd);
    });
  } else {
    fallbackCopyText(cmd);
  }
}

function fallbackCopyText(text) {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  document.body.appendChild(textArea);
  textArea.select();
  try {
    document.execCommand('copy');
    showTopToast(`已复制: ${text}`, 'success');
  } catch (err) {
    showTopToast('复制失败，请手动输入: ' + text, 'error');
  }
  document.body.removeChild(textArea);
}

// 水晶获取难度 / 配方繁杂度 Badge Helper (S级, A级, B级, C级, GTMS only, OPAL)
function getCNBadge(cn) {
  const cnNum = parseInt(cn);
  const map = {
    5: { grade: 'S级', text: 'S级: 速刷', cls: 'cn-badge-5', tip: 'Amber (琥珀), Topaz (黄玉)' },
    3: { grade: 'A级', text: 'A级: 蓝宝石', cls: 'cn-badge-3', tip: 'Sapphire (蓝宝石)' },
    2: { grade: 'B级', text: 'B级: 慢刷', cls: 'cn-badge-2', tip: 'Amethyst (紫水晶), Jade (翡翠)' },
    1: { grade: 'C级', text: 'C级: 限跑水晶/冰洞偶得', cls: 'cn-badge-1', tip: 'Jasper (碧玉), Ruby (红宝石)' },
    0: { grade: 'GTMS only', text: 'GTMS only: 仅限冰洞偶得', cls: 'cn-badge-0', tip: 'Onyx (黑玛瑙), Citrine (黄水晶), Peridot (橄榄石), Aquamarine (海蓝宝)' },
    '-1': { grade: 'OPAL', text: 'OPAL: 蛋白石', cls: 'cn-badge--1', tip: 'Opal (蛋白石)' }
  };
  const item = map[cnNum] || { grade: `${cn}级`, text: `难度: ${cn}`, cls: 'cn-badge-0', tip: '' };
  return `<span class="${item.cls} px-2 py-0.5 rounded text-[11px] font-mono whitespace-nowrap font-bold cursor-help" title="${item.text}${item.tip ? ' • 对应: ' + item.tip : ''}">${item.grade}</span>`;
}

// Number Formatters
function formatCoins(num) {
  if (num === null || num === undefined || isNaN(num)) return '--';
  return Math.round(num).toLocaleString('en-US');
}

// Format numbers strictly to 1 decimal place with trailing zero preserved (e.g., 321.0)
function formatCoinsExact1Dec(num) {
  if (num === null || num === undefined || isNaN(num)) return '--';
  return Number(num).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function formatCompact(num) {
  if (num === null || num === undefined || isNaN(num)) return '--';
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  if (abs >= 1e9) return sign + (abs / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return sign + (abs / 1e6).toFixed(2) + 'M';
  if (abs >= 1e3) return sign + (abs / 1e3).toFixed(1) + 'k';
  return sign + Math.round(abs).toString();
}

function formatPercent(num) {
  if (num === null || num === undefined || isNaN(num)) return '--';
  return (num * 100).toFixed(1) + '%';
}

// ==========================================
// Quantity Slider & Real-time Batch Calculations
// ==========================================

// ==========================================
// Quantity Slider & Real-time Batch Calculations (Decoupled)
// ==========================================

function setBatchSliderTier(tier) {
  appState.batchSliderTier = tier;
  ['FLAWED', 'FINE', 'ROUGH'].forEach(t => {
    const btn = document.getElementById(`batchTier_${t}`);
    if (btn) {
      if (t === tier) {
        btn.className = 'px-2.5 py-1 rounded font-bold transition text-xs bg-indigo-600 text-white shadow-sm';
      } else {
        btn.className = 'px-2.5 py-1 rounded font-bold transition text-xs text-slate-400 hover:text-white';
      }
    }
  });
  setupQuantitySlider();
  renderTable();
}

function setupQuantitySlider(preferredValue = null) {
  const panel = document.getElementById('quantitySliderPanel');
  const slider = document.getElementById('quantityRangeSlider');
  const pillsContainer = document.getElementById('quantitySnapPills');
  if (!panel || !slider || !pillsContainer) return;

  const tier = appState.batchSliderTier || 'FLAWED';
  const config = SNAP_CONFIGS[tier] || SNAP_CONFIGS.FLAWED;
  slider.min = "0";
  slider.max = (config.snaps.length - 1).toString();
  slider.step = "1";

  let activeIndex = config.defaultIndex;
  if (preferredValue !== null) {
    const foundIdx = config.snaps.findIndex(s => s.value === preferredValue);
    if (foundIdx !== -1) activeIndex = foundIdx;
  }

  slider.value = activeIndex.toString();
  appState.currentQuantity = config.snaps[activeIndex].value;

  const onSelect = (idx) => {
    slider.value = idx.toString();
    appState.currentQuantity = config.snaps[idx].value;
    updateQuantityBadges(config, config.snaps[idx].value);
    highlightActivePill(idx);
    renderTable();
  };

  renderSnapPills(config.snaps, activeIndex, onSelect);
  renderQuickButtons(tier, config.snaps, onSelect);
  updateQuantityBadges(config, appState.currentQuantity);
}

function renderQuickButtons(tier, snaps, onSelect) {
  const container = document.getElementById('quantityQuickButtons');
  if (!container) return;

  let presets = [];
  if (tier === 'FLAWED') {
    presets = [
      { label: '1炉 (32k)', idx: 2 },
      { label: '1满单 (71.7k)', idx: 4 },
      { label: '7炉 (224k)', idx: 9 }
    ];
  } else if (tier === 'FINE') {
    presets = [
      { label: '1炉 (400)', idx: 2 },
      { label: '1满单 (71.7k)', idx: 10 },
      { label: '7炉 (2.8k)', idx: 8 }
    ];
  } else if (tier === 'ROUGH') {
    presets = [
      { label: '1炉 (2.56M)', idx: 3 },
      { label: '1满单 (71.7k)', idx: 1 },
      { label: '7炉 (17.9M)', idx: 5 }
    ];
  } else {
    presets = [
      { label: '1炉', idx: 1 },
      { label: '1满单', idx: 4 },
      { label: '7炉', idx: 7 }
    ];
  }

  container.innerHTML = presets.map(p => `
    <button class="px-3.5 py-1.5 rounded-lg bg-[#111520] hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/40 text-xs font-mono font-bold transition active:scale-95 shadow-sm whitespace-nowrap" data-preset-idx="${p.idx}">
      <i class="fa-solid fa-bolt mr-1 text-amber-400"></i>${p.label}
    </button>
  `).join('');

  container.querySelectorAll('button[data-preset-idx]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-preset-idx'));
      if (idx >= 0 && idx < snaps.length) {
        highlightActivePill(idx);
        onSelect(idx);
      }
    });
  });
}

function renderSnapPills(snaps, activeIdx, onSelect) {
  const container = document.getElementById('quantitySnapPills');
  const centerTicksContainer = document.getElementById('quantityCenterTicks');
  if (!container) return;

  const total = snaps.length;

  // Render centered track ticks right on the slider track
  if (centerTicksContainer) {
    centerTicksContainer.innerHTML = snaps.map((s, idx) => {
      const fraction = total > 1 ? (idx / (total - 1)) : 0;
      const isActive = (idx === activeIdx);
      let cls = 'slider-tick-pip';
      if (isActive) cls += ' active';
      else if (s.highlight) cls += ' highlight';
      return `<div class="${cls}" style="left: calc(8px + (100% - 16px) * ${fraction});"></div>`;
    }).join('');
  }

  // Render snap cards below slider track with mathematical alignment (14px font size)
  container.innerHTML = snaps.map((s, idx) => {
    const isActive = (idx === activeIdx);
    const isHighlight = !!s.highlight;
    const fraction = total > 1 ? (idx / (total - 1)) : 0;
    
    const posStyle = `left: calc(8px + (100% - 16px) * ${fraction}); transform: translateX(-50%); text-align: center;`;

    let textCls = '';
    let tickPipCls = '';
    if (isActive) {
      textCls = isHighlight 
        ? 'text-amber-300 font-black scale-105 drop-shadow-[0_0_10px_rgba(251,191,36,0.7)]' 
        : 'text-white font-black scale-105 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]';
      tickPipCls = isHighlight ? 'bg-amber-400 ring-2 ring-amber-400/50' : 'bg-indigo-400 ring-2 ring-indigo-400/50';
    } else if (isHighlight) {
      textCls = 'text-amber-400 font-bold hover:text-amber-200';
      tickPipCls = 'bg-amber-500/60';
    } else {
      textCls = 'text-slate-400 hover:text-slate-200 font-bold';
      tickPipCls = 'bg-slate-600';
    }

    const subText = s.desc ? `<span class="block text-[11px] font-semibold leading-tight opacity-85 whitespace-nowrap mt-0.5">${s.desc}</span>` : '';

    return `
      <div style="${posStyle}" class="absolute top-0 cursor-pointer group transition-all select-none slider-scale-label" data-snap-idx="${idx}" title="${s.label} (${s.value ? s.value.toLocaleString() + ' 颗' : '0'})">
        <div class="flex flex-col items-center">
          <div class="w-1.5 h-2 rounded-full mb-1 transition ${tickPipCls}"></div>
          <span class="block text-[14px] font-bold leading-tight whitespace-nowrap transition ${textCls}">${s.label}</span>
          ${subText}
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('div[data-snap-idx]').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.getAttribute('data-snap-idx'));
      highlightActivePill(idx);
      onSelect(idx);
    });
  });
}

function highlightActivePill(activeIdx) {
  const container = document.getElementById('quantitySnapPills');
  if (!container) return;
  const items = container.querySelectorAll('div[data-snap-idx]');
  const tier = appState.batchSliderTier || 'FLAWED';
  const snaps = (SNAP_CONFIGS[tier] || SNAP_CONFIGS.FLAWED).snaps;

  // Sync below-track pill elements (Strictly 14px font size)
  items.forEach((el, idx) => {
    const isHighlight = snaps[idx] ? snaps[idx].highlight : false;
    const isActive = (idx === activeIdx);
    const pip = el.querySelector('.rounded-full');
    const label = el.querySelector('span');

    if (pip && label) {
      if (isActive) {
        label.className = `block text-[14px] font-bold leading-tight whitespace-nowrap transition ${isHighlight ? 'text-amber-300 font-black scale-105 drop-shadow-[0_0_10px_rgba(251,191,36,0.7)]' : 'text-white font-black scale-105 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]'}`;
        pip.className = `w-1.5 h-2 rounded-full mb-1 transition ${isHighlight ? 'bg-amber-400 ring-2 ring-amber-400/50' : 'bg-indigo-400 ring-2 ring-indigo-400/50'}`;
      } else if (isHighlight) {
        label.className = 'block text-[14px] leading-tight whitespace-nowrap transition text-amber-400 font-bold hover:text-amber-200';
        pip.className = 'w-1.5 h-2 rounded-full mb-1 transition bg-amber-500/60';
      } else {
        label.className = 'block text-[14px] leading-tight whitespace-nowrap transition text-slate-400 hover:text-slate-200 font-bold';
        pip.className = 'w-1.5 h-2 rounded-full mb-1 transition bg-slate-600';
      }
    }
  });

  // Sync center track tick pips on the slider
  const centerTicks = document.querySelectorAll('#quantityCenterTicks .slider-tick-pip');
  centerTicks.forEach((pip, idx) => {
    const isHighlight = snaps[idx] ? snaps[idx].highlight : false;
    if (idx === activeIdx) {
      pip.className = 'slider-tick-pip active';
    } else if (isHighlight) {
      pip.className = 'slider-tick-pip highlight';
    } else {
      pip.className = 'slider-tick-pip';
    }
  });
}

function updateQuantityBadges(config, qty) {
  const badgeQty = document.getElementById('badgeQtyCount');
  const badgeFlawless = document.getElementById('badgeFlawlessCount');
  const badgePerfect = document.getElementById('badgePerfectCount');
  const badgeOrders = document.getElementById('badgeOrdersCount');

  const tierKey = config.tierKey || 'Flawed';
  const tierTheme = getTierTheme(tierKey);

  if (badgeQty) {
    badgeQty.innerText = `采购对象：${tierTheme.cnName} (${tierKey}) ${formatCoins(qty)}`;
    badgeQty.className = `bg-[#111520] ${tierTheme.badgeCls} px-2.5 py-1 rounded-lg font-mono font-bold transition shadow-sm`;
  }

  const flawless = (qty / config.unitsPerFlawless);
  if (badgeFlawless) {
    const fStr = (flawless % 1 === 0) ? flawless.toString() : parseFloat(flawless.toFixed(2)).toString();
    badgeFlawless.innerText = `=${fStr}x Flawless`;
    badgeFlawless.className = "bg-[#111520] border border-purple-500/40 text-purple-400 px-2.5 py-1 rounded-lg font-mono font-bold transition";
  }

  const perfects = (qty / config.unitsPerPerfect);
  if (badgePerfect) {
    const pStr = (perfects % 1 === 0) ? perfects.toString() : parseFloat(perfects.toFixed(2)).toString();
    badgePerfect.innerText = `=${pStr}x ★Perfect`;
    badgePerfect.className = "bg-[#111520] border border-amber-500/40 text-amber-300 px-2.5 py-1 rounded-lg font-mono font-bold transition";
  }

  const orders = (qty / 71680).toFixed(2);
  if (badgeOrders) {
    badgeOrders.innerText = `=约${orders}单（71.68k 每单）`;
    badgeOrders.className = "bg-[#111520] border border-slate-700 px-2.5 py-1 rounded-lg text-slate-300 font-mono font-bold transition";
  }
}

function updateQuantityBadgesForAll(multiplier) {
  const badgeQty = document.getElementById('badgeQtyCount');
  const badgeFlawless = document.getElementById('badgeFlawlessCount');
  const badgePerfect = document.getElementById('badgePerfectCount');
  const badgeOrders = document.getElementById('badgeOrdersCount');

  if (badgeQty) {
    badgeQty.innerText = `采购对象：全品质 (${multiplier} 炉基准)`;
    badgeQty.className = "bg-[#111520] border border-indigo-500/40 text-indigo-300 px-2.5 py-1 rounded-lg font-mono font-bold transition";
  }
  if (badgeFlawless) {
    badgeFlawless.innerText = `=${multiplier * 5}x Flawless`;
    badgeFlawless.className = "bg-[#111520] border border-purple-500/40 text-purple-400 px-2.5 py-1 rounded-lg font-mono font-bold transition";
  }
  if (badgePerfect) {
    badgePerfect.innerText = `=${multiplier}x ★Perfect`;
    badgePerfect.className = "bg-[#111520] border border-amber-500/40 text-amber-300 px-2.5 py-1 rounded-lg font-mono font-bold transition";
  }
  if (badgeOrders) {
    badgeOrders.innerText = `=按各品质自动折算`;
    badgeOrders.className = "bg-[#111520] border border-slate-700 px-2.5 py-1 rounded-lg text-slate-300 font-mono font-bold transition";
  }
}

// Document Ready
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initQualityFilterEvents();
  renderGemSquareButtons();
  initEventListeners();
  initSystemClock();
  setupQuantitySlider();
  fetchElectionStatus();
  fetchData();
  setupAutoRefresh();
  initShardTracker();
});

// Toggle Tips
function toggleTips() {
  const content = document.getElementById('tipsContent');
  const icon = document.getElementById('tipsToggleIcon');
  if (content.classList.contains('hidden')) {
    content.classList.remove('hidden');
    icon.innerHTML = '<i class="fa-solid fa-chevron-up"></i>';
  } else {
    content.classList.add('hidden');
    icon.innerHTML = '<i class="fa-solid fa-chevron-down"></i>';
  }
}

// Event Listeners Initialization
function initEventListeners() {
  // Envelope Button (Placeholder)
  const envelopeBtn = document.getElementById('envelopeBtn');
  if (envelopeBtn) {
    envelopeBtn.addEventListener('click', () => {
      showTopToast('开发者反馈信箱与功能建议通道筹备中...', 'success');
    });
  }

  // Forge slots slider
  const forgeSlotsSlider = document.getElementById('forgeSlotsSlider');
  forgeSlotsSlider.addEventListener('input', (e) => {
    appState.forges = parseInt(e.target.value);
    document.getElementById('forgeSlotsDisplay').innerText = `${appState.forges} 槽`;
    document.getElementById('slotsCycleCount').innerText = appState.forges;
    fetchData();
  });

  // HotM Slider
  const hotmSlider = document.getElementById('hotmSlider');
  hotmSlider.addEventListener('input', (e) => {
    appState.hotmLevel = parseInt(e.target.value);
    document.getElementById('hotmLevelDisplay').innerText = `HotM ${appState.hotmLevel}`;
    fetchData();
  });

  // Quick Forge Slider
  const quickForgeSlider = document.getElementById('quickForgeSlider');
  quickForgeSlider.addEventListener('input', (e) => {
    appState.quickForgeLevel = parseInt(e.target.value);
    const pct = (appState.quickForgeLevel * 1.5).toFixed(1);
    document.getElementById('quickForgeDisplay').innerText = `${appState.quickForgeLevel}级 (-${pct}%)`;
    fetchData();
  });

  // Cole Toggle
  const coleToggle = document.getElementById('coleToggle');
  coleToggle.addEventListener('change', (e) => {
    appState.coleActive = e.target.checked;
    fetchData();
  });

  // Selling Mode Select (Offer vs Instant)
  const sellingModeSelect = document.getElementById('sellingModeSelect');
  sellingModeSelect.addEventListener('change', (e) => {
    appState.sellingMode = e.target.value;
    renderTable();
    updateChart();
  });

  // Tax Input
  const taxInput = document.getElementById('taxInput');
  taxInput.addEventListener('change', (e) => {
    appState.taxRate = parseFloat(e.target.value) / 100.0;
    fetchData();
  });

  // CN Filter (if still in DOM)
  const cnFilterSelect = document.getElementById('cnFilterSelect');
  if (cnFilterSelect) {
    cnFilterSelect.addEventListener('change', (e) => {
      appState.cnFilter = e.target.value;
      renderTable();
    });
  }

  // Tier (Quality) Filter (if still in DOM)
  const tierFilterSelect = document.getElementById('tierFilterSelect');
  if (tierFilterSelect) {
    tierFilterSelect.addEventListener('change', (e) => {
      appState.tierFilter = e.target.value;
      setupQuantitySlider();
      renderTable();
      updateChart();
    });
  }

  // Gem Type Filter (if still in DOM)
  const gemFilterSelect = document.getElementById('gemFilterSelect');
  if (gemFilterSelect) {
    gemFilterSelect.addEventListener('change', (e) => {
      appState.gemFilter = e.target.value;
      renderTable();
      updateChart();
    });
  }

  // Quantity Range Slider
  const quantityRangeSlider = document.getElementById('quantityRangeSlider');
  if (quantityRangeSlider) {
    quantityRangeSlider.addEventListener('input', (e) => {
      const idx = parseInt(e.target.value);
      const tier = appState.batchSliderTier || 'FLAWED';
      const config = SNAP_CONFIGS[tier] || SNAP_CONFIGS.FLAWED;
      const snap = config.snaps[idx];
      if (snap) {
        appState.currentQuantity = snap.value;
        updateQuantityBadges(config, snap.value);
        highlightActivePill(idx);
        renderTable();
      }
    });
  }

  // Search Input
  const tableSearchInput = document.getElementById('tableSearchInput');
  tableSearchInput.addEventListener('input', (e) => {
    appState.searchQuery = e.target.value.trim().toLowerCase();
    renderTable();
  });

  // Manual Refresh Button
  const manualRefreshBtn = document.getElementById('manualRefreshBtn');
  manualRefreshBtn.addEventListener('click', () => {
    triggerManualRefresh();
  });

  // Auto Refresh Interval Select
  const autoRefreshSelect = document.getElementById('autoRefreshSelect');
  autoRefreshSelect.addEventListener('change', (e) => {
    appState.autoRefreshInterval = parseInt(e.target.value);
    setupAutoRefresh();
  });

  // Player Sync Button & Enter Key
  const syncPlayerBtn = document.getElementById('syncPlayerBtn');
  if (syncPlayerBtn) {
    syncPlayerBtn.addEventListener('click', () => {
      syncPlayer();
    });
  }

  const ignInput = document.getElementById('ignInput');
  if (ignInput) {
    ignInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        syncPlayer();
      }
    });
  }

  // Local Server Shutdown Button (方式 2: 本地桌面模式关停)
  const shutdownServerBtn = document.getElementById('shutdownServerBtn');
  if (shutdownServerBtn) {
    shutdownServerBtn.addEventListener('click', () => {
      confirmAndShutdownServer();
    });
  }
}

// Auto Refresh Setup
function setupAutoRefresh() {
  if (appState.autoRefreshTimer) {
    clearInterval(appState.autoRefreshTimer);
    appState.autoRefreshTimer = null;
  }
  const autoRefreshSelect = document.getElementById('autoRefreshSelect');
  if (autoRefreshSelect) {
    appState.autoRefreshInterval = parseInt(autoRefreshSelect.value) || 0;
  }
  if (appState.autoRefreshInterval > 0) {
    console.log(`[AutoRefresh] 启动自动刷新，间隔: ${appState.autoRefreshInterval}秒`);
    appState.autoRefreshTimer = setInterval(() => {
      fetchData(false);
      const shardView = document.getElementById('shardTrackerView');
      if (shardView && !shardView.classList.contains('hidden') && shardAppState.loaded) {
        fetchShardTrackerData(shardAppState.ign, shardAppState.selectedProfile, false);
      }
    }, appState.autoRefreshInterval * 1000);
  } else {
    console.log('[AutoRefresh] 自动刷新已关闭 (OFF)');
  }
}

// Fetch Election / Mayor Info
async function fetchElectionStatus() {
  try {
    const res = await fetch('/api/election');
    const data = await res.json();
    const mayorNameEl = document.getElementById('mayorName');
    const ministerContainer = document.getElementById('ministerContainer');
    const ministerNameEl = document.getElementById('ministerName');
    const coleBadge = document.getElementById('colePerkBadge');
    const mayorBadge = document.getElementById('mayorBadge');
    
    const mayor = data.mayor || data.administration?.mayor || 'Paul';
    const minister = data.minister || data.administration?.minister;
    const isMoltenActive = !!(data.molten_forge_active || data.administration?.molten_forge_active);

    if (mayorNameEl) mayorNameEl.innerText = mayor;

    if (minister && minister !== 'None' && minister !== 'Unknown') {
      if (ministerNameEl) ministerNameEl.innerText = minister;
      if (ministerContainer) ministerContainer.classList.remove('hidden');
    } else {
      if (ministerContainer) ministerContainer.classList.add('hidden');
    }

    if (isMoltenActive) {
      if (coleBadge) coleBadge.classList.remove('hidden');
      const coleToggle = document.getElementById('coleToggle');
      if (coleToggle) coleToggle.checked = true;
      appState.coleActive = true;
    } else {
      if (coleBadge) coleBadge.classList.add('hidden');
    }

    // Tooltip for perks
    const perks = (data.all_perks && data.all_perks.length > 0) 
      ? data.all_perks.join('、') 
      : (data.administration?.all_perks ? data.administration.all_perks.join('、') : '无特殊特技');
    if (mayorBadge) {
      mayorBadge.title = `现任市长: ${mayor} | 现任部长: ${minister || '无'}\n生效特技: ${perks}`;
    }
  } catch (err) {
    console.error('Failed to fetch election status:', err);
    const mayorNameEl = document.getElementById('mayorName');
    if (mayorNameEl && mayorNameEl.innerText === '查询中') {
      mayorNameEl.innerText = 'Paul';
    }
  }
}

// Manual Refresh Trigger
async function triggerManualRefresh() {
  const btn = document.getElementById('manualRefreshBtn');
  const spinner = document.getElementById('refreshSpinner');
  const btnText = btn ? btn.querySelector('span') : null;
  const originalText = '刷新';

  if (btn) btn.disabled = true;
  if (spinner) spinner.classList.add('fa-spin');
  if (btnText) btnText.innerText = '刷新中...';

  try {
    const res = await fetch('/api/bazaar/refresh', { method: 'POST' });
    const refreshData = await res.json();
    console.log('[Frontend] 手动刷新结果:', refreshData);
    if (refreshData && refreshData.last_updated_ms) {
      appState.lastUpdatedMs = refreshData.last_updated_ms;
      const bazaarTimeEl = document.getElementById('bazaarDataTime');
      if (bazaarTimeEl) {
        bazaarTimeEl.innerText = formatDateTimeLocal(refreshData.last_updated_ms);
      }
      const agoEl = document.getElementById('bazaarTimeAgo');
      if (agoEl) {
        agoEl.innerText = getTimeAgoString(refreshData.last_updated_ms);
      }
    }
    await fetchElectionStatus();
    await fetchData(false);

    if (btnText) {
      btnText.innerText = '已刷新 ✓';
      setTimeout(() => {
        if (btnText) btnText.innerText = originalText;
      }, 1500);
    }
    showTopToast('Bazaar 数据刷新成功！', 'success');
  } catch (err) {
    console.error('Refresh failed:', err);
    if (btnText) {
      btnText.innerText = '刷新失败';
      setTimeout(() => {
        if (btnText) btnText.innerText = originalText;
      }, 2000);
    }
    showTopToast('刷新失败，请检查网络或稍后重试', 'error');
  } finally {
    if (spinner) spinner.classList.remove('fa-spin');
    if (btn) btn.disabled = false;
  }
}

// Fetch Calculations
async function fetchData(showLoading = true) {
  if (showLoading) {
    document.getElementById('refreshSpinner').classList.add('fa-spin');
  }

  const payload = {
    forges: appState.forges,
    hotm_level: appState.hotmLevel,
    quick_forge_level: appState.quickForgeLevel,
    cole_active: appState.coleActive,
    tax_rate: appState.taxRate,
    crystal_filter: null,
    tier_filter: null
  };

  try {
    const res = await fetch('/api/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    appState.lastCalculationData = data;

    // Update Header Status & Data Source Indicator
    const dot = document.getElementById('apiStatusDot');
    const text = document.getElementById('apiStatusText');
    const badge = document.getElementById('apiSourceBadge');

    if (data.is_live_data) {
      if (dot) dot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse';
      if (text) text.innerText = 'Bazaar: 官方实时在线';
      if (badge) {
        badge.className = 'px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono';
        badge.innerText = `Hypixel Live (${data.latency_s || '0.5'}s)`;
        badge.classList.remove('hidden');
      }
    } else {
      if (dot) dot.className = 'w-2.5 h-2.5 rounded-full bg-amber-400';
      if (text) text.innerText = 'Bazaar: 本地快照备用';
      if (badge) {
        badge.className = 'px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-mono';
        badge.innerText = 'Excel 快照';
        badge.classList.remove('hidden');
      }
    }

    // Update Dual Timestamps (Bazaar Data Time & Time Ago)
    if (data.last_updated_ms) {
      appState.lastUpdatedMs = data.last_updated_ms;
      const bazaarTimeEl = document.getElementById('bazaarDataTime');
      if (bazaarTimeEl) {
        bazaarTimeEl.innerText = formatDateTimeLocal(data.last_updated_ms);
      }
      const agoEl = document.getElementById('bazaarTimeAgo');
      if (agoEl) {
        agoEl.innerText = getTimeAgoString(data.last_updated_ms);
      }
    }
    const apiTimeEl = document.getElementById('apiTime');
    if (apiTimeEl) {
      apiTimeEl.innerText = data.last_updated_beijing || '已更新';
    }
    
    // Update Duration UI
    const dur = data.config.forge_duration;
    document.getElementById('forgeDurationResult').innerText = dur.formatted_duration;
    document.getElementById('durationSavings').innerText = `(较原始20小时缩短 ${dur.total_reduction_pct}%)`;

    // Recipe Status
    const recipeStatusEl = document.getElementById('recipeStatus');
    if (data.hotm_unlocked) {
      recipeStatusEl.className = 'text-emerald-400 font-bold';
      recipeStatusEl.innerText = '已完全解锁 (HotM ≥ 5 锻造 ★Perfect)';
    } else {
      recipeStatusEl.className = 'text-red-400 font-bold';
      recipeStatusEl.innerText = '未解锁 (需 HotM 5+ 锻造 ★Perfect)';
    }

    // Render Components
    renderFiestaPanel(data.event_context);
    renderAnomalyBanner(data.anomaly_alerts);
    renderArbitrageBanner(data.arbitrage_alerts);
    renderRecommendations();
    renderTable();
    updateChart();

  } catch (err) {
    console.error('Failed to calculate flips:', err);
    document.getElementById('apiStatusText').innerText = '连接出错 (使用快照)';
    document.getElementById('apiStatusDot').className = 'w-2.5 h-2.5 rounded-full bg-red-500';
  } finally {
    document.getElementById('refreshSpinner').classList.remove('fa-spin');
  }
}

// Render Mining Fiesta Intelligence Panel (2026 Mayor Update: Continuous 24/7 Fiesta)
function renderFiestaPanel(eventContext) {
  if (!eventContext) return;
  const fiesta = eventContext.fiesta || {};
  const admin = eventContext.administration || {};
  const isLight = document.documentElement.classList.contains('light') || !document.documentElement.classList.contains('dark');

  const mainTitleEl = document.getElementById('fiestaMainTitle');
  const badgeStatusEl = document.getElementById('fiestaBadgeStatus');
  const adminSummaryEl = document.getElementById('fiestaAdminSummary');
  const countdownDescEl = document.getElementById('fiestaCountdownDesc');
  const adviceTextEl = document.getElementById('fiestaAdviceText');

  if (mainTitleEl) mainTitleEl.innerText = fiesta.title || '采矿节宏观情报与常驻机制监控';
  if (badgeStatusEl) {
    if (fiesta.status === 'ACTIVE') {
      badgeStatusEl.innerText = '24/7 常驻进行中';
      badgeStatusEl.className = isLight
        ? 'px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse'
        : 'px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/25 text-emerald-300 border border-emerald-400/40 animate-pulse';
    } else if (fiesta.status === 'UPCOMING' || fiesta.status === 'ELECTION_PREDICTED') {
      badgeStatusEl.innerText = '选举预测常驻';
      badgeStatusEl.className = isLight
        ? 'px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-100 text-amber-800 border border-amber-300'
        : 'px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40';
    } else {
      badgeStatusEl.innerText = '未激活 (OFF)';
      badgeStatusEl.className = isLight
        ? 'px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-600 border border-slate-200'
        : 'px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-700/60 text-slate-400 border border-slate-600/50';
    }
  }

  if (adminSummaryEl) {
    const mayor = eventContext.mayor || admin.mayor || 'Paul';
    const minister = eventContext.minister || admin.minister;
    const ministerPerk = eventContext.minister_perk || admin.minister_perk || '特技生效';
    const ministerPart = minister && minister !== 'None' 
      ? `• 部长: ${minister} (${ministerPerk})` 
      : '';
    const curDate = eventContext.cur_sb_date ? ` • 游戏内: ${eventContext.cur_sb_date}` : '';
    adminSummaryEl.innerText = `市长: ${mayor} ${ministerPart}${curDate}`;
  }

  if (countdownDescEl) {
    if (fiesta.status === 'ACTIVE') {
      countdownDescEl.innerHTML = `<span class="${isLight ? 'text-emerald-700' : 'text-emerald-300'} font-semibold">⚡ 2026新机制：Cole 任期全程 24/7 常驻生效中（无需倒计时）</span> • <span class="line-through text-slate-400/70">原 5 场排期预测已停用</span>`;
    } else if (fiesta.status === 'ELECTION_PREDICTED') {
      countdownDescEl.innerHTML = `<span class="${isLight ? 'text-amber-700' : 'text-amber-300'} font-semibold">选情预测：Cole 遥遥领先，新任期将 24/7 全程常驻激活采矿节</span> • <span class="line-through text-slate-400/70">旧版分场排期已作废</span>`;
    } else {
      countdownDescEl.innerHTML = `<span class="${isLight ? 'text-slate-600' : 'text-slate-400'}">当前未点亮 Cole Mining Fiesta 特技，活动处于关闭状态</span> • <span class="line-through text-slate-400/70">旧版分场排期预测已停用</span>`;
    }
  }

  if (adviceTextEl) {
    adviceTextEl.innerText = fiesta.market_advice || '2026新规常驻采矿节：原料供给平稳充沛，按需批量锻造';
  }

  // Render Fiesta Windows in the collapsible drawer with strikethrough & deprecated styling
  const windowsListEl = document.getElementById('fiestaWindowsList');
  if (windowsListEl && fiesta.all_windows) {
    windowsListEl.innerHTML = fiesta.all_windows.map(w => {
      const cardBorder = isLight 
        ? 'border-slate-200 bg-slate-50/70 opacity-60' 
        : 'border-slate-800 bg-[#0a0d16] opacity-50';

      return `
        <div class="border ${cardBorder} rounded-lg p-2.5 space-y-1 grayscale transition-all hover:opacity-90">
          <div class="flex items-center justify-between text-xs font-bold ${isLight ? 'text-slate-700' : 'text-slate-300'}">
            <span class="line-through">第 ${w.fiesta_index}/4 场采矿节</span>
            <span class="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold ${isLight ? 'bg-slate-200 text-slate-600 border border-slate-300' : 'bg-slate-800 text-slate-400 border border-slate-700'}">已废弃旧机制</span>
          </div>
          <div class="text-[11px] text-slate-400 font-mono line-through">
            ${w.ingame_date_str || `Year ${w.year}, ${w.season}`}
          </div>
          <div class="text-[11px] text-slate-400 font-mono line-through">
            ${w.start_time_local} - ${w.end_time_local}
          </div>
          <div class="text-[10px] text-amber-500/80 font-medium">
            ⚠️ 2026更新：已由任期内 24/7 常驻取代
          </div>
        </div>
      `;
    }).join('');
  }
}

function toggleFiestaDetails() {
  const el = document.getElementById('fiestaScheduleDetails');
  if (el) {
    el.classList.toggle('hidden');
  }
}

// Render Global Anomaly Banner
function renderAnomalyBanner(anomalies) {
  const banner = document.getElementById('anomalyAlertBanner');
  if (!banner) return;
  if (!anomalies || anomalies.length === 0) {
    banner.classList.add('hidden');
    return;
  }

  // Top severe anomaly
  const top = anomalies[0];
  const titleEl = document.getElementById('anomalyBannerTitle');
  const descEl = document.getElementById('anomalyBannerDesc');

  if (titleEl) titleEl.innerText = top.title;
  if (descEl) descEl.innerText = `${top.description} 【建议操作】: ${top.action_advice}`;

  banner.classList.remove('hidden');
}

function scrollToAnomalyItem() {
  const table = document.getElementById('masterTable');
  if (table) {
    table.scrollIntoView({ behavior: 'smooth', block: 'start' });
    showTopToast('已定位至异常行情宝石！', 'success');
  }
}

// Arbitrage Alert Banner (Safe Null-Check)
function renderArbitrageBanner(alerts) {
  const banner = document.getElementById('arbitrageBanner');
  if (!banner) return;
  const countEl = document.getElementById('arbitrageCount');
  const listEl = document.getElementById('arbitrageList');
  
  if (!alerts || alerts.length === 0) {
    banner.classList.add('hidden');
    return;
  }

  banner.classList.remove('hidden');
  countEl.innerText = alerts.length;
  listEl.innerHTML = alerts.map(a => {
    const gemMeta = (appState.lastCalculationData?.all_flips || []).find(f => f.gem === a.gem);
    const gemColor = gemMeta ? gemMeta.color : '#fbbf24';
    return `
      <div class="bg-black/30 border border-amber-500/30 rounded-lg px-2.5 py-1 text-xs flex items-center space-x-2">
        <span class="font-bold" style="color: ${gemColor};">${a.gem}</span>
        <span class="text-slate-400">(${a.tier})</span>
        <span class="text-amber-300 font-mono">Bazaar: ${formatCoins(a.bazaar_price)}</span>
        <span class="text-emerald-400 font-mono font-bold">NPC: ${formatCoins(a.npc_price)} (+${formatCoins(a.profit_per_unit)})</span>
      </div>
    `;
  }).join('');
}

// Recommendations Cards
function renderRecommendations(rawRecs = null) {
  if (!appState.lastCalculationData) return;

  const isOfferMode = appState.sellingMode === 'OFFER';
  const eligibleFlips = (appState.lastCalculationData.all_flips || []).filter(
    f => f.tier !== 'ROUGH' && (appState.selectedGems ? appState.selectedGems.has(f.gem) : true)
  );

  let recs = rawRecs;
  if (!recs && eligibleFlips.length > 0) {
    const sortedByProfit = [...eligibleFlips].sort((a, b) => {
      const pA = isOfferMode ? a.max_profit : a.profit_panic_sell;
      const pB = isOfferMode ? b.max_profit : b.profit_panic_sell;
      return pB - pA;
    });
    const sortedByROI = [...eligibleFlips].sort((a, b) => b.roi - a.roi);
    const sortedByHourly = [...eligibleFlips].sort((a, b) => b.profit_per_hour - a.profit_per_hour);
    const positiveFlips = eligibleFlips.filter(f => (isOfferMode ? f.max_profit : f.profit_panic_sell) > 0);
    const sortedByRisk = positiveFlips.length > 0 ? [...positiveFlips].sort((a, b) => a.std_dev - b.std_dev) : sortedByProfit;

    recs = {
      max_profit: sortedByProfit[0],
      highest_roi: sortedByROI[0],
      fastest_hourly: sortedByHourly[0],
      safest: sortedByRisk[0]
    };
  } else if (!recs) {
    recs = appState.lastCalculationData.recommendations;
  }

  if (!recs) return;

  // 1. Max Profit
  if (recs.max_profit) {
    const r = recs.max_profit;
    const title1 = document.getElementById('rec1Title');
    title1.innerText = `${r.gem_name} (${getTierTheme(r.tier).name})`;
    title1.style.color = r.color;
    title1.style.textShadow = `0 0 10px ${r.color}55`;
    document.getElementById('rec1Icon').innerText = r.icon;
    document.getElementById('rec1Icon').style.color = r.color;
    document.getElementById('rec1Tier').innerHTML = `买入: ${getTierBadge(r.tier)}`;
    document.getElementById('rec1CN').outerHTML = `<span id="rec1CN">${getCNBadge(r.cn)}</span>`;
    document.getElementById('rec1Cost').innerText = formatCompact(r.cost_buy_order);
    document.getElementById('rec1Profit').innerText = '+' + formatCompact(r.max_profit);
    document.getElementById('rec1ROI').innerText = formatPercent(r.roi);
  }

  // 2. Highest ROI
  if (recs.highest_roi) {
    const r = recs.highest_roi;
    const title2 = document.getElementById('rec2Title');
    title2.innerText = `${r.gem_name} (${getTierTheme(r.tier).name})`;
    title2.style.color = r.color;
    title2.style.textShadow = `0 0 10px ${r.color}55`;
    document.getElementById('rec2Icon').innerText = r.icon;
    document.getElementById('rec2Icon').style.color = r.color;
    document.getElementById('rec2Tier').innerHTML = `买入: ${getTierBadge(r.tier)}`;
    document.getElementById('rec2CN').outerHTML = `<span id="rec2CN">${getCNBadge(r.cn)}</span>`;
    document.getElementById('rec2Cost').innerText = formatCompact(r.cost_buy_order);
    document.getElementById('rec2Profit').innerText = '+' + formatCompact(r.max_profit);
    document.getElementById('rec2ROI').innerText = formatPercent(r.roi);
  }

  // 3. Fastest Hourly Velocity
  if (recs.fastest_hourly) {
    const r = recs.fastest_hourly;
    const title3 = document.getElementById('rec3Title');
    title3.innerText = `${r.gem_name} (${getTierTheme(r.tier).name})`;
    title3.style.color = r.color;
    title3.style.textShadow = `0 0 10px ${r.color}55`;
    document.getElementById('rec3Icon').innerText = r.icon;
    document.getElementById('rec3Icon').style.color = r.color;
    document.getElementById('rec3Tier').innerHTML = `买入: ${getTierBadge(r.tier)}`;
    document.getElementById('rec3CN').outerHTML = `<span id="rec3CN">${getCNBadge(r.cn)}</span>`;
    document.getElementById('rec3Hourly').innerText = formatCompact(r.profit_per_hour) + '/h';
    document.getElementById('rec3Profit').innerText = '+' + formatCompact(r.max_profit);
    document.getElementById('rec3Daily').innerText = formatCompact(r.profit_per_day) + '/天';
  }

  // 4. Safest
  if (recs.safest) {
    const r = recs.safest;
    const title4 = document.getElementById('rec4Title');
    title4.innerText = `${r.gem_name} (${getTierTheme(r.tier).name})`;
    title4.style.color = r.color;
    title4.style.textShadow = `0 0 10px ${r.color}55`;
    document.getElementById('rec4Icon').innerText = r.icon;
    document.getElementById('rec4Icon').style.color = r.color;
    document.getElementById('rec4Tier').innerHTML = `买入: ${getTierBadge(r.tier)}`;
    document.getElementById('rec4CN').outerHTML = `<span id="rec4CN">${getCNBadge(r.cn)}</span>`;
    document.getElementById('rec4STD').innerText = formatCompact(r.std_dev);
    document.getElementById('rec4Profit').innerText = '+' + formatCompact(r.max_profit);
    document.getElementById('rec4MinProf').innerText = formatCompact(r.min_profit);
  }
}

// Master Table Rendering
function renderTable() {
  if (!appState.lastCalculationData) return;
  let items = [...appState.lastCalculationData.all_flips];

  // 1. Primary Quality (Tier) Filter (Multi-select)
  if (appState.selectedQualities && appState.selectedQualities.size > 0) {
    items = items.filter(i => appState.selectedQualities.has(i.tier));
  }

  // 2. Gemstone Type Filter (Multi-select)
  if (appState.selectedGems && appState.selectedGems.size > 0) {
    items = items.filter(i => appState.selectedGems.has(i.gem));
  }

  // 3. Search Query (Matches english name, chinese name, gem key, stat)
  if (appState.searchQuery) {
    const q = appState.searchQuery;
    items = items.filter(i => 
      i.gem.toLowerCase().includes(q) ||
      i.gem_name.toLowerCase().includes(q) ||
      (i.name_cn && i.name_cn.toLowerCase().includes(q)) ||
      i.stat.toLowerCase().includes(q)
    );
  }

  const isOfferMode = appState.sellingMode === 'OFFER';

  // 4. Batch quantity scaling based on batchSliderTier and currentQuantity
  const batchConfig = SNAP_CONFIGS[appState.batchSliderTier] || SNAP_CONFIGS.FLAWED;
  const batchMultiplier = batchConfig.unitsPerPerfect > 0 
    ? (appState.currentQuantity / batchConfig.unitsPerPerfect) 
    : 1;

  const computedItems = items.map(item => {
    const Q = (item.units_per_forge || 32000) * batchMultiplier;

    const unitsPerPerfect = item.units_per_forge || (item.amt_base * 5);
    const perfectsCount = unitsPerPerfect > 0 ? (Q / unitsPerPerfect) : 0;
    const flawlessCount = item.amt_base > 0 ? (Q / item.amt_base) : 0;
    const ordersNeeded = (Q / 71680);

    const matCost = Q * (item.sell_price || 0);
    const crystalCost = perfectsCount * (item.crystal_cost_unit || 0);
    const totalCost = matCost + crystalCost;

    const revOffer = perfectsCount * ((item.perfect_offer_unit || 0) * (1.0 - appState.taxRate));
    const revInstant = perfectsCount * (item.perfect_sell_unit || 0);
    const activeRevenue = isOfferMode ? revOffer : revInstant;
    const activeProfit = activeRevenue - totalCost;
    const roi = totalCost > 0 ? (activeProfit / totalCost) : 0;
    const forgeHours = item.forge_hours || 14.0;
    const hourlyProfit = forgeHours > 0 ? (activeProfit / forgeHours) : 0;

    return {
      ...item,
      dynamic_qty: Q,
      dynamic_perfects: perfectsCount,
      dynamic_flawless: flawlessCount,
      dynamic_orders: ordersNeeded,
      dynamic_mat_cost: matCost,
      dynamic_crystal_cost: crystalCost,
      dynamic_total_cost: totalCost,
      dynamic_revenue: activeRevenue,
      dynamic_profit: activeProfit,
      dynamic_roi: roi,
      dynamic_hourly: hourlyProfit
    };
  });

  // 6. Sorting
  computedItems.sort((a, b) => {
    let valA, valB;
    if (appState.sortKey === 'gem') {
      valA = a.gem;
      valB = b.gem;
      return appState.sortAsc ? valA.localeCompare(valB) : valB.localeCompare(a.gem);
    } else if (appState.sortKey === 'cn') {
      valA = a.cn;
      valB = b.cn;
    } else if (appState.sortKey === 'revenue') {
      valA = a.dynamic_revenue;
      valB = b.dynamic_revenue;
    } else if (appState.sortKey === 'profit') {
      valA = a.dynamic_profit;
      valB = b.dynamic_profit;
    } else if (appState.sortKey === 'roi') {
      valA = a.dynamic_roi;
      valB = b.dynamic_roi;
    } else if (appState.sortKey === 'hourly') {
      valA = a.dynamic_hourly;
      valB = b.dynamic_hourly;
    } else {
      valA = a.dynamic_profit;
      valB = b.dynamic_profit;
    }
    return appState.sortAsc ? (valA - valB) : (valB - valA);
  });

  const countEl = document.getElementById('tableResultCount');
  if (countEl) countEl.innerText = `共 ${computedItems.length} 条记录`;

  const tbody = document.getElementById('masterTableBody');
  if (computedItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" class="py-8 text-center text-slate-500">无符合条件的宝石记录</td></tr>`;
    return;
  }

  tbody.innerHTML = computedItems.map(item => {
    const isProfitable = item.dynamic_profit > 0;
    const profitColor = isProfitable ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold';

    // ROI in-cell conditional formatting data bar (0% ~ 200%)
    const roiVal = Number(item.dynamic_roi) || 0;
    const roiPct = roiVal * 100;
    const roiClamped = Math.max(0, Math.min(200, roiPct));
    const roiBarWidth = (roiClamped / 200) * 100;
    let roiBarClass = 'from-emerald-500/30 to-emerald-400/50 border-r border-emerald-400/60';
    let roiTextClass = 'text-emerald-300';
    if (roiPct <= 0) {
      roiBarClass = 'from-rose-500/25 to-rose-400/40 border-r border-rose-400/50';
      roiTextClass = 'text-rose-400';
    } else if (roiPct < 20) {
      roiBarClass = 'from-amber-500/25 to-amber-400/40 border-r border-amber-400/50';
      roiTextClass = 'text-amber-300';
    } else if (roiPct >= 100) {
      roiBarClass = 'from-emerald-500/40 via-teal-400/50 to-cyan-400/60 border-r border-cyan-400/70';
      roiTextClass = 'text-emerald-200';
    }

    // Orders display
    const isRough = item.tier === 'ROUGH';
    const orderFormatted = item.dynamic_orders.toFixed(2);
    const orderBadge = (item.dynamic_orders > 5 || isRough)
      ? `<span class="text-amber-400 font-mono text-[11px] font-bold" title="需挂单 ${orderFormatted} 次，可能耗时较长">⚠️ ${orderFormatted}单</span>`
      : `<span class="text-slate-300 font-mono text-[11px]">${orderFormatted}单</span>`;

    // NPC Inline Display (Embedded inside Quality Cell)
    let npcInlineHtml = '';
    const isBelowNPC = (item.npc_price !== null && item.has_buy_order && item.sell_price > 0 && item.sell_price < item.npc_price);
    if (item.npc_price !== null && item.npc_price !== undefined) {
      if (isBelowNPC) {
        npcInlineHtml = `
          <div class="mt-1 flex items-center gap-1 text-[10px] text-amber-300 font-bold bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/40" title="Bazaar预购价 ${formatCoinsExact1Dec(item.sell_price)} 低于 NPC 商店收购保底 ${formatCoins(item.npc_price)}！存在无风险保底空间">
            <i class="fa-solid fa-triangle-exclamation animate-pulse"></i>
            <span>NPC ${formatCoins(item.npc_price)}</span>
          </div>
        `;
      } else {
        npcInlineHtml = `
          <div class="mt-0.5 text-[10px] text-slate-500 font-mono" title="NPC商店保底价: ${formatCoins(item.npc_price)}">
            NPC保底: ${formatCoins(item.npc_price)}
          </div>
        `;
      }
    } else {
      npcInlineHtml = `<div class="mt-0.5 text-[10px] text-slate-600 font-mono">不可出售给NPC</div>`;
    }

    const anomaly = item.anomaly_info;
    const isAnomaly = !!item.has_anomaly && !!anomaly;
    let rowCls = 'transition border-b border-[#262e45]/40 ';
    if (isAnomaly) {
      if (anomaly.severity === 'CRITICAL') {
        rowCls += 'bg-rose-950/40 border-2 border-rose-500/80 shadow-lg shadow-rose-950/40 animate-pulse-subtle';
      } else {
        rowCls += 'bg-amber-950/30 border border-amber-500/60';
      }
    } else {
      rowCls += 'hover:bg-[#1f2537]/60';
    }

    const trend = item.trend || { trend_code: 'STABLE', trend_label: '平稳', trend_icon: 'fa-minus text-slate-400' };

    return `
      <tr class="${rowCls}">
        <!-- 1. Gem Name & Icon with Individual Gem Colors -->
        <td class="py-3 px-4 font-medium flex items-center space-x-2.5">
          <span class="text-xl" style="color: ${item.color}; text-shadow: 0 0 10px ${item.color}66;">${item.icon}</span>
          <div>
            <div class="font-extrabold text-sm tracking-wide flex items-center gap-1.5" style="color: ${item.color}; text-shadow: 0 0 8px ${item.color}33;">
              <span>${item.gem_name}</span>
              ${item.name_cn ? `<span class="text-xs font-normal opacity-90">(${item.name_cn})</span>` : ''}
              ${isRough ? '<span class="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-1 rounded font-normal">高单量</span>' : ''}
            </div>
            <div class="text-[10px] text-slate-400 font-mono">
              <span>${item.stat}</span>
            </div>
            ${isAnomaly ? `
              <div class="mt-1">
                <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${anomaly.severity === 'CRITICAL' ? 'bg-rose-500/30 text-rose-300 border border-rose-400/50' : 'bg-amber-500/30 text-amber-300 border border-amber-400/50'}" title="${anomaly.description}">
                  <i class="fa-solid fa-triangle-exclamation"></i>
                  <span>${anomaly.severity === 'CRITICAL' ? `破位套利 (+${formatPercent((anomaly.arbitrage_roi_pct || 0)/100)})` : (anomaly.title ? anomaly.title.split(' ')[0] : '异常')}</span>
                </span>
              </div>
            ` : ''}
          </div>
        </td>

        <!-- 2. CN Badge -->
        <td class="py-3 px-3">
          ${getCNBadge(item.cn)}
        </td>

        <!-- 3. Sourcing Quality (Tier) + Embedded NPC Price + SkyCofl Link + Copy /bz Command -->
        <td class="py-3 px-3">
          <div class="flex items-center gap-1.5">
            ${getTierBadge(item.tier)}
            <a href="https://sky.coflnet.com/item/${item.tier}_${item.gem}_GEM" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center w-5 h-5 rounded bg-[#111520] hover:bg-indigo-600/30 text-slate-400 hover:text-indigo-300 border border-[#262e45] hover:border-indigo-500/50 transition active:scale-95 shadow-sm" title="在 SkyCofl 查看 ${item.tier} ${item.gem_name} 行情与历史曲线">
              <i class="fa-solid fa-arrow-up-right-from-square text-[9px]"></i>
            </a>
            <button onclick="copyBazaarCommand('${item.tier}', '${item.gem}')" class="inline-flex items-center justify-center w-5 h-5 rounded bg-[#111520] hover:bg-emerald-600/30 text-slate-400 hover:text-emerald-300 border border-[#262e45] hover:border-emerald-500/50 transition active:scale-95 shadow-sm" title="复制 Bazaar 指令: /bz ${item.tier.toLowerCase()} ${item.gem.toLowerCase()} gem">
              <i class="fa-regular fa-copy text-[10px]"></i>
            </button>
          </div>
          ${npcInlineHtml}
        </td>

        <!-- 4. Buy Order Unit Price (PROMINENT HIGHLIGHTED COLUMN ★) + Trend Indicator -->
        <td class="py-3 px-4 text-right font-mono font-black text-amber-300 text-sm bg-amber-500/10 border-x border-amber-500/30 shadow-inner">
          ${item.has_buy_order ? `
            <div class="flex items-center justify-end gap-1">
              <span>${formatCoinsExact1Dec(item.sell_price)}</span>
              <span class="text-[10px] text-amber-400 font-normal">★</span>
            </div>
            <div class="flex items-center justify-end gap-1 mt-0.5 text-[10px] font-mono">
              <i class="fa-solid ${trend.trend_icon} text-[9px]"></i>
              <span class="text-slate-400">${trend.trend_label}</span>
            </div>
            ${isBelowNPC ? '<span class="text-[9px] text-emerald-400 block font-normal leading-tight mt-0.5">低于NPC保底价</span>' : ''}
          ` : `
            <div class="flex items-center justify-end gap-1">
              <span class="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold" title="当前全服无求购挂单 (sell_summary 为空)">断求 (No Order)</span>
            </div>
            <div class="text-[10px] text-rose-400/80 font-mono mt-0.5">无求购挂单</div>
          `}
        </td>

        <!-- 5. Total Forge Buy Order Cost -->
        <td class="py-3 px-3 text-right font-mono font-semibold text-slate-200" title="原料: ${formatCoins(item.dynamic_mat_cost)} + 水晶: ${formatCoins(item.dynamic_crystal_cost)}">
          ${item.has_buy_order ? formatCompact(item.dynamic_total_cost) : '<span class="text-slate-500 text-xs">-- (断求)</span>'}
        </td>

        <!-- 6. Liquidity & Orders Needed -->
        <td class="py-3 px-3 text-right">
          <div>${orderBadge}</div>
          <div class="text-[10px] text-slate-400 font-mono mt-0.5" title="全服日均成交量: ${formatCoins(item.daily_volume)} 颗 (周成交: ${formatCoins(item.weekly_volume)})">
            <i class="fa-solid fa-chart-line text-indigo-400 mr-0.5"></i>${formatCompact(item.daily_volume)}/日
          </div>
        </td>

        <!-- 7. ★完美宝石价值（当前） + SkyCofl Link (字号稍大，金色高亮) -->
        <td class="py-3 px-3 text-right font-mono font-bold text-amber-300 text-sm bg-amber-500/5 border-x border-amber-500/10 shadow-inner" title="${isOfferMode ? '★Perfect 挂单出售预估净额(扣除税)' : '★Perfect 秒卖变现总额'}">
          ${item.perfect_has_offer ? `
            <div class="flex items-center justify-end gap-1.5">
              <span class="tracking-tight">${formatCompact(item.dynamic_revenue)}</span>
              <a href="https://sky.coflnet.com/item/PERFECT_${item.gem}_GEM" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center w-5 h-5 rounded bg-[#111520] hover:bg-amber-500/30 text-amber-400/80 hover:text-amber-300 border border-amber-500/40 hover:border-amber-400 transition active:scale-95 shadow-sm" title="在 SkyCofl 查看 ★Perfect ${item.gem_name} 行情与历史曲线">
                <i class="fa-solid fa-arrow-up-right-from-square text-[9px]"></i>
              </a>
            </div>
          ` : `
            <div class="flex items-center justify-end gap-1.5">
              <span class="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold" title="当前全服无在售挂单 (buy_summary 为空)">断供 (No Offer)</span>
              <a href="https://sky.coflnet.com/item/PERFECT_${item.gem}_GEM" target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center w-5 h-5 rounded bg-[#111520] hover:bg-amber-500/30 text-amber-400/80 hover:text-amber-300 border border-amber-500/40 hover:border-amber-400 transition active:scale-95 shadow-sm" title="在 SkyCofl 查看 ★Perfect ${item.gem_name} 行情与历史曲线">
                <i class="fa-solid fa-arrow-up-right-from-square text-[9px]"></i>
              </a>
            </div>
          `}
        </td>

        <!-- 8. Active Profit -->
        <td class="py-3 px-4 text-right font-mono text-sm ${profitColor}">
          ${(!item.has_buy_order) 
            ? '<span class="text-slate-500 text-xs font-mono" title="原料市场暂无求购挂单">-- (断求)</span>' 
            : (!item.perfect_has_offer 
                ? '<span class="text-slate-500 text-xs font-mono" title="★完美暂无公开在售挂单">-- (断供)</span>' 
                : `${item.dynamic_profit > 0 ? '+' : ''}${formatCompact(item.dynamic_profit)}`)}
        </td>

        <!-- 9. ROI (内置 0%-200% 原地条件格式柱形图 + 金绿高亮列) -->
        <td class="py-3 px-3 text-right font-mono font-semibold relative overflow-hidden bg-emerald-500/5 border-x border-emerald-500/20 shadow-inner group/roi" title="投资回报率 (ROI): ${roiPct.toFixed(2)}% (0%-200% 原地条件格式柱形图)">
          ${(!item.has_buy_order || !item.perfect_has_offer) ? `
            <div class="relative z-10 flex items-center justify-end">
              <span class="text-slate-500 text-xs">--</span>
            </div>
          ` : `
            <div class="roi-data-bar absolute inset-y-1.5 left-1 rounded-sm bg-gradient-to-r ${roiBarClass} pointer-events-none transition-all duration-300" style="width: calc(${roiBarWidth}% - 8px); max-width: calc(100% - 8px);"></div>
            <div class="relative z-10 flex items-center justify-end">
              <span class="${roiTextClass} text-xs font-bold drop-shadow-sm">${formatPercent(item.dynamic_roi)}</span>
            </div>
          `}
        </td>

        <!-- 10. Profit / Hour -->
        <td class="py-3 px-3 text-right font-mono text-indigo-300 font-medium">
          ${(!item.has_buy_order || !item.perfect_has_offer) 
            ? '<span class="text-slate-500 text-xs">--</span>' 
            : `${formatCompact(item.dynamic_hourly)}/h`}
        </td>

        <!-- 11. Action: Open FlipCal Simulator -->
        <td class="py-3 px-3 text-center">
          <button onclick="openSimulator('${item.gem}', '${item.tier}', ${item.dynamic_qty})" class="bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white px-2.5 py-1 rounded text-xs transition font-medium flex items-center space-x-1 mx-auto">
            <i class="fa-solid fa-calculator"></i>
            <span>模拟</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Table Sort Click
function sortTable(key) {
  if (appState.sortKey === key) {
    appState.sortAsc = !appState.sortAsc;
  } else {
    appState.sortKey = key;
    appState.sortAsc = false;
  }
  renderTable();
}

// Chart Visualization
function switchChartTab(tab) {
  appState.activeChartTab = tab;
  document.querySelectorAll('.chart-tab').forEach(b => {
    b.className = 'chart-tab px-3 py-1 rounded font-medium text-slate-400 hover:text-white transition';
  });
  if (tab === 'leaderboard') {
    document.getElementById('tabLeaderboard').className = 'chart-tab px-3 py-1 rounded font-medium bg-indigo-600 text-white transition';
  } else if (tab === 'parallel') {
    document.getElementById('tabParallel').className = 'chart-tab px-3 py-1 rounded font-medium bg-indigo-600 text-white transition';
  } else if (tab === 'risk') {
    document.getElementById('tabRiskMatrix').className = 'chart-tab px-3 py-1 rounded font-medium bg-indigo-600 text-white transition';
  }
  updateChart();
}

function updateChart() {
  if (!appState.lastCalculationData) return;
  const ctx = document.getElementById('flipperChart').getContext('2d');
  
  if (appState.chartInstance) {
    appState.chartInstance.destroy();
  }

  const isOfferMode = appState.sellingMode === 'OFFER';
  const isLight = document.documentElement.classList.contains('light') || !document.documentElement.classList.contains('dark');
  const gridColor = isLight ? '#e2e8f0' : '#262e45';
  const tickColor = isLight ? '#64748b' : '#94a3b8';
  const legendColor = isLight ? '#475569' : '#94a3b8';

  if (appState.activeChartTab === 'leaderboard') {
    // 1. Leaderboard: Bar chart of gemstones filtered by Quality and Gem selection
    let flips = [...appState.lastCalculationData.all_flips]
      .filter(f => (appState.selectedQualities ? appState.selectedQualities.has(f.tier) : true) && 
                   (appState.selectedGems ? appState.selectedGems.has(f.gem) : true));

    // Sort flips according to current selling mode
    flips.sort((a, b) => {
      const pA = isOfferMode ? a.max_profit : a.profit_panic_sell;
      const pB = isOfferMode ? b.max_profit : b.profit_panic_sell;
      return pB - pA;
    });
    flips = flips.slice(0, 12);

    // Multiline labels: [gem_name, (tier)] to prevent auto-rotation distortion on responsive resizing
    const labels = flips.length > 0 ? flips.map(f => [f.gem_name, `(${f.tier})`]) : ['暂无符合所选配方难度的宝石'];
    const profits = flips.length > 0 ? flips.map(f => (isOfferMode ? f.max_profit : f.profit_panic_sell) / 1e6) : [0];
    const colors = flips.length > 0 ? flips.map(f => f.color || '#6366f1') : ['#475569'];

    // Custom Chart.js Plugin for Dual-Color Multiline X-Axis Ticks
    // Line 1: Gem Color for gemstone name; Line 2: Tier Color for tier rarity
    const dualColorTickPlugin = {
      id: 'dualColorTicks',
      afterDraw: (chart) => {
        const { ctx, scales: { x, y } } = chart;
        if (!x || !chart.data.labels || chart.data.labels.length === 0 || flips.length === 0) return;
        
        ctx.save();
        ctx.font = 'bold 11px Inter, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        flips.forEach((f, idx) => {
          const pixelX = x.getPixelForTick(idx);
          const tickY = y.bottom + 6;
          
          const gemPart = f.gem_name;
          const tierPart = `(${f.tier})`;

          const gemColor = f.color || '#38bdf8';
          const tierTheme = getTierTheme(f.tier);
          const tierColor = tierTheme.color || '#c084fc'; // e.g. purple for FLAWLESS, blue for FINE, green for FLAWED

          // Line 1: Gemstone name in gem category color
          ctx.fillStyle = gemColor;
          ctx.fillText(gemPart, pixelX, tickY);

          // Line 2: Tier name in tier rarity color
          ctx.fillStyle = tierColor;
          ctx.fillText(tierPart, pixelX, tickY + 14);
        });
        ctx.restore();
      }
    };

    appState.chartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: `${isOfferMode ? '挂单出售' : '秒卖变现'} 预期净利润 (Million Coins) [受全局配方难度勾选过滤]`,
          data: profits,
          backgroundColor: colors.map(c => c + 'aa'),
          borderColor: colors,
          borderWidth: 1.5,
          borderRadius: 6
        }]
      },
      plugins: [dualColorTickPlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: legendColor } },
          tooltip: {
            callbacks: {
              title: (items) => {
                const item = items[0];
                if (!item) return '';
                const f = flips[item.dataIndex];
                return f ? `${f.gem_name} (${f.tier})` : (Array.isArray(item.label) ? item.label.join(' ') : item.label);
              },
              label: (ctx) => `净利润: ${ctx.raw.toFixed(2)}M Coins`
            }
          }
        },
        scales: {
          x: { 
            ticks: { 
              color: 'transparent',
              font: { weight: 'bold', size: 11 },
              maxRotation: 0,
              minRotation: 0,
              autoSkip: false
            }, 
            grid: { display: false } 
          },
          y: { 
            ticks: { color: tickColor, callback: v => v + 'M' },
            grid: { color: gridColor } 
          }
        }
      }
    });

  } else if (appState.activeChartTab === 'parallel') {
    // 2. Parallel Tier Comparison: Grouped Bar chart (Filtered by selectedGems)
    const parallel = appState.lastCalculationData.parallel_by_gem;
    const gems = Object.keys(parallel).filter(g => {
      const gemList = parallel[g];
      return gemList && gemList.length > 0 && (appState.selectedGems ? appState.selectedGems.has(g) : true);
    }).slice(0, 10);

    const displayGems = gems.length > 0 ? gems : ['无匹配宝石'];
    const flawedData = gems.length > 0 ? gems.map(g => {
      const f = parallel[g].find(t => t.tier === 'FLAWED');
      return f ? ((isOfferMode ? f.max_profit : f.profit_panic_sell) / 1e6) : 0;
    }) : [0];
    const fineData = gems.length > 0 ? gems.map(g => {
      const f = parallel[g].find(t => t.tier === 'FINE');
      return f ? ((isOfferMode ? f.max_profit : f.profit_panic_sell) / 1e6) : 0;
    }) : [0];
    const flawlessData = gems.length > 0 ? gems.map(g => {
      const f = parallel[g].find(t => t.tier === 'FLAWLESS');
      return f ? ((isOfferMode ? f.max_profit : f.profit_panic_sell) / 1e6) : 0;
    }) : [0];

    // Gemstone colors dictionary for x-axis ticks
    const gemColorMap = {};
    (appState.lastCalculationData?.all_flips || []).forEach(f => {
      gemColorMap[f.gem] = f.color;
      gemColorMap[f.gem_name] = f.color;
    });

    appState.chartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: displayGems,
        datasets: [
          {
            label: '买入 Flawed 微瑕 [推荐]',
            data: flawedData,
            backgroundColor: '#22c55ecc',
            borderColor: '#22c55e',
            borderRadius: 4
          },
          {
            label: '买入 Fine 精致 [快速]',
            data: fineData,
            backgroundColor: '#3b82f6cc',
            borderColor: '#3b82f6',
            borderRadius: 4
          },
          {
            label: '买入 Flawless 无瑕 [免合成]',
            data: flawlessData,
            backgroundColor: '#c084fccc',
            borderColor: '#c084fc',
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: legendColor } }
        },
        scales: {
          x: { 
            ticks: { 
              color: (c) => gemColorMap[displayGems[c.index]] || tickColor,
              font: { weight: 'bold', size: 12 },
              maxRotation: 0,
              minRotation: 0
            }, 
            grid: { display: false } 
          },
          y: { 
            ticks: { color: tickColor, callback: v => v + 'M' },
            grid: { color: gridColor } 
          }
        }
      }
    });

  } else if (appState.activeChartTab === 'risk') {
    // 3. Risk vs Return Scatter Plot: X = Profit, Y = STD Deviation (Filtered by selectedQualities & selectedGems)
    const flips = appState.lastCalculationData.all_flips.filter(
      f => (appState.selectedQualities ? appState.selectedQualities.has(f.tier) : true) &&
           (appState.selectedGems ? appState.selectedGems.has(f.gem) : true)
    );
    const scatterData = flips.map(f => ({
      x: (isOfferMode ? f.max_profit : f.profit_panic_sell) / 1e6,
      y: f.std_dev / 1e6,
      name: `${f.gem_name} (${f.tier})`,
      gemColor: f.color || '#6366f1'
    }));

    const pointColors = scatterData.map(d => d.gemColor);

    appState.chartInstance = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [{
          label: '宝石倒卖收益与离散风险四象限图 (各点着对应宝石品类色)',
          data: scatterData,
          backgroundColor: pointColors.map(c => c + 'cc'),
          borderColor: pointColors,
          borderWidth: 2,
          pointRadius: 7,
          pointHoverRadius: 10
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.raw.name}: 净利 ${ctx.raw.x.toFixed(2)}M, 离散STD: ${ctx.raw.y.toFixed(2)}M`
            }
          },
          legend: { labels: { color: legendColor } }
        },
        scales: {
          x: {
            title: { display: true, text: '净利润 (Million Coins) → 收益越大越靠右', color: tickColor },
            ticks: { color: tickColor },
            grid: { color: gridColor }
          },
          y: {
            title: { display: true, text: 'STD 风险离散度 (Million Coins) ↑ 风险越高越靠上', color: tickColor },
            ticks: { color: tickColor, callback: v => v + 'M' },
            grid: { color: gridColor }
          }
        }
      }
    });
  }
}

// FlipCal Simulator Modal
function openSimulator(gem, tier, amount = 32000) {
  appState.currentSimGem = gem;
  appState.currentSimTier = tier;
  
  const modal = document.getElementById('simModal');
  const meta = appState.lastCalculationData.all_flips.find(f => f.gem === gem);
  
  const titleEl = document.getElementById('simGemTitle');
  titleEl.innerText = meta ? meta.gem_name : gem;
  titleEl.style.color = meta ? meta.color : '#ffffff';
  titleEl.style.textShadow = meta ? `0 0 12px ${meta.color}66` : 'none';

  const iconEl = document.getElementById('simGemIcon');
  iconEl.innerText = meta ? meta.icon : '✧';
  iconEl.style.color = meta ? meta.color : '#ffffff';

  const tierBadgeEl = document.getElementById('simGemTierBadge');
  if (tierBadgeEl) {
    const theme = getTierTheme(tier);
    tierBadgeEl.className = `${theme.badgeCls} px-2 py-0.5 rounded text-[11px] font-mono font-bold tracking-wide shadow-sm`;
    tierBadgeEl.innerText = `${theme.name} (${theme.rarityCn})`;
  }

  document.getElementById('simTierSelect').value = tier;
  document.getElementById('simAmountInput').value = amount || (tier === 'FLAWED' ? 32000 : 400);

  // Clear overrides
  document.getElementById('simPriceOverride').value = '';
  document.getElementById('simPerfectOverride').value = '';

  modal.classList.remove('hidden');
  runSimulation();
}

function closeSimulator() {
  document.getElementById('simModal').classList.add('hidden');
}

async function runSimulation() {
  const gem = appState.currentSimGem;
  const tier = document.getElementById('simTierSelect').value;
  const tierBadgeEl = document.getElementById('simGemTierBadge');
  if (tierBadgeEl) {
    const theme = getTierTheme(tier);
    tierBadgeEl.className = `${theme.badgeCls} px-2 py-0.5 rounded text-[11px] font-mono font-bold tracking-wide shadow-sm`;
    tierBadgeEl.innerText = `${theme.name} (${theme.rarityCn})`;
  }

  const amount = parseFloat(document.getElementById('simAmountInput').value) || 0;
  const priceOverride = parseFloat(document.getElementById('simPriceOverride').value) || null;
  const perfectOverride = parseFloat(document.getElementById('simPerfectOverride').value) || null;

  const payload = {
    gem: gem,
    tier: tier,
    amount: amount,
    buy_price_override: priceOverride,
    sell_price_override: priceOverride,
    perfect_sell_override: perfectOverride,
    tax_rate: appState.taxRate
  };

  try {
    const res = await fetch('/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const sim = await res.json();

    document.getElementById('simRoughTotal').innerText = formatCoins(sim.total_rough_equivalent);
    document.getElementById('simPerfectsCount').innerText = `${sim.perfects_crafted.toFixed(3)} 颗 (★Perfect)`;
    document.getElementById('simCrystalCost').innerText = formatCompact(sim.crystal_cost_total) + ' Coins';

    document.getElementById('simCostBO').innerText = formatCoins(sim.total_cost_buy_order);
    document.getElementById('simCostIB').innerText = formatCoins(sim.total_cost_instant_buy);
    document.getElementById('simRevenue').innerText = formatCoins(sim.perfect_revenue_net);

    const isProfitable = sim.max_profit > 0;
    const profitEl = document.getElementById('simMaxProfit');
    profitEl.innerText = (isProfitable ? '+' : '') + formatCoins(sim.max_profit);
    profitEl.className = 'font-mono font-bold text-base ' + (isProfitable ? 'text-emerald-400' : 'text-red-400');

    document.getElementById('simROI').innerText = formatPercent(sim.roi);
    document.getElementById('simMinProfit').innerText = formatCoins(sim.min_profit);

  } catch (err) {
    console.error('Simulation error:', err);
  }
}

// Player IGN Lookup (alpha 0.2.7: 注明 IGN 查询功能暂不可用)
async function syncPlayer() {
  const msgEl = document.getElementById('playerSyncMsg');
  if (msgEl) {
    msgEl.innerHTML = '<i class="fa-solid fa-circle-info mr-1"></i>IGN查询功能暂不可用';
    msgEl.className = 'text-[11px] text-amber-400 font-medium ml-1 whitespace-nowrap';
  }
  showTopToast('IGN 玩家信息查询功能暂不可用 (alpha 0.2.7)', 'error');
}

/**
 * 本地服务安全关停流程 (方式 2)
 * 注意：在未来上线部署至公网或小程序时，该前端交互连同后端接口一同移除
 */
async function confirmAndShutdownServer() {
  const confirmed = confirm(
    "【关停确认】\n\n确定要停止本地后端服务吗？\n\n• 将安全退出 Python / Uvicorn 后端进程；\n• 自动释放 8000 端口占用；\n• 关停后网页将无法继续刷新数据。\n\n如需重新使用，双击运行启动脚本或执行 python run_server.py 即可。"
  );
  if (!confirmed) return;

  const btn = document.getElementById('shutdownServerBtn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-xs"></i> <span>正在停止...</span>';
    btn.className = 'bg-slate-700 text-slate-400 border border-slate-600 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-not-allowed';
  }

  // 立即停止自动刷新轮询定时器
  if (appState.autoRefreshTimer) {
    clearInterval(appState.autoRefreshTimer);
    appState.autoRefreshTimer = null;
  }

  // 更新顶栏状态指示
  const dot = document.getElementById('apiStatusDot');
  const text = document.getElementById('apiStatusText');
  if (dot) {
    dot.className = 'w-2.5 h-2.5 rounded-full bg-red-500';
  }
  if (text) {
    text.innerText = '服务已关停';
  }

  try {
    const res = await fetch('/api/server/shutdown', { method: 'POST' });
    const data = await res.json();
    showShutdownOverlay(data.message || '本地服务已安全停止，8000 端口已释放。');
  } catch (err) {
    // 若服务进程瞬间退出导致网络请求中断，同样视作已成功停止
    showShutdownOverlay('本地服务已安全停止，8000 端口已释放。您可以安全关闭当前浏览器标签页。');
  }
}

function showShutdownOverlay(message) {
  // 如果已存在则不重复创建
  if (document.getElementById('shutdownModalOverlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'shutdownModalOverlay';
  overlay.className = 'fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in';
  overlay.innerHTML = `
    <div class="bg-[#181d2c] border border-red-500/40 rounded-2xl max-w-md w-full p-6 text-center shadow-2xl space-y-4">
      <div class="w-14 h-14 mx-auto rounded-full bg-red-500/20 text-red-400 flex items-center justify-center text-2xl border border-red-500/30">
        <i class="fa-solid fa-power-off"></i>
      </div>
      <h3 class="text-lg font-bold text-white">本地服务已停止</h3>
      <p class="text-xs text-slate-300 leading-relaxed">${message}</p>
      <div class="pt-2 border-t border-[#262e45]/80">
        <p class="text-[11px] text-slate-500">8000 端口已释放。如需再次开启，重新运行启动程序即可。</p>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

// ==============================================================================
// Bazaar 商品行情全览 (60 宝石 + 2 水晶道具预览表格 & 导出 Excel)
// ==============================================================================
let previewItemsCache = null;

async function openPricePreviewModal() {
  const modal = document.getElementById('previewModal');
  if (!modal) return;
  modal.classList.remove('hidden');

  const tbody = document.getElementById('previewTableBody');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="py-12 text-center text-slate-400">
          <i class="fa-solid fa-spinner fa-spin text-xl text-indigo-400 mr-2"></i>
          <span>正在获取 60 类宝石与 2 类水晶道具最新行情数据...</span>
        </td>
      </tr>
    `;
  }

  try {
    const res = await fetch('/api/bazaar/preview_items');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.detail || '获取数据失败');

    // 只保留最近 1 次查询结果，防止数据溢出
    previewItemsCache = data;

    // 转换系统本地时区时间显示
    const ts = data.timestamp_ms || Date.now();
    const localDate = new Date(ts);
    const timeZoneName = Intl.DateTimeFormat().resolvedOptions().timeZone || '系统时区';
    const formattedLocalTime = localDate.toLocaleString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    const tsEl = document.getElementById('previewTimestampLocal');
    if (tsEl) {
      tsEl.innerText = `${formattedLocalTime} (${timeZoneName})`;
    }

    renderPreviewTable(data.items);
  } catch (err) {
    console.error('获取商品预览失败:', err);
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="9" class="py-8 text-center text-rose-400">
            <i class="fa-solid fa-triangle-exclamation mr-1.5"></i>
            <span>获取商品预览数据失败: ${err.message || '网络异常'}</span>
          </td>
        </tr>
      `;
    }
  }
}

function closePricePreviewModal() {
  const modal = document.getElementById('previewModal');
  if (modal) modal.classList.add('hidden');
}

function renderPreviewTable(items) {
  const tbody = document.getElementById('previewTableBody');
  const countBadge = document.getElementById('previewCountBadge');
  if (!tbody) return;

  if (countBadge) {
    countBadge.innerText = `展示 ${items.length} / ${previewItemsCache ? previewItemsCache.total_items : 62} 项商品`;
  }

  if (!items || items.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="py-8 text-center text-slate-500">
          未检索到匹配的商品道具
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = items.map(item => {
    const isCrystal = item.gem === 'CRYSTAL';
    const tierColor = {
      'ROUGH': 'text-slate-400 bg-slate-800/40 border-slate-700',
      'FLAWED': 'text-emerald-400 bg-emerald-950/40 border-emerald-800',
      'FINE': 'text-blue-400 bg-blue-950/40 border-blue-800',
      'FLAWLESS': 'text-purple-400 bg-purple-950/40 border-purple-800',
      'PERFECT': 'text-amber-400 bg-amber-950/40 border-amber-800 font-bold',
      'CRYSTAL': 'text-cyan-300 bg-cyan-950/40 border-cyan-800 font-semibold'
    }[item.tier] || 'text-slate-300 bg-slate-800 border-slate-700';

    return `
      <tr class="hover:bg-[#181d2c]/80 transition border-b border-[#262e45]/40 text-[11px] font-mono">
        <!-- 序号 -->
        <td class="py-2.5 px-3 text-center text-slate-500">${item.index}</td>
        
        <!-- 商品道具名称 -->
        <td class="py-2.5 px-3">
          <div class="flex items-center space-x-2">
            <span class="w-2.5 h-2.5 rounded-full inline-block shrink-0" style="background-color: ${item.color || '#94a3b8'};"></span>
            <div>
              <span class="font-bold text-slate-200 text-xs">${item.gem_en}</span>
              <span class="text-slate-400 text-[11px] ml-1">(${item.gem_cn})</span>
            </div>
          </div>
        </td>

        <!-- 分类难度等级 -->
        <td class="py-2.5 px-3 text-center">
          <span class="px-2 py-0.5 rounded text-[10px] font-semibold border ${isCrystal ? 'bg-cyan-950/30 text-cyan-300 border-cyan-500/30' : 'bg-slate-800 text-slate-300 border-slate-700'}">
            ${item.grade}
          </span>
        </td>

        <!-- 品质 -->
        <td class="py-2.5 px-3 text-center">
          <span class="px-2 py-0.5 rounded text-[10px] border ${tierColor}">
            ${item.tier_en ? `${item.tier_en} (${item.tier_cn})` : item.tier_cn}
          </span>
        </td>

        <!-- 买价 (Buy Order) -->
        <td class="py-2.5 px-3 text-right font-bold text-amber-300">
          ${item.has_buy_order ? formatCoinsExact1Dec(item.buy_price) : '<span class="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold">断求 (No Order)</span>'}
        </td>

        <!-- 卖价 (Instant Buy) -->
        <td class="py-2.5 px-3 text-right text-slate-300">
          ${item.has_sell_offer ? formatCoinsExact1Dec(item.sell_price) : '<span class="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold">断供 (No Offer)</span>'}
        </td>

        <!-- 求购挂单量 -->
        <td class="py-2.5 px-3 text-right text-indigo-300">
          ${formatCoins(item.buy_volume)}
        </td>

        <!-- 在售现货量 -->
        <td class="py-2.5 px-3 text-right text-slate-400">
          ${formatCoins(item.sell_volume)}
        </td>

        <!-- 7天周交易量 -->
        <td class="py-2.5 px-3 text-right text-emerald-400 font-semibold">
          ${formatCoins(item.weekly_volume)}
        </td>
      </tr>
    `;
  }).join('');
}

function filterPreviewTable() {
  if (!previewItemsCache || !previewItemsCache.items) return;
  const input = document.getElementById('previewSearchInput');
  const query = (input ? input.value : '').trim().toLowerCase();
  if (!query) {
    renderPreviewTable(previewItemsCache.items);
    return;
  }
  const filtered = previewItemsCache.items.filter(item => {
    const hay = `${item.gem_en} ${item.gem_cn} ${item.tier} ${item.tier_en || ''} ${item.tier_cn} ${item.item_id} ${item.grade} ${item.display_name}`.toLowerCase();
    return hay.includes(query);
  });
  renderPreviewTable(filtered);
}

async function copyPreviewTableToExcel() {
  if (!previewItemsCache || !previewItemsCache.items || previewItemsCache.items.length === 0) {
    alert('暂无可复制的商品数据，请等待数据加载完成');
    return;
  }

  const items = previewItemsCache.items;
  const tsText = document.getElementById('previewTimestampLocal')?.innerText || '';

  // TSV Header & Rows for seamless Excel paste
  const headerCols = [
    '序号',
    '商品英文名',
    '商品中文名',
    '品质英文',
    '品质中文',
    '系统ID',
    '分类难度',
    '买价(Buy Order预购)',
    '卖价(Instant Buy秒买)',
    '求购挂单量',
    '在售现货量',
    '7天周交易量',
    '盘口状态'
  ];

  const rows = items.map(it => [
    it.index,
    it.gem_en,
    it.gem_cn,
    it.tier_en || it.tier,
    it.tier_cn,
    it.item_id,
    it.grade,
    it.has_buy_order ? it.buy_price : '断求 (No Order)',
    it.has_sell_offer ? it.sell_price : '断供 (No Offer)',
    it.buy_volume,
    it.sell_volume,
    it.weekly_volume,
    it.order_anomaly || '正常'
  ].join('\t'));

  const tsv = [
    `# Hypixel Bazaar 宝石与水晶行情全览 (数据时间: ${tsText})`,
    headerCols.join('\t'),
    ...rows
  ].join('\n');

  try {
    await navigator.clipboard.writeText(tsv);
    showCopyToast('已成功复制全部 62 项商品数据！可在 Excel / WPS 中直接按 Ctrl+V 粘贴。');
  } catch (err) {
    // Fallback using textarea
    const ta = document.createElement('textarea');
    ta.value = tsv;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      showCopyToast('已成功复制全部 62 项商品数据！可在 Excel / WPS 中直接按 Ctrl+V 粘贴。');
    } catch (e) {
      alert('复制到剪贴板失败，请手动选择复制。');
    }
    document.body.removeChild(ta);
  }
}

function showCopyToast(msg) {
  let toast = document.getElementById('copySuccessToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'copySuccessToast';
    toast.className = 'fixed bottom-8 right-8 z-[100] bg-emerald-600 text-white font-medium text-xs px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 animate-bounce transition';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<i class="fa-solid fa-circle-check text-sm"></i> <span>${msg}</span>`;
  toast.style.display = 'flex';
  setTimeout(() => {
    if (toast) toast.style.display = 'none';
  }, 3500);
}

// Global modal ESC and backdrop dismissal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closePricePreviewModal();
  }
});

document.addEventListener('click', (e) => {
  const modal = document.getElementById('previewModal');
  if (modal && e.target === modal) {
    closePricePreviewModal();
  }
});

// =============================================================================
// SHARDTRACKER CONTROLLER & RENDER ENGINE (alpha 3.0.0)
// =============================================================================

const shardAppState = {
  loaded: false,
  items: [],
  filteredItems: [],
  summary: null,
  playerInfo: null,
  ign: localStorage.getItem('skyblock_shard_ign') || '',
  selectedProfile: null,
  priceMode: 'bo', // 'bo' = Buy Order, 'ib' = Instant Buy
  viewMode: localStorage.getItem('skyblock_shard_view_mode') || 'full', // 'full' or 'compact'
  limit: -1, // -1 means all, or 10, 20, 50, 100
  strategyFilter: 'all', // 'all', 'unfinished', 'cheapest_xp', 'echo', 'atomized', 'global'
  rarityFilter: 'ALL', // 'ALL', 'C', 'U', 'R', 'E', 'L'
  searchQuery: '',
  sortCol: 'coins_per_xp',
  sortDir: 'asc', // 'asc' or 'desc'
  isLoading: false
};

function switchMainTab(tab) {
  const gemBtn = document.getElementById('tabGemFlipperBtn');
  const shardBtn = document.getElementById('tabShardTrackerBtn');
  const ghBtn = document.getElementById('tabGreenhouseBtn');
  const gemView = document.getElementById('gemFlipperView');
  const shardView = document.getElementById('shardTrackerView');
  const ghView = document.getElementById('greenhouseTrackerView');

  if (!gemBtn || !shardBtn || !gemView || !shardView) return;

  const inactiveClass = "px-4 py-2 rounded-xl font-bold text-xs sm:text-sm flex items-center space-x-2 transition shadow-sm bg-[#181d2c] text-slate-300 hover:text-white hover:bg-slate-800 border border-[#262e45] inactive";

  if (tab === 'gemflipper') {
    gemBtn.className = "px-4 py-2 rounded-xl font-bold text-xs sm:text-sm flex items-center space-x-2 transition shadow-sm bg-indigo-600 text-white";
    shardBtn.className = inactiveClass;
    if (ghBtn) ghBtn.className = inactiveClass;
    gemView.classList.remove('hidden');
    shardView.classList.add('hidden');
    if (ghView) ghView.classList.add('hidden');
  } else if (tab === 'shardtracker') {
    shardBtn.className = "px-4 py-2 rounded-xl font-bold text-xs sm:text-sm flex items-center space-x-2 transition shadow-sm bg-emerald-600 text-white";
    gemBtn.className = inactiveClass;
    if (ghBtn) ghBtn.className = inactiveClass;
    gemView.classList.add('hidden');
    shardView.classList.remove('hidden');
    if (ghView) ghView.classList.add('hidden');

    if (!shardAppState.loaded) {
      fetchShardTrackerData();
    }
  } else if (tab === 'greenhouse') {
    if (ghBtn) ghBtn.className = "px-4 py-2 rounded-xl font-bold text-xs sm:text-sm flex items-center space-x-2 transition shadow-sm bg-lime-600 text-white shadow-lime-900/40";
    gemBtn.className = inactiveClass;
    shardBtn.className = inactiveClass;
    gemView.classList.add('hidden');
    shardView.classList.add('hidden');
    if (ghView) ghView.classList.remove('hidden');

    if (typeof initGreenhouseTracker === 'function') {
      initGreenhouseTracker();
    }
  }
}

function initShardTracker() {
  updateShardViewModeButtons();
  const ignInput = document.getElementById('shardIgnInput');
  if (ignInput) {
    if (shardAppState.ign) {
      ignInput.value = shardAppState.ign;
      const clearBtn = document.getElementById('shardIgnClearBtn');
      if (clearBtn) clearBtn.classList.remove('hidden');
    }
    ignInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        syncShardPlayerProfile();
      }
    });
    ignInput.addEventListener('input', (e) => {
      const clearBtn = document.getElementById('shardIgnClearBtn');
      if (clearBtn) {
        if (e.target.value) clearBtn.classList.remove('hidden');
        else clearBtn.classList.add('hidden');
      }
    });
  }
}

function clearShardIgn() {
  const ignInput = document.getElementById('shardIgnInput');
  if (ignInput) ignInput.value = '';
  const clearBtn = document.getElementById('shardIgnClearBtn');
  if (clearBtn) clearBtn.classList.add('hidden');
  shardAppState.ign = '';
  localStorage.removeItem('skyblock_shard_ign');
  const profileWrapper = document.getElementById('shardProfileWrapper');
  if (profileWrapper) profileWrapper.classList.add('hidden');
  const saveBadge = document.getElementById('shardLastSaveBadge');
  if (saveBadge) saveBadge.classList.add('hidden');
  fetchShardTrackerData('', null);
}

async function fetchShardTrackerData(ignParam, profileParam, force = false) {
  const spinner = document.getElementById('shardSyncSpinner');
  const syncBtn = document.getElementById('shardSyncBtn');
  if (spinner) spinner.classList.add('fa-spin');
  if (syncBtn) syncBtn.disabled = true;

  const targetIgn = ignParam !== undefined ? ignParam : shardAppState.ign;
  const targetProfile = profileParam !== undefined ? profileParam : shardAppState.selectedProfile;

  let url = `/api/shards?force=${force}`;
  if (targetIgn && targetIgn.trim()) {
    url += `&ign=${encodeURIComponent(targetIgn.trim())}`;
    if (targetProfile) {
      url += `&profile=${encodeURIComponent(targetProfile)}`;
    }
  }

  try {
    const res = await fetch(url);
    const data = await res.json();
    if (data.success) {
      shardAppState.items = data.items || [];
      shardAppState.summary = data.summary || {};
      shardAppState.playerInfo = data.player_info || null;
      shardAppState.loaded = true;

      // Update summary cards
      updateShardSummaryUI(data.summary, data.player_info);

      // Update player profile options
      if (data.player_info && data.player_info.profiles_list) {
        renderShardProfileDropdown(data.player_info);
      }

      if (data.player_warning) {
        showTopToast(data.player_warning, 'warning');
      }

      applyShardFiltersAndRender();
    } else {
      showTopToast(data.message || '获取 Shard 数据失败', 'error');
    }
  } catch (err) {
    console.error('Shard fetch error:', err);
    showTopToast('连接后端 Shard 接口失败，请检查网络', 'error');
  } finally {
    if (spinner) spinner.classList.remove('fa-spin');
    if (syncBtn) syncBtn.disabled = false;
  }
}

function updateShardSummaryUI(summary, playerInfo) {
  if (!summary) return;
  // Card 1: Maxed Progress
  const maxedCountEl = document.getElementById('statMaxedCount');
  const maxedPctEl = document.getElementById('statMaxedPct');
  const maxedBarEl = document.getElementById('statMaxedBar');
  if (maxedCountEl) maxedCountEl.innerText = `${summary.total_maxed} / ${summary.total_tracked}`;
  if (maxedPctEl) maxedPctEl.innerText = `(${summary.maxed_pct}%)`;
  if (maxedBarEl) maxedBarEl.style.width = `${summary.maxed_pct}%`;

  // Card 2: SkyBlock XP
  const xpCountEl = document.getElementById('statXpCount');
  const xpPctEl = document.getElementById('statXpPct');
  const xpBarEl = document.getElementById('statXpBar');
  if (xpCountEl) xpCountEl.innerText = `${summary.total_xp_earned.toLocaleString()} / ${summary.total_possible_xp.toLocaleString()}`;
  if (xpPctEl) xpPctEl.innerText = `(${summary.xp_pct}%)`;
  if (xpBarEl) xpBarEl.style.width = `${summary.xp_pct}%`;

  // Card 3: Eaten Shards
  const eatenCountEl = document.getElementById('statEatenCount');
  const remShardsEl = document.getElementById('statRemainingShards');
  if (eatenCountEl) eatenCountEl.innerText = `${summary.total_eaten_shards.toLocaleString()} / ${summary.total_shards_needed.toLocaleString()}`;
  if (remShardsEl) remShardsEl.innerText = `${(summary.total_shards_needed - summary.total_eaten_shards).toLocaleString()}`;

  // Card 4 & 5: Cost to Max
  const costBoEl = document.getElementById('statCostBo');
  const costIbEl = document.getElementById('statCostIb');
  if (costBoEl) costBoEl.innerText = `${formatCoinsCompact(summary.total_cost_max_order)} Coins`;
  if (costIbEl) costIbEl.innerText = `${formatCoinsCompact(summary.total_cost_max_instant)} Coins`;

  // Rarity bars
  const rMaxed = summary.rarity_maxed || {};
  const rCounts = summary.rarity_counts || {};
  ['C', 'U', 'R', 'E', 'L'].forEach(r => {
    const textEl = document.getElementById(`rarityText${r}`);
    const barEl = document.getElementById(`rarityBar${r}`);
    const m = rMaxed[r] || 0;
    const c = rCounts[r] || 1;
    const pct = Math.round((m / c) * 100);
    if (textEl) textEl.innerText = `${m}/${c}`;
    if (barEl) barEl.style.width = `${pct}%`;
  });

  // Last Save Badge
  const saveBadge = document.getElementById('shardLastSaveBadge');
  const saveText = document.getElementById('shardLastSaveText');
  if (playerInfo && playerInfo.last_save_ms) {
    if (saveBadge) saveBadge.classList.remove('hidden');
    if (saveText) saveText.innerText = formatDateTimeLocal(playerInfo.last_save_ms);
  } else {
    if (saveBadge) saveBadge.classList.add('hidden');
  }
}

function renderShardProfileDropdown(playerInfo) {
  const wrapper = document.getElementById('shardProfileWrapper');
  const select = document.getElementById('shardProfileSelect');
  if (!wrapper || !select) return;

  wrapper.classList.remove('hidden');
  select.innerHTML = '';

  const profiles = playerInfo.profiles_list || [];
  profiles.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.cute_name;
    opt.innerText = `${p.cute_name}${p.selected ? ' ★(当前)' : ''}`;
    if (playerInfo.cute_name === p.cute_name) {
      opt.selected = true;
    }
    select.appendChild(opt);
  });
}

function onShardProfileChange() {
  const select = document.getElementById('shardProfileSelect');
  if (!select) return;
  const chosenProfile = select.value;
  shardAppState.selectedProfile = chosenProfile;
  fetchShardTrackerData(shardAppState.ign, chosenProfile);
}

function syncShardPlayerProfile() {
  const ignInput = document.getElementById('shardIgnInput');
  if (!ignInput) return;
  const ign = ignInput.value.trim();
  if (!ign) {
    showTopToast('请输入有效的玩家 IGN', 'warning');
    return;
  }
  shardAppState.ign = ign;
  localStorage.setItem('skyblock_shard_ign', ign);
  fetchShardTrackerData(ign, null);
}

function refreshShardData() {
  showTopToast('正在拉取最新 Bazaar 实时价格与 Shard 进度...', 'info');
  fetchShardTrackerData(shardAppState.ign, shardAppState.selectedProfile, true);
}

function setShardPriceMode(mode) {
  shardAppState.priceMode = mode;
  const boBtn = document.getElementById('priceModeBoBtn');
  const ibBtn = document.getElementById('priceModeIbBtn');

  if (mode === 'bo') {
    boBtn.className = "px-2.5 py-1 rounded-md font-semibold transition bg-emerald-600 text-white shadow-sm";
    ibBtn.className = "px-2.5 py-1 rounded-md font-semibold transition text-slate-400 hover:text-white";
  } else {
    ibBtn.className = "px-2.5 py-1 rounded-md font-semibold transition bg-sky-600 text-white shadow-sm";
    boBtn.className = "px-2.5 py-1 rounded-md font-semibold transition text-slate-400 hover:text-white";
  }

  applyShardFiltersAndRender();
}

function setShardLimit(limit) {
  shardAppState.limit = limit;
  const buttons = document.querySelectorAll('.shard-limit-btn');
  buttons.forEach(btn => {
    const l = parseInt(btn.getAttribute('data-limit'));
    if (l === limit) {
      btn.className = "shard-limit-btn px-2.5 py-1 rounded-md text-[11px] font-semibold transition bg-indigo-600 text-white shadow-sm";
    } else {
      btn.className = "shard-limit-btn px-2.5 py-1 rounded-md text-[11px] font-semibold transition text-slate-300 hover:text-white";
    }
  });
  applyShardFiltersAndRender();
}

function setShardStrategyFilter(filter) {
  shardAppState.strategyFilter = filter;
  const buttons = document.querySelectorAll('.shard-strat-btn');
  buttons.forEach(btn => {
    const f = btn.getAttribute('data-filter');
    if (f === filter) {
      btn.className = "shard-strat-btn px-3 py-1 rounded-lg text-xs font-semibold transition bg-indigo-600 text-white shadow-sm";
    } else {
      btn.className = "shard-strat-btn px-3 py-1 rounded-lg text-xs font-semibold transition bg-[#111520] text-slate-300 hover:text-white border border-[#262e45]";
    }
  });

  if (filter === 'cheapest_xp') {
    shardAppState.sortCol = 'coins_per_xp';
    shardAppState.sortDir = 'asc';
  }

  applyShardFiltersAndRender();
}

function setShardRarityFilter(rarity) {
  shardAppState.rarityFilter = rarity;
  const buttons = document.querySelectorAll('.shard-rarity-btn');
  buttons.forEach(btn => {
    const r = btn.getAttribute('data-rarity');
    if (r === rarity) {
      btn.className = "shard-rarity-btn px-2.5 py-1 rounded-md text-[11px] font-semibold transition bg-indigo-600 text-white shadow-sm";
    } else {
      btn.className = "shard-rarity-btn px-2 py-1 rounded-md text-[11px] font-semibold transition bg-[#111520] text-slate-300 hover:text-white border border-[#262e45]";
    }
  });
  applyShardFiltersAndRender();
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function setShardViewMode(mode) {
  shardAppState.viewMode = mode;
  localStorage.setItem('skyblock_shard_view_mode', mode);
  updateShardViewModeButtons();
  applyShardFiltersAndRender();
}

function updateShardViewModeButtons() {
  const fullBtn = document.getElementById('shardViewModeFullBtn');
  const compactBtn = document.getElementById('shardViewModeCompactBtn');
  if (fullBtn && compactBtn) {
    if (shardAppState.viewMode === 'compact') {
      compactBtn.className = "shard-view-btn px-2.5 py-1 rounded-md text-[11px] font-semibold transition bg-indigo-600 text-white shadow-sm";
      fullBtn.className = "shard-view-btn px-2.5 py-1 rounded-md text-[11px] font-semibold transition text-slate-300 hover:text-white";
    } else {
      fullBtn.className = "shard-view-btn px-2.5 py-1 rounded-md text-[11px] font-semibold transition bg-indigo-600 text-white shadow-sm";
      compactBtn.className = "shard-view-btn px-2.5 py-1 rounded-md text-[11px] font-semibold transition text-slate-300 hover:text-white";
    }
  }
}

function toggleShardEffect(boxEl) {
  const textEl = boxEl.querySelector('.shard-effect-text');
  if (!textEl) return;
  if (textEl.classList.contains('collapsed')) {
    textEl.classList.remove('collapsed');
    textEl.classList.add('expanded');
    boxEl.setAttribute('title', '点击收起属性效果描述');
  } else {
    textEl.classList.remove('expanded');
    textEl.classList.add('collapsed');
    boxEl.setAttribute('title', '点击展开完整属性效果描述');
  }
}

function toggleShardExportDropdown(event) {
  if (event) event.stopPropagation();
  const menu = document.getElementById('exportShardDropdownMenu');
  if (menu) {
    menu.classList.toggle('hidden');
  }
}

function hideShardExportDropdown() {
  const menu = document.getElementById('exportShardDropdownMenu');
  if (menu) {
    menu.classList.add('hidden');
  }
}

document.addEventListener('click', (e) => {
  const container = document.getElementById('shardExportDropdownContainer');
  if (container && !container.contains(e.target)) {
    hideShardExportDropdown();
  }
});

function exportShardDictionaryCSV() {
  if (!shardAppState.items || shardAppState.items.length === 0) {
    showTopToast('暂无可导出的 Shard 词典数据', 'warning');
    return;
  }

  const headers = [
    'Tag',
    'ShardID',
    'ShardName',
    'AttributeName',
    'Rarity',
    'RarityLVL',
    'TotalRequired',
    'Category',
    'ShardFamily',
    'Acquisition',
    'AttributeEffect',
    'HowToHunt'
  ];

  const rows = [headers.join(',')];

  const dictItems = [...shardAppState.items].sort((a, b) => 
    a.tag.localeCompare(b.tag, undefined, { numeric: true, sensitivity: 'base' })
  );

  dictItems.forEach(item => {
    const row = [
      `"${item.tag}"`,
      `"${item.shard_id}"`,
      `"${(item.shard_name || '').replace(/"/g, '""')}"`,
      `"${(item.attribute_name || '').replace(/"/g, '""')}"`,
      `"${item.rarity}"`,
      item.rarity_lvl || 1,
      item.max_total || 96,
      `"${(item.category || '').replace(/"/g, '""')}"`,
      `"${(item.shard_family || '').replace(/"/g, '""')}"`,
      `"${(item.acquisition || '').replace(/"/g, '""')}"`,
      `"${(item.attribute_effect || '').replace(/"/g, '""')}"`,
      `"${(item.how_to_hunt || '').replace(/"/g, '""')}"`
    ];
    rows.push(row.join(','));
  });

  const csvContent = '\uFEFF' + rows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  a.href = url;
  a.download = `SkyBlock_Shards_Master_Dictionary_325_${dateStr}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showTopToast('325全Shard官方词典知识库已成功导出 CSV！', 'success');
}

function onShardSearchInput() {
  const input = document.getElementById('shardSearchInput');
  const clearBtn = document.getElementById('shardSearchClearBtn');
  if (input) {
    shardAppState.searchQuery = input.value.trim();
    if (clearBtn) {
      if (input.value) clearBtn.classList.remove('hidden');
      else clearBtn.classList.add('hidden');
    }
  }
  applyShardFiltersAndRender();
}

function clearShardSearch() {
  const input = document.getElementById('shardSearchInput');
  const clearBtn = document.getElementById('shardSearchClearBtn');
  if (input) input.value = '';
  if (clearBtn) clearBtn.classList.add('hidden');
  shardAppState.searchQuery = '';
  applyShardFiltersAndRender();
}

function sortShards(col) {
  if (shardAppState.sortCol === col) {
    shardAppState.sortDir = shardAppState.sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    shardAppState.sortCol = col;
    if (['coins_per_xp', 'cost_to_max', 'cost_to_next', 'unit_price', 'remaining_to_max'].includes(col)) {
      shardAppState.sortDir = 'asc';
    } else {
      shardAppState.sortDir = 'desc';
    }
  }
  applyShardFiltersAndRender();
}

function applyShardFiltersAndRender() {
  let list = [...shardAppState.items];

  // 1. Rarity Filter
  if (shardAppState.rarityFilter !== 'ALL') {
    list = list.filter(item => item.rarity === shardAppState.rarityFilter);
  }

  // 2. Strategy Filter
  if (shardAppState.strategyFilter === 'unfinished') {
    list = list.filter(item => item.remaining_to_max > 0);
  } else if (shardAppState.strategyFilter === 'cheapest_xp') {
    list = list.filter(item => item.remaining_to_max > 0 && (shardAppState.priceMode === 'bo' ? item.coins_per_max_xp_bo > 0 : item.coins_per_max_xp_ib > 0));
  } else if (shardAppState.strategyFilter === 'echo') {
    list = list.filter(item => item.synergy_tag && item.synergy_tag.includes('Echo'));
  } else if (shardAppState.strategyFilter === 'atomized') {
    list = list.filter(item => item.synergy_tag && item.synergy_tag.includes('Atomized'));
  } else if (shardAppState.strategyFilter === 'global') {
    list = list.filter(item => item.category === 'Global' || (item.synergy_tag && item.synergy_tag.includes('Global')));
  }

  // 3. Search Query Filter
  if (shardAppState.searchQuery) {
    const q = shardAppState.searchQuery.toLowerCase();
    list = list.filter(item => {
      return (
        (item.shard_name && item.shard_name.toLowerCase().includes(q)) ||
        (item.attribute_name && item.attribute_name.toLowerCase().includes(q)) ||
        (item.tag && item.tag.toLowerCase().includes(q)) ||
        (item.category && item.category.toLowerCase().includes(q)) ||
        (item.shard_family && item.shard_family.toLowerCase().includes(q)) ||
        (item.attribute_effect && item.attribute_effect.toLowerCase().includes(q)) ||
        (item.how_to_hunt && item.how_to_hunt.toLowerCase().includes(q)) ||
        (item.bazaar_product_id && item.bazaar_product_id.toLowerCase().includes(q))
      );
    });
  }

  // 4. Sort
  const mode = shardAppState.priceMode;
  const col = shardAppState.sortCol;
  const dir = shardAppState.sortDir === 'asc' ? 1 : -1;

  list.sort((a, b) => {
    let valA = 0;
    let valB = 0;

    switch (col) {
      case 'tag':
        return dir * a.tag.localeCompare(b.tag, undefined, { numeric: true, sensitivity: 'base' });
      case 'shard_name':
        return dir * a.shard_name.localeCompare(b.shard_name);
      case 'category':
        return dir * a.category.localeCompare(b.category);
      case 'shard_family':
        return dir * (a.shard_family || '').localeCompare(b.shard_family || '');
      case 'progress':
        valA = a.completion_pct;
        valB = b.completion_pct;
        break;
      case 'remaining_to_max':
        valA = a.remaining_to_max;
        valB = b.remaining_to_max;
        break;
      case 'cost_to_next':
        valA = mode === 'bo' ? a.cost_to_next_bo : a.cost_to_next_ib;
        valB = mode === 'bo' ? b.cost_to_next_bo : b.cost_to_next_ib;
        break;
      case 'unit_price':
        valA = mode === 'bo' ? a.bo_price : a.ib_price;
        valB = mode === 'bo' ? b.bo_price : b.ib_price;
        break;
      case 'cost_to_max':
        valA = mode === 'bo' ? a.cost_to_max_bo : a.cost_to_max_ib;
        valB = mode === 'bo' ? b.cost_to_max_bo : b.cost_to_max_ib;
        if (dir === 1) {
          if (valA === 0 && valB > 0) return 1;
          if (valB === 0 && valA > 0) return -1;
        }
        break;
      case 'coins_per_xp':
        valA = mode === 'bo' ? a.coins_per_max_xp_bo : a.coins_per_max_xp_ib;
        valB = mode === 'bo' ? b.coins_per_max_xp_bo : b.coins_per_max_xp_ib;
        if (dir === 1) {
          if (valA === 0 && valB > 0) return 1;
          if (valB === 0 && valA > 0) return -1;
        }
        break;
      case 'weekly_volume':
        valA = a.weekly_volume;
        valB = b.weekly_volume;
        break;
      default:
        valA = a.coins_per_max_xp_bo;
        valB = b.coins_per_max_xp_bo;
    }

    return dir * (valA - valB);
  });

  const filteredCountEl = document.getElementById('shardFilteredCount');
  if (filteredCountEl) filteredCountEl.innerText = list.length;

  // 5. Limit
  let displayList = list;
  if (shardAppState.limit > 0) {
    displayList = list.slice(0, shardAppState.limit);
  }

  const showingCountEl = document.getElementById('shardShowingCount');
  if (showingCountEl) showingCountEl.innerText = displayList.length;

  updateShardSortIcons();
  renderShardRows(displayList);
}

function updateShardSortIcons() {
  const cols = ['tag', 'shard_name', 'category', 'shard_family', 'progress', 'remaining_to_max', 'cost_to_next', 'unit_price', 'cost_to_max', 'coins_per_xp', 'weekly_volume'];
  cols.forEach(c => {
    const icon = document.getElementById(`sort_icon_${c}`);
    if (icon) {
      if (shardAppState.sortCol === c) {
        icon.innerText = shardAppState.sortDir === 'asc' ? '▲' : '▼';
        icon.className = 'ml-0.5 text-[10px] text-amber-400 font-bold';
      } else {
        icon.innerText = '↕';
        icon.className = 'ml-0.5 text-[10px] text-slate-500';
      }
    }
  });
}

function renderShardRows(list) {
  const tbody = document.getElementById('shardTableBody');
  if (!tbody) return;

  const isCompact = shardAppState.viewMode === 'compact';
  const tableEl = document.getElementById('shardMasterTable');
  if (tableEl) {
    if (isCompact) tableEl.classList.add('shard-table-compact');
    else tableEl.classList.remove('shard-table-compact');
  }

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="12" class="py-12 text-center text-slate-400 font-sans">
          <i class="fa-solid fa-folder-open text-2xl text-slate-500 mb-2 block"></i>
          <span>未找到符合筛选条件的 Shard</span>
        </td>
      </tr>
    `;
    return;
  }

  const mode = shardAppState.priceMode;

  // Find max values in current list for in-cell data bars
  let maxUnitPrice = 1;
  let maxCostToMax = 1;
  list.forEach(item => {
    const up = mode === 'bo' ? item.bo_price : item.ib_price;
    const ctm = mode === 'bo' ? item.cost_to_max_bo : item.cost_to_max_ib;
    if (up > maxUnitPrice) maxUnitPrice = up;
    if (ctm > maxCostToMax) maxCostToMax = ctm;
  });

  let html = '';

  list.forEach(item => {
    const isMaxed = item.is_maxed;
    const unitPrice = mode === 'bo' ? item.bo_price : item.ib_price;
    const costToNext = mode === 'bo' ? item.cost_to_next_bo : item.cost_to_next_ib;
    const costToMax = mode === 'bo' ? item.cost_to_max_bo : item.cost_to_max_ib;
    const coinsPerXp = mode === 'bo' ? item.coins_per_max_xp_bo : item.coins_per_max_xp_ib;

    const rarityClass = `shard-rarity-${item.rarity.toLowerCase()}`;
    const rarityNameColorClass = `shard-name-${item.rarity.toLowerCase()}`;
    
    let synergyBadge = '';
    if (item.synergy_tag && item.synergy_tag.includes('Echo')) {
      synergyBadge = `<span class="px-1.5 py-0.2 rounded text-[10px] bg-purple-500/20 text-purple-300 border border-purple-500/40 ml-1">Echo</span>`;
    } else if (item.synergy_tag && item.synergy_tag.includes('Atomized')) {
      synergyBadge = `<span class="px-1.5 py-0.2 rounded text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 ml-1">Atom</span>`;
    } else if (item.synergy_tag && item.synergy_tag.includes('Global')) {
      synergyBadge = `<span class="px-1.5 py-0.2 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 ml-1">Global</span>`;
    }

    // Progress column
    let progressHtml = '';
    if (isMaxed) {
      progressHtml = `
        <div class="flex items-center justify-center">
          <span class="shard-badge-max px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide shadow-sm">
            <i class="fa-solid fa-crown text-[9px] mr-1"></i>MAX
          </span>
        </div>
      `;
    } else if (isCompact) {
      progressHtml = `
        <div class="text-center font-mono text-[11px] text-slate-300 whitespace-nowrap">
          <span>${item.current_eaten}/${item.max_total}</span>
          <span class="text-emerald-400 ml-1">(${item.completion_pct}%)</span>
        </div>
      `;
    } else {
      progressHtml = `
        <div class="space-y-1">
          <div class="flex justify-between text-[11px] text-slate-300 font-mono">
            <span>${item.current_eaten} / ${item.max_total}</span>
            <span class="text-slate-400 text-[10px]">${item.completion_pct}%</span>
          </div>
          <div class="w-full bg-[#111520] rounded-full h-1.5 overflow-hidden">
            <div class="bg-gradient-to-r from-emerald-500 to-teal-400 h-1.5 rounded-full" style="width: ${item.completion_pct}%"></div>
          </div>
        </div>
      `;
    }

    // Next Level column
    let nextLevelHtml = '';
    if (isMaxed) {
      nextLevelHtml = `<span class="text-slate-500 text-[11px]">-</span>`;
    } else if (isCompact) {
      nextLevelHtml = `
        <div class="text-right whitespace-nowrap font-mono text-[11px]">
          <span class="text-slate-200 font-bold">+${item.shards_to_next}</span>
          <span class="text-slate-400 text-[10px] ml-1">(${formatCoinsCompact(costToNext)})</span>
        </div>
      `;
    } else {
      nextLevelHtml = `
        <div class="text-right whitespace-nowrap">
          <div class="text-slate-200 font-bold">+${item.shards_to_next} 块</div>
          <div class="text-[10px] text-slate-400">${formatCoinsCompact(costToNext)}</div>
        </div>
      `;
    }

    // Remaining column
    let remainingHtml = '';
    if (isMaxed) {
      remainingHtml = `<span class="text-amber-400 font-bold text-[11px] font-mono">0</span>`;
    } else if (isCompact) {
      remainingHtml = `<span class="text-slate-200 font-mono font-bold text-xs">${item.remaining_to_max}</span>`;
    } else {
      remainingHtml = `
        <div class="text-center font-mono">
          <span class="text-slate-200 font-bold text-xs">${item.remaining_to_max}</span>
          <span class="text-[10px] text-slate-400 font-sans ml-0.5">块</span>
        </div>
      `;
    }

    // Cost to Max column with data bar (clean single price line)
    const costToMaxBarPct = Math.min(100, Math.max(0, (costToMax / maxCostToMax) * 100));
    let costToMaxHtml = '';
    if (isMaxed) {
      costToMaxHtml = `<span class="text-amber-400 font-bold text-[11px]">0 (已拉满)</span>`;
    } else {
      const maxOrderBadge = mode === 'bo'
        ? '<span class="text-[9px] text-emerald-400/80 font-mono ml-1 font-semibold">[BO]</span>'
        : '<span class="text-[9px] text-sky-400/80 font-mono ml-1 font-semibold">[IB]</span>';

      costToMaxHtml = `
        <div class="shard-cell-bar-container text-right">
          <div class="shard-cell-bar-bg bg-emerald-500/20" style="width: ${costToMaxBarPct.toFixed(1)}%;"></div>
          <div class="relative z-10 flex items-center justify-end whitespace-nowrap">
            <span class="${isCompact ? 'text-xs' : 'text-sm'} font-black font-mono text-emerald-400">${formatCoinsCompact(costToMax)}</span>
            ${maxOrderBadge}
          </div>
        </div>
      `;
    }

    // Coins per XP column
    let coinsPerXpHtml = '';
    if (isMaxed) {
      coinsPerXpHtml = `<span class="text-slate-500 text-[11px]">-</span>`;
    } else if (isCompact) {
      coinsPerXpHtml = `
        <div class="text-right whitespace-nowrap">
          <span class="font-extrabold text-indigo-300 text-xs">${formatCoinsCompact(coinsPerXp)}</span>
        </div>
      `;
    } else {
      coinsPerXpHtml = `
        <div class="text-right whitespace-nowrap">
          <span class="font-extrabold text-indigo-300 text-xs">${formatCoinsCompact(coinsPerXp)}</span>
          <span class="text-[10px] text-indigo-400/80 font-sans block">/ XP</span>
        </div>
      `;
    }

    // Unit Price column with data bar
    const unitPriceBarPct = Math.min(100, Math.max(0, (unitPrice / maxUnitPrice) * 100));
    const priceOrderBadge = mode === 'bo'
      ? '<span class="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono ml-1 font-semibold">BO</span>'
      : '<span class="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono ml-1 font-semibold">IB</span>';

    let unitPriceHtml = `
      <div class="shard-cell-bar-container text-right">
        <div class="shard-cell-bar-bg bg-amber-500/15" style="width: ${unitPriceBarPct.toFixed(1)}%;"></div>
        <div class="relative z-10 flex items-center justify-end whitespace-nowrap">
          <span class="${isCompact ? 'text-xs' : 'text-sm'} font-black font-mono text-slate-100">${formatCoinsCompact(unitPrice)}</span>
          ${priceOrderBadge}
        </div>
        ${(!isCompact && item.order_anomaly) ? `<span class="text-[9px] px-1 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-sans inline-block mt-0.5">${item.order_anomaly}</span>` : ''}
      </div>
    `;

    // Volume column with conditional heat gradient
    let volHeatClass = 'vol-heat-low';
    if (item.weekly_volume >= 20000) {
      volHeatClass = 'vol-heat-high';
    } else if (item.weekly_volume >= 3000) {
      volHeatClass = 'vol-heat-med';
    }

    let volumeHtml = '';
    if (isCompact) {
      volumeHtml = `
        <div class="text-right px-1.5 py-0.5 rounded ${volHeatClass} transition-all whitespace-nowrap">
          <span class="font-bold font-mono text-xs">${formatVolumeCompact(item.weekly_volume)}</span>
          <span class="text-[10px] opacity-75 font-sans ml-1">(${item.orders_count || 0}单)</span>
        </div>
      `;
    } else {
      volumeHtml = `
        <div class="text-right px-2 py-1 rounded-lg ${volHeatClass} transition-all">
          <div class="font-bold font-mono text-xs">${formatVolumeCompact(item.weekly_volume)}</div>
          <div class="text-[10px] opacity-80 font-sans">${item.orders_count || 0} 挂单</div>
        </div>
      `;
    }

    // Name column rendering
    let nameColHtml = '';
    if (isCompact) {
      nameColHtml = `
        <div class="flex items-center gap-1.5 whitespace-nowrap">
          <span class="font-bold text-xs ${rarityNameColorClass}">${escapeHtml(item.shard_name)}</span>
          <span class="text-[11px] text-slate-400 font-sans">(${escapeHtml(item.attribute_name)})</span>
        </div>
      `;
    } else {
      nameColHtml = `
        <div>
          <div class="flex items-center gap-1.5">
            <span class="font-bold text-sm tracking-wide ${rarityNameColorClass}">${escapeHtml(item.shard_name)}</span>
            <span class="text-xs text-slate-300 font-semibold">/ ${escapeHtml(item.attribute_name)}</span>
            <span class="text-[10px] text-slate-500 font-sans font-normal">(${escapeHtml(item.acquisition)})</span>
          </div>
          <div class="mt-1 flex items-center gap-1.5 flex-wrap">
            <div class="shard-effect-box max-w-sm flex-1 cursor-pointer group" onclick="toggleShardEffect(this)" title="点击展开/收起属性效果描述">
              <div class="shard-effect-text collapsed text-xs text-slate-300 font-sans transition-all group-hover:text-amber-200">
                ${escapeHtml(item.attribute_effect || '无特殊效果说明')}
              </div>
            </div>
            <div class="how-to-hunt-badge select-none" title="【获取途径 / How to Hunt】&#10;${escapeHtml(item.how_to_hunt || '暂无获取途径说明')}">
              <i class="fa-solid fa-crosshairs text-[10px] text-amber-400"></i>
            </div>
          </div>
        </div>
      `;
    }

    const rowPadding = isCompact ? 'py-1 px-2' : 'py-2 px-2.5';

    html += `
      <tr class="hover:bg-slate-800/40 transition border-b border-[#262e45]/60 text-xs">
        <td class="${rowPadding} text-center">
          <span class="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${rarityClass}">${item.tag}</span>
        </td>

        <td class="${rowPadding}">
          ${nameColHtml}
        </td>

        <td class="${rowPadding} text-center whitespace-nowrap">
          <span class="px-2 py-0.5 rounded text-[11px] bg-[#111520] text-slate-300 border border-[#262e45] font-sans">${item.category}</span>
          ${synergyBadge}
        </td>

        <td class="${rowPadding} text-center whitespace-nowrap w-16 max-w-[70px]">
          <span class="px-1.5 py-0.5 rounded text-[10px] bg-[#111520] text-slate-400 border border-[#262e45] font-sans truncate inline-block max-w-[65px]" title="${escapeHtml(item.shard_family || '-')}">${escapeHtml(item.shard_family || '-')}</span>
        </td>

        <td class="${rowPadding} text-center">
          ${progressHtml}
        </td>

        <td class="${rowPadding} text-center whitespace-nowrap">
          ${remainingHtml}
        </td>

        <td class="${rowPadding} text-right whitespace-nowrap">
          ${nextLevelHtml}
        </td>

        <td class="${rowPadding} text-right whitespace-nowrap">
          ${unitPriceHtml}
        </td>

        <td class="${rowPadding} text-right whitespace-nowrap shard-col-cost-max">
          ${costToMaxHtml}
        </td>

        <td class="${rowPadding} text-right whitespace-nowrap shard-col-coins-xp">
          ${coinsPerXpHtml}
        </td>

        <td class="${rowPadding} text-right whitespace-nowrap">
          ${volumeHtml}
        </td>

        <td class="${rowPadding} text-center whitespace-nowrap">
          <div class="flex items-center justify-center space-x-1">
            <button onclick="copyShardBzCommand('${item.bazaar_product_id}')" class="p-1.5 rounded-lg bg-[#111520] hover:bg-indigo-600/30 text-slate-400 hover:text-indigo-300 border border-[#262e45] transition text-xs" title="复制 /bz 指令">
              <i class="fa-regular fa-copy"></i>
            </button>
            <a href="https://hypixelskyblock.minecraft.wiki/w/${encodeURIComponent(item.shard_name)}" target="_blank" class="p-1.5 rounded-lg bg-[#111520] hover:bg-slate-700/50 text-slate-400 hover:text-white border border-[#262e45] transition text-xs" title="查看 Wiki">
              <i class="fa-solid fa-arrow-up-right-from-square"></i>
            </a>
          </div>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

function copyShardBzCommand(productId) {
  const cmd = `/bz ${productId}`;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(cmd);
  } else {
    const ta = document.createElement('textarea');
    ta.value = cmd;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
  showTopToast(`已复制集市指令: ${cmd}`, 'success');
}

function formatCoinsCompact(n) {
  if (n === null || n === undefined || isNaN(n)) return '0';
  if (n >= 1000000000) return (n / 1000000000).toFixed(2) + 'B';
  if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return Math.round(n).toLocaleString();
}

function formatVolumeCompact(n) {
  if (!n) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toLocaleString();
}

function exportShardDataCSV() {
  if (!shardAppState.items || shardAppState.items.length === 0) {
    showTopToast('暂无 Shard 数据可导出', 'warning');
    return;
  }

  const headers = [
    "Tag", "Shard Name", "Attribute Name", "Rarity", "Category", "Family",
    "Acquisition", "Current Eaten", "Max Total", "Remaining Needed", "Current Level",
    "Remaining XP", "Buy Order Price", "Instant Buy Price", "Cost to Max (BO)",
    "Cost to Max (IB)", "Coins per XP (BO)", "Coins per XP (IB)", "Weekly Volume",
    "How to Hunt", "Attribute Effect"
  ];

  let csvContent = "\uFEFF" + headers.join(",") + "\n";

  shardAppState.items.forEach(item => {
    const row = [
      `"${item.tag}"`,
      `"${item.shard_name}"`,
      `"${item.attribute_name}"`,
      `"${item.rarity}"`,
      `"${item.category}"`,
      `"${item.shard_family}"`,
      `"${item.acquisition}"`,
      item.current_eaten,
      item.max_total,
      item.remaining_to_max,
      item.current_level,
      item.remaining_xp,
      item.bo_price,
      item.ib_price,
      item.cost_to_max_bo,
      item.cost_to_max_ib,
      item.coins_per_max_xp_bo,
      item.coins_per_max_xp_ib,
      item.weekly_volume,
      `"${(item.how_to_hunt || '').replace(/"/g, '""')}"`,
      `"${(item.attribute_effect || '').replace(/"/g, '""')}"`
    ];
    csvContent += row.join(",") + "\n";
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const ignStr = shardAppState.ign ? `_${shardAppState.ign}` : '';
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  a.href = url;
  a.download = `Skyblock_ShardTracker${ignStr}_${dateStr}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showTopToast('Shard 数据已成功导出为 CSV 表格！', 'success');
}



