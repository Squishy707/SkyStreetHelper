/**
 * SkyStreetHelper - Bazaar Order Tracker & Radar (alpha 0.5.1)
 * 集市挂单雷达与实时盯盘监控系统
 * - 实时排位与前方压单量计算 (Queue Ranking & Ahead Volume)
 * - 榜首最优竞价与加价夺回建议 (Top Competing Price & +0.1 Reclaim)
 * - 档位剩余量追踪与成交进度预估 (Fill Progress Bar)
 * - 多维警报系统 (Web Audio API 纯合成音效、桌面 Notification、网页标题交替闪烁)
 * - 盘口深度可视化 (Live Depth Book Visualizer)
 */

const ORDER_TRACKER_STORAGE_KEY = 'skyblock_tracked_orders_v1';
const ORDER_TRACKER_SETTINGS_KEY = 'skyblock_tracker_settings_v1';

const orderTrackerState = {
  orders: [],
  inspectResults: {},
  pollingIntervalMs: 10000,
  pollTimer: null,
  isLoading: false,
  soundEnabled: true,
  desktopNotifyEnabled: false,
  filterStatus: 'all', // 'all', 'leading', 'outbid', 'filled'
  searchQuery: '',
  audioCtx: null,
  originalTitle: document.title || 'SkyStreetHelper - Hypixel Skyblock Tracker',
  titleBlinkTimer: null,
  activeDepthItem: null
};

// ==============================================================================
// 1. 初始化与本地持久化加载
// ==============================================================================
function initOrderTracker() {
  loadTrackerSettings();
  loadTrackedOrders();
  setupAudioContextOnUserGesture();
  
  // 首次渲染 UI
  renderOrderTrackerUI();
  updateFloatingRadarDock();
  
  // 立即执行首次全量挂单核验
  pollOrderTracker(true);
  
  // 启动后台 10 秒常驻轮询
  startOrderTrackerPolling();
}

function loadTrackerSettings() {
  try {
    const raw = localStorage.getItem(ORDER_TRACKER_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      orderTrackerState.soundEnabled = parsed.soundEnabled !== false;
      orderTrackerState.desktopNotifyEnabled = !!parsed.desktopNotifyEnabled;
    }
  } catch (e) {
    console.warn('[OrderTracker] 读取设置失败:', e);
  }
}

function saveTrackerSettings() {
  try {
    localStorage.setItem(ORDER_TRACKER_SETTINGS_KEY, JSON.stringify({
      soundEnabled: orderTrackerState.soundEnabled,
      desktopNotifyEnabled: orderTrackerState.desktopNotifyEnabled
    }));
  } catch (e) {
    console.warn('[OrderTracker] 保存设置失败:', e);
  }
}

function loadTrackedOrders() {
  try {
    const raw = localStorage.getItem(ORDER_TRACKER_STORAGE_KEY);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length > 0) {
        orderTrackerState.orders = list;
        return;
      }
    }
  } catch (e) {
    console.warn('[OrderTracker] 读取订单列表失败:', e);
  }

  // 若为空，预置用户当前挂单作为开箱示例 (ENCHANTED_COOKIE @ 68141.2, 5000 颗)
  orderTrackerState.orders = [
    {
      id: 'order_cookie_default_' + Date.now(),
      itemId: 'ENCHANTED_COOKIE',
      itemName: 'Enchanted Cookie',
      orderType: 'buy_order',
      targetPrice: 68141.2,
      initialQty: 5000,
      createdAt: Date.now(),
      notes: '用户实战挂单'
    }
  ];
  saveTrackedOrders();
}

function saveTrackedOrders() {
  try {
    localStorage.setItem(ORDER_TRACKER_STORAGE_KEY, JSON.stringify(orderTrackerState.orders));
  } catch (e) {
    console.warn('[OrderTracker] 保存挂单失败:', e);
  }
}

// ==============================================================================
// 2. 音效与通知引擎 (Web Audio API & Desktop Notification)
// ==============================================================================
function setupAudioContextOnUserGesture() {
  const resumeAudio = () => {
    if (!orderTrackerState.audioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) {
        orderTrackerState.audioCtx = new AudioCtxClass();
      }
    } else if (orderTrackerState.audioCtx.state === 'suspended') {
      orderTrackerState.audioCtx.resume();
    }
    window.removeEventListener('click', resumeAudio);
    window.removeEventListener('keydown', resumeAudio);
  };
  window.addEventListener('click', resumeAudio, { once: true });
  window.addEventListener('keydown', resumeAudio, { once: true });
}

function getAudioContext() {
  if (!orderTrackerState.audioCtx) {
    const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
    if (AudioCtxClass) {
      orderTrackerState.audioCtx = new AudioCtxClass();
    }
  }
  if (orderTrackerState.audioCtx && orderTrackerState.audioCtx.state === 'suspended') {
    orderTrackerState.audioCtx.resume();
  }
  return orderTrackerState.audioCtx;
}

/**
 * 被压价警报音 (Double downward blip: 440Hz -> 330Hz)
 */
function playOutbidAlertSound() {
  if (!orderTrackerState.soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const t = ctx.currentTime;
    
    // Tone 1
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(440, t); // A4
    gain1.gain.setValueAtTime(0.12, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(t);
    osc1.stop(t + 0.16);

    // Tone 2 (Lower warning)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(329.63, t + 0.12); // E4
    gain2.gain.setValueAtTime(0.15, t + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(t + 0.12);
    osc2.stop(t + 0.36);
  } catch (e) {
    console.warn('[Audio] 播放被压价提示失败:', e);
  }
}

/**
 * 完全成交胜利铃声 (Upward arpeggio: C5 -> E5 -> G5 -> C6)
 */
function playFilledAlertSound() {
  if (!orderTrackerState.soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const t = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startTime = t + idx * 0.10;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.18, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.36);
    });
  } catch (e) {
    console.warn('[Audio] 播放完成提示失败:', e);
  }
}

/**
 * 进度推进微提示音 (High ping: 880Hz)
 */
function playProgressAlertSound() {
  if (!orderTrackerState.soundEnabled) return;
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t);
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.13);
  } catch (e) {
    console.warn('[Audio] 播放进度提示失败:', e);
  }
}

/**
 * 测试音效入口
 */
function testTrackerSound(type = 'outbid') {
  if (type === 'outbid') playOutbidAlertSound();
  else if (type === 'filled') playFilledAlertSound();
  else if (type === 'progress') playProgressAlertSound();
  showOrderToast(`已试听音效: ${type === 'filled' ? '100% 完全成交' : type === 'outbid' ? '被超越压价' : '成交推进'}`, 'info');
}

/**
 * 触发系统桌面通知
 */
function triggerDesktopNotification(title, body) {
  if (!orderTrackerState.desktopNotifyEnabled) return;
  if (!('Notification' in window)) return;
  
  if (Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body: body,
        icon: '/static/favicon.ico'
      });
    } catch (e) {
      console.warn('[Notification] 发送系统通知失败:', e);
    }
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        new Notification(title, { body: body });
      }
    });
  }
}

/**
 * 标签页标题交替闪烁提醒
 */
function flashDocumentTitle(alertMsg) {
  if (orderTrackerState.titleBlinkTimer) {
    clearInterval(orderTrackerState.titleBlinkTimer);
  }
  let step = 0;
  orderTrackerState.titleBlinkTimer = setInterval(() => {
    step++;
    if (step % 2 === 1) {
      document.title = `🔔 [${alertMsg}] 挂单雷达`;
    } else {
      document.title = orderTrackerState.originalTitle;
    }
    if (step >= 12) { // 闪烁 6 次后自动复原
      clearInterval(orderTrackerState.titleBlinkTimer);
      orderTrackerState.titleBlinkTimer = null;
      document.title = orderTrackerState.originalTitle;
    }
  }, 800);
}

// ==============================================================================
// 3. 实时轮询与后端接口核验 (API Inspection)
// ==============================================================================
function startOrderTrackerPolling() {
  if (orderTrackerState.pollTimer) {
    clearInterval(orderTrackerState.pollTimer);
  }
  orderTrackerState.pollTimer = setInterval(() => {
    pollOrderTracker(false);
  }, orderTrackerState.pollingIntervalMs);
}

async function pollOrderTracker(forceSpin = false) {
  if (orderTrackerState.orders.length === 0) {
    updateFloatingRadarDock();
    return;
  }
  
  if (forceSpin) {
    updateTrackerSpinIndicator(true);
  }
  orderTrackerState.isLoading = true;

  try {
    const payload = {
      orders: orderTrackerState.orders.map(o => {
        const prev = orderTrackerState.inspectResults[o.id] || {};
        return {
          id: o.id,
          item_id: o.itemId,
          order_type: o.orderType || 'buy_order',
          target_price: parseFloat(o.targetPrice) || 0.0,
          initial_quantity: parseInt(o.initialQty, 10) || 1,
          previous_rank: prev.rank || null,
          previous_filled: prev.estimated_filled || 0
        };
      })
    };

    const res = await fetch(`/api/tracker/inspect?_t=${Date.now()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
    const data = await res.json();
    
    if (data.success && Array.isArray(data.results)) {
      data.results.forEach(item => {
        const old = orderTrackerState.inspectResults[item.id];
        orderTrackerState.inspectResults[item.id] = item;
        
        // 检查警报触发
        if (item.needs_alert && item.alert_type) {
          if (item.alert_type === 'outbid') {
            playOutbidAlertSound();
            triggerDesktopNotification('【被压价警报】Skyblock 挂单被超越', item.alert_msg);
            flashDocumentTitle('被竞价压盘');
            showOrderToast(item.alert_msg, 'warning');
          } else if (item.alert_type === 'filled') {
            playFilledAlertSound();
            triggerDesktopNotification('【完全成交】Skyblock 挂单已完成', item.alert_msg);
            flashDocumentTitle('100% 已成交');
            showOrderToast(item.alert_msg, 'success');
          } else if (item.alert_type === 'progress') {
            playProgressAlertSound();
            showOrderToast(item.alert_msg, 'info');
          } else if (item.alert_type === 'cancelled') {
            showOrderToast(item.alert_msg, 'warning');
          }
        }
      });
      
      const updateTimeBadge = document.getElementById('trackerLastUpdateText');
      if (updateTimeBadge && data.timestamp_beijing) {
        updateTimeBadge.textContent = `${data.timestamp_beijing} (北京时间)`;
      }

      renderOrderTrackerUI();
      updateFloatingRadarDock();
    }
  } catch (err) {
    console.error('[OrderTracker] 轮询异常:', err);
  } finally {
    orderTrackerState.isLoading = false;
    if (forceSpin) updateTrackerSpinIndicator(false);
  }
}

function updateTrackerSpinIndicator(spinning) {
  const icon = document.getElementById('trackerRefreshIcon');
  if (icon) {
    if (spinning) icon.classList.add('fa-spin');
    else icon.classList.remove('fa-spin');
  }
}

// ==============================================================================
// 4. 主视图渲染器 (KPIs, Order Cards, Controls)
// ==============================================================================
function renderOrderTrackerUI() {
  renderTrackerKPIs();
  renderTrackerCards();
}

function renderTrackerKPIs() {
  const totalEl = document.getElementById('radarKpiTotalOrders');
  const leadingEl = document.getElementById('radarKpiLeadingOrders');
  const outbidEl = document.getElementById('radarKpiOutbidOrders');
  const filledEl = document.getElementById('radarKpiFilledOrders');

  let leadingCount = 0;
  let outbidCount = 0;
  let filledCount = 0;

  orderTrackerState.orders.forEach(o => {
    const info = orderTrackerState.inspectResults[o.id];
    if (info) {
      if (info.status === 'LEADING') leadingCount++;
      else if (info.status === 'OUTBID' || info.status === 'OUTBID_DEEP') outbidCount++;
      else if (info.status === 'FILLED') filledCount++;
    }
  });

  if (totalEl) totalEl.textContent = orderTrackerState.orders.length;
  if (leadingEl) leadingEl.textContent = leadingCount;
  if (outbidEl) outbidEl.textContent = outbidCount;
  if (filledEl) filledEl.textContent = filledCount;

  // 顶栏徽章
  const tabBadge = document.getElementById('radarActiveBadge');
  if (tabBadge) {
    if (orderTrackerState.orders.length > 0) {
      tabBadge.textContent = `${orderTrackerState.orders.length}单`;
      if (outbidCount > 0) {
        tabBadge.className = "px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500/20 text-rose-300 font-mono font-bold animate-pulse border border-rose-500/40";
      } else {
        tabBadge.className = "px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-500/20 text-indigo-300 font-mono border border-indigo-500/30";
      }
    } else {
      tabBadge.textContent = '0单';
    }
  }
}

function renderTrackerCards() {
  const container = document.getElementById('radarCardsContainer');
  const emptyState = document.getElementById('radarEmptyState');
  if (!container) return;

  if (orderTrackerState.orders.length === 0) {
    container.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  const filtered = orderTrackerState.orders.filter(ord => {
    const info = orderTrackerState.inspectResults[ord.id];
    // Filter by status
    if (orderTrackerState.filterStatus === 'leading' && (!info || info.status !== 'LEADING')) return false;
    if (orderTrackerState.filterStatus === 'outbid' && (!info || (info.status !== 'OUTBID' && info.status !== 'OUTBID_DEEP'))) return false;
    if (orderTrackerState.filterStatus === 'filled' && (!info || info.status !== 'FILLED')) return false;
    // Search filter
    if (orderTrackerState.searchQuery) {
      const q = orderTrackerState.searchQuery.toLowerCase();
      const matchName = (ord.itemName || '').toLowerCase().includes(q);
      const matchId = (ord.itemId || '').toLowerCase().includes(q);
      if (!matchName && !matchId) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-12 text-center text-slate-500 text-xs">
        <i class="fa-solid fa-filter-circle-xmark text-3xl mb-2 text-slate-600 block"></i>
        未找到符合当前筛选条件的盯盘挂单，请切换筛选或重置搜索词
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(ord => {
    const info = orderTrackerState.inspectResults[ord.id] || {
      status: 'QUEUED',
      status_label: '盘口查询中...',
      rank: '--',
      top_price: 0,
      price_gap: 0,
      reclaim_price: 0,
      ahead_volume: 0,
      ahead_orders: 0,
      current_tier_amount: ord.initialQty,
      estimated_filled: 0,
      fill_percentage: 0.0
    };

    const isBuy = (ord.orderType || 'buy_order') === 'buy_order';
    const isLeading = info.status === 'LEADING';
    const isOutbid = info.status === 'OUTBID' || info.status === 'OUTBID_DEEP';
    const isFilled = info.status === 'FILLED';
    const isCancelled = info.status === 'CANCELLED';

    // 状态边框和徽章
    let cardBorder = 'border-[#262e45]';
    let statusPill = '';
    if (isLeading) {
      cardBorder = 'border-emerald-500/50 shadow-md shadow-emerald-950/30';
      statusPill = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span> 队首最优 #1</span>';
    } else if (isOutbid) {
      cardBorder = 'border-amber-500/50 shadow-md shadow-amber-950/30';
      statusPill = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1"><i class="fa-solid fa-triangle-exclamation text-amber-400"></i> 被超越 #${info.rank || '?'}</span>`;
    } else if (isFilled) {
      cardBorder = 'border-purple-500/50 shadow-md shadow-purple-950/30';
      statusPill = '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1"><i class="fa-solid fa-check-double text-purple-400"></i> 100% 已成交</span>';
    } else if (isCancelled) {
      cardBorder = 'border-slate-700/60 opacity-80';
      statusPill = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-700/50 text-slate-300 border border-slate-600 flex items-center gap-1"><i class="fa-solid fa-ban text-slate-400"></i> 已撤单</span>`;
    } else {
      statusPill = `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-700/50 text-slate-300 border border-slate-600">排队 #${info.rank || '--'}</span>`;
    }

    let fillModeBadge = '';
    if (info.fill_mode === 'dumper') {
      fillModeBadge = '<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 shrink-0"><i class="fa-solid fa-bolt text-amber-400"></i> 倾销扫盘</span>';
    } else if (info.fill_mode === 'retail' && isFilled) {
      fillModeBadge = '<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1 shrink-0"><i class="fa-solid fa-users text-purple-400"></i> 散户自然撮合</span>';
    } else if (isCancelled) {
      fillModeBadge = '<span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-700/40 text-slate-400 border border-slate-600/50 flex items-center gap-1 shrink-0"><i class="fa-solid fa-arrow-rotate-left"></i> 非队首撤单</span>';
    }

    const orderTypePill = isBuy
      ? '<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40"><i class="fa-solid fa-cart-shopping mr-1"></i>Buy Order 预购</span>'
      : '<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"><i class="fa-solid fa-tags mr-1"></i>Sell Offer 出售</span>';

    const fillPct = Math.min(100, Math.max(0, info.fill_percentage || 0));

    return `
      <div class="bg-[#181d2c] border ${cardBorder} rounded-xl p-4 space-y-3.5 transition hover:border-indigo-500/40 relative group">
        <!-- 头部: 标的与状态 -->
        <div class="flex items-start justify-between gap-2">
          <div class="flex items-center space-x-2.5">
            <span class="w-9 h-9 rounded-lg bg-[#111520] border border-[#262e45] flex items-center justify-center text-lg shrink-0 shadow-sm text-indigo-400">
              <i class="fa-solid fa-crosshairs"></i>
            </span>
            <div>
              <div class="flex items-center space-x-2">
                <h4 class="font-bold text-white text-sm hover:text-indigo-300 cursor-pointer" onclick="openDepthBookModal('${ord.itemId}', ${ord.targetPrice}, '${ord.orderType}')">${ord.itemName || ord.itemId}</h4>
                ${orderTypePill}
              </div>
              <div class="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-1.5">
                <span>${ord.itemId}</span>
                <span class="text-slate-500">•</span>
                <span>目标挂价: <strong class="text-white">${Number(ord.targetPrice).toLocaleString()} C</strong></span>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-1.5">
            ${fillModeBadge}
            ${statusPill}
          </div>
        </div>

        <!-- 关键行情排位指标四宫格 -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-mono text-xs">
          <!-- 1. 当前顺位 -->
          <div class="bg-[#111520] p-2 rounded-lg border border-[#262e45]/80 flex flex-col justify-between">
            <span class="text-[10px] text-slate-400 font-sans">当前队列排位</span>
            <span class="text-base font-extrabold ${isLeading ? 'text-emerald-400' : isOutbid ? 'text-amber-400' : 'text-slate-200'}">
              #${info.rank || '--'}
            </span>
          </div>

          <!-- 2. 榜首现价与差额 -->
          <div class="bg-[#111520] p-2 rounded-lg border border-[#262e45]/80 flex flex-col justify-between">
            <span class="text-[10px] text-slate-400 font-sans">榜首最优现价</span>
            <div class="flex items-baseline justify-between">
              <span class="text-xs font-bold text-slate-200">${info.top_price ? info.top_price.toLocaleString() : '--'}</span>
              <span class="text-[10px] ${info.price_gap > 0 ? 'text-rose-400' : 'text-emerald-400'} font-bold">
                ${info.price_gap > 0 ? '+' + info.price_gap.toFixed(1) : info.price_gap === 0 ? '平齐' : info.price_gap.toFixed(1)}
              </span>
            </div>
          </div>

          <!-- 3. 前方排队压单量 -->
          <div class="bg-[#111520] p-2 rounded-lg border border-[#262e45]/80 flex flex-col justify-between">
            <span class="text-[10px] text-slate-400 font-sans">前方排队压单</span>
            <div class="flex items-baseline justify-between">
              <span class="text-xs font-bold ${info.ahead_volume > 0 ? 'text-amber-300' : 'text-emerald-400'}">
                ${info.ahead_volume ? info.ahead_volume.toLocaleString() : '0'} 颗
              </span>
              <span class="text-[10px] text-slate-500 font-sans">(${info.ahead_orders || 0}单)</span>
            </div>
          </div>

          <!-- 4. 夺回榜首建议挂价 -->
          <div class="bg-[#111520] p-2 rounded-lg border border-[#262e45]/80 flex flex-col justify-between cursor-pointer hover:border-indigo-500/60" onclick="copyReclaimPrice(${info.reclaim_price})" title="点击复制推荐挂单价">
            <div class="flex items-center justify-between text-[10px] text-slate-400 font-sans">
              <span>夺榜建议挂价</span>
              <i class="fa-regular fa-copy text-[9px] text-indigo-400"></i>
            </div>
            <span class="text-xs font-black text-indigo-300">
              ${info.reclaim_price ? info.reclaim_price.toLocaleString() + ' C' : '--'}
            </span>
          </div>
        </div>

        <!-- 成交进度条 (Fill Progress Bar) -->
        <div class="space-y-1">
          <div class="flex items-center justify-between text-xs">
            <span class="text-slate-400 text-[11px] flex items-center gap-1.5">
              <span>成交推进进度:</span>
              <strong class="text-slate-200 font-mono">${(info.estimated_filled || 0).toLocaleString()} / ${Number(ord.initialQty).toLocaleString()} 颗</strong>
            </span>
            <span class="font-mono font-bold text-xs ${isFilled ? 'text-purple-400' : 'text-indigo-400'}">
              ${fillPct.toFixed(1)}%
            </span>
          </div>
          <div class="w-full bg-[#111520] rounded-full h-2 overflow-hidden border border-[#262e45] p-0.5">
            <div class="h-full rounded-full transition-all duration-500 ${isFilled ? 'bg-gradient-to-r from-purple-500 to-indigo-500' : isLeading ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-indigo-500 to-blue-400'}" style="width: ${fillPct}%"></div>
          </div>
          <div class="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-0.5">
            <span>该档当前余量: ${(info.current_tier_amount || 0).toLocaleString()} 颗</span>
            <span>添加时间: ${new Date(ord.createdAt || Date.now()).toLocaleTimeString()}</span>
          </div>
        </div>

        <!-- 底部快捷操作栏 -->
        <div class="flex items-center justify-between pt-2 border-t border-[#262e45]/60">
          <button onclick="openDepthBookModal('${ord.itemId}', ${ord.targetPrice}, '${ord.orderType}')" class="px-2.5 py-1 rounded bg-[#111520] hover:bg-indigo-600/30 border border-[#262e45] hover:border-indigo-500 text-slate-300 hover:text-white text-xs font-semibold transition active:scale-95 flex items-center gap-1.5 shadow-sm">
            <i class="fa-solid fa-chart-simple text-indigo-400"></i>
            <span>查看盘口深度</span>
          </button>
          
          <div class="flex items-center space-x-1.5">
            <button onclick="openEditOrderModal('${ord.id}')" class="px-2 py-1 rounded bg-[#111520] hover:bg-slate-700 border border-[#262e45] text-slate-400 hover:text-white text-xs transition" title="修改订单目标价或数量">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button onclick="deleteTrackedOrder('${ord.id}')" class="px-2 py-1 rounded bg-[#111520] hover:bg-rose-500/20 border border-[#262e45] hover:border-rose-500/40 text-slate-400 hover:text-rose-300 text-xs transition" title="移除此盯盘">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ==============================================================================
// 5. 全局悬浮雷达胶囊 (Floating Radar Dock)
// ==============================================================================
function updateFloatingRadarDock() {
  const dock = document.getElementById('floatingRadarDock');
  if (!dock) return;

  if (orderTrackerState.orders.length === 0) {
    dock.classList.add('hidden');
    return;
  }
  dock.classList.remove('hidden');

  let mostUrgentOrder = null;
  let hasOutbid = false;
  let hasFilled = false;

  orderTrackerState.orders.forEach(o => {
    const info = orderTrackerState.inspectResults[o.id];
    if (info) {
      if (info.status === 'OUTBID' || info.status === 'OUTBID_DEEP') {
        hasOutbid = true;
        if (!mostUrgentOrder || info.price_gap > (mostUrgentOrder.price_gap || 0)) {
          mostUrgentOrder = { ...o, ...info };
        }
      } else if (info.status === 'FILLED') {
        hasFilled = true;
      }
    }
  });

  const dockStatusText = document.getElementById('radarDockStatusText');
  const dockBadge = document.getElementById('radarDockBadge');
  const dockCount = document.getElementById('radarDockCount');

  if (dockCount) dockCount.textContent = `${orderTrackerState.orders.length}`;

  if (hasOutbid && mostUrgentOrder) {
    dock.className = "fixed bottom-5 right-5 z-40 bg-[#181d2c]/95 backdrop-blur-md border border-amber-500/60 rounded-full px-4 py-2.5 shadow-xl shadow-amber-950/40 flex items-center space-x-3 cursor-pointer hover:scale-105 transition animate-bounce";
    if (dockStatusText) {
      dockStatusText.innerHTML = `<span class="text-amber-300 font-bold">${mostUrgentOrder.itemName || mostUrgentOrder.itemId}</span> 被超越 <strong class="text-white">#${mostUrgentOrder.rank}</strong> (差 +${mostUrgentOrder.price_gap}C)`;
    }
    if (dockBadge) dockBadge.className = "w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping";
  } else if (hasFilled) {
    dock.className = "fixed bottom-5 right-5 z-40 bg-[#181d2c]/95 backdrop-blur-md border border-purple-500/60 rounded-full px-4 py-2.5 shadow-xl shadow-purple-950/40 flex items-center space-x-3 cursor-pointer hover:scale-105 transition";
    if (dockStatusText) {
      dockStatusText.innerHTML = `<span class="text-purple-300 font-bold">🎉 有订单已 100% 完全成交！</span>`;
    }
    if (dockBadge) dockBadge.className = "w-2.5 h-2.5 rounded-full bg-purple-400";
  } else {
    dock.className = "fixed bottom-5 right-5 z-40 bg-[#181d2c]/95 backdrop-blur-md border border-indigo-500/40 rounded-full px-4 py-2.5 shadow-xl shadow-black/40 flex items-center space-x-3 cursor-pointer hover:scale-105 transition";
    if (dockStatusText) {
      dockStatusText.innerHTML = `<span class="text-slate-300">挂单雷达正常监控中 • 排位最优</span>`;
    }
    if (dockBadge) dockBadge.className = "w-2.5 h-2.5 rounded-full bg-emerald-400";
  }
}

function onFloatingDockClick() {
  if (typeof switchMainTab === 'function') {
    switchMainTab('ordertracker');
  }
}

// ==============================================================================
// 6. 盘口深度可视化弹窗 (Live Depth Book Modal)
// ==============================================================================
async function openDepthBookModal(itemId, targetPrice, orderType = 'buy_order') {
  orderTrackerState.activeDepthItem = { itemId, targetPrice, orderType };
  const modal = document.getElementById('depthBookModal');
  const title = document.getElementById('depthModalTitle');
  if (modal) modal.classList.remove('hidden');
  if (title) title.textContent = `${cleanItemName(itemId)} 实时盘口深度`;

  fetchAndRenderDepthBook();
}

async function fetchAndRenderDepthBook() {
  if (!orderTrackerState.activeDepthItem) return;
  const { itemId, targetPrice, orderType } = orderTrackerState.activeDepthItem;

  const bidsContainer = document.getElementById('depthBidsBody');
  const asksContainer = document.getElementById('depthAsksBody');
  const quickStatusEl = document.getElementById('depthQuickStatus');

  if (bidsContainer) bidsContainer.innerHTML = '<tr><td colspan="4" class="py-6 text-center text-slate-500">正在拉取买单深度...</td></tr>';
  if (asksContainer) asksContainer.innerHTML = '<tr><td colspan="4" class="py-6 text-center text-slate-500">正在拉取卖单深度...</td></tr>';

  try {
    const res = await fetch(`/api/tracker/depth?item_id=${encodeURIComponent(itemId)}&target_price=${targetPrice}&order_type=${orderType}&depth=20&_t=${Date.now()}`);
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error || '获取深度失败');

    // 渲染 Quick Status
    if (quickStatusEl && data.quick_status) {
      const qs = data.quick_status;
      quickStatusEl.innerHTML = `
        <div class="flex items-center gap-4 text-xs font-mono">
          <span>秒买市价: <strong class="text-rose-400">${qs.sellPrice.toLocaleString()} C</strong></span>
          <span>秒卖市价: <strong class="text-emerald-400">${qs.buyPrice.toLocaleString()} C</strong></span>
          <span>买单挂单数: <strong class="text-indigo-300">${qs.buyOrders.toLocaleString()}</strong></span>
          <span>卖单挂单数: <strong class="text-cyan-300">${qs.sellOrders.toLocaleString()}</strong></span>
        </div>
      `;
    }

    // 渲染 Buy Orders (绿色一侧)
    if (bidsContainer) {
      if (data.buy_orders.length === 0) {
        bidsContainer.innerHTML = '<tr><td colspan="4" class="py-4 text-center text-slate-500">暂无买单挂单</td></tr>';
      } else {
        bidsContainer.innerHTML = data.buy_orders.map(row => {
          const isUser = row.is_user_tier;
          const trClass = isUser 
            ? 'bg-amber-500/20 border-2 border-amber-400 font-bold text-white shadow-sm' 
            : 'hover:bg-slate-800/40 border-b border-[#262e45]/40 text-slate-200';
          return `
            <tr class="${trClass}">
              <td class="py-1.5 px-2 font-mono text-[11px] text-slate-400">
                ${isUser ? '<span class="text-amber-300 font-black">👉 #' + row.rank + '</span>' : '#' + row.rank}
              </td>
              <td class="py-1.5 px-2 font-mono text-right text-xs text-emerald-400 font-bold">
                ${row.price.toLocaleString()}
              </td>
              <td class="py-1.5 px-2 font-mono text-right text-xs">
                ${row.amount.toLocaleString()}
              </td>
              <td class="py-1.5 px-2 font-mono text-right text-[11px] text-slate-400">
                ${row.cumulative_amount.toLocaleString()}
              </td>
            </tr>
          `;
        }).join('');
      }
    }

    // 渲染 Sell Offers (红色一侧)
    if (asksContainer) {
      if (data.sell_offers.length === 0) {
        asksContainer.innerHTML = '<tr><td colspan="4" class="py-4 text-center text-slate-500">暂无卖单挂单</td></tr>';
      } else {
        asksContainer.innerHTML = data.sell_offers.map(row => {
          const isUser = row.is_user_tier;
          const trClass = isUser 
            ? 'bg-amber-500/20 border-2 border-amber-400 font-bold text-white shadow-sm' 
            : 'hover:bg-slate-800/40 border-b border-[#262e45]/40 text-slate-200';
          return `
            <tr class="${trClass}">
              <td class="py-1.5 px-2 font-mono text-[11px] text-slate-400">
                ${isUser ? '<span class="text-amber-300 font-black">👉 #' + row.rank + '</span>' : '#' + row.rank}
              </td>
              <td class="py-1.5 px-2 font-mono text-right text-xs text-rose-400 font-bold">
                ${row.price.toLocaleString()}
              </td>
              <td class="py-1.5 px-2 font-mono text-right text-xs">
                ${row.amount.toLocaleString()}
              </td>
              <td class="py-1.5 px-2 font-mono text-right text-[11px] text-slate-400">
                ${row.cumulative_amount.toLocaleString()}
              </td>
            </tr>
          `;
        }).join('');
      }
    }
  } catch (err) {
    console.error('[DepthBook] 加载盘口失败:', err);
    showOrderToast('加载盘口失败: ' + err.message, 'error');
  }
}

function closeDepthBookModal() {
  const modal = document.getElementById('depthBookModal');
  if (modal) modal.classList.add('hidden');
  orderTrackerState.activeDepthItem = null;
}

// ==============================================================================
// 7. 新增/编辑挂单弹窗 (Add / Edit Order Modal)
// ==============================================================================
function openAddOrderModal() {
  const modal = document.getElementById('addOrderModal');
  const title = document.getElementById('addOrderModalTitle');
  const editIdInput = document.getElementById('trackerEditOrderId');
  const itemInput = document.getElementById('trackerItemInput');
  const priceInput = document.getElementById('trackerPriceInput');
  const qtyInput = document.getElementById('trackerQtyInput');
  const notesInput = document.getElementById('trackerNotesInput');

  if (title) title.textContent = '➕ 新建挂单盯盘监控';
  if (editIdInput) editIdInput.value = '';
  if (itemInput) {
    itemInput.value = '';
    itemInput.disabled = false;
  }
  if (priceInput) priceInput.value = '';
  if (qtyInput) qtyInput.value = '5000';
  if (notesInput) notesInput.value = '';

  setOrderTypeRadio('buy_order');

  if (modal) modal.classList.remove('hidden');
  if (itemInput) itemInput.focus();
}

function openEditOrderModal(orderId) {
  const ord = orderTrackerState.orders.find(o => o.id === orderId);
  if (!ord) return;

  const modal = document.getElementById('addOrderModal');
  const title = document.getElementById('addOrderModalTitle');
  const editIdInput = document.getElementById('trackerEditOrderId');
  const itemInput = document.getElementById('trackerItemInput');
  const priceInput = document.getElementById('trackerPriceInput');
  const qtyInput = document.getElementById('trackerQtyInput');
  const notesInput = document.getElementById('trackerNotesInput');

  if (title) title.textContent = `✏️ 编辑盯盘挂单: ${ord.itemName || ord.itemId}`;
  if (editIdInput) editIdInput.value = ord.id;
  if (itemInput) {
    itemInput.value = ord.itemId;
    itemInput.disabled = true; // 编辑时不改标的
  }
  if (priceInput) priceInput.value = ord.targetPrice;
  if (qtyInput) qtyInput.value = ord.initialQty;
  if (notesInput) notesInput.value = ord.notes || '';

  setOrderTypeRadio(ord.orderType || 'buy_order');

  if (modal) modal.classList.remove('hidden');
}

function closeAddOrderModal() {
  const modal = document.getElementById('addOrderModal');
  if (modal) modal.classList.add('hidden');
  hideItemSearchResults();
}

function setOrderTypeRadio(type) {
  const buyBtn = document.getElementById('trackerTypeBuyBtn');
  const sellBtn = document.getElementById('trackerTypeSellBtn');
  const hiddenInput = document.getElementById('trackerOrderTypeInput');

  if (hiddenInput) hiddenInput.value = type;

  if (type === 'buy_order') {
    if (buyBtn) buyBtn.className = "px-3 py-1.5 rounded-lg text-xs font-bold transition bg-indigo-600 text-white shadow-sm border border-indigo-500";
    if (sellBtn) sellBtn.className = "px-3 py-1.5 rounded-lg text-xs font-bold transition bg-[#181d2c] text-slate-300 hover:text-white border border-[#262e45]";
  } else {
    if (sellBtn) sellBtn.className = "px-3 py-1.5 rounded-lg text-xs font-bold transition bg-cyan-600 text-white shadow-sm border border-cyan-500";
    if (buyBtn) buyBtn.className = "px-3 py-1.5 rounded-lg text-xs font-bold transition bg-[#181d2c] text-slate-300 hover:text-white border border-[#262e45]";
  }
}

// 快速填入数量
function setQuickQty(qty) {
  const input = document.getElementById('trackerQtyInput');
  if (input) input.value = qty;
}

// 快速从 API 获取并填入当前榜首价
async function fetchTopPriceForCurrentItem(offset = 0) {
  const itemInput = document.getElementById('trackerItemInput');
  const priceInput = document.getElementById('trackerPriceInput');
  const typeInput = document.getElementById('trackerOrderTypeInput');
  if (!itemInput || !itemInput.value) {
    showOrderToast('请先输入商品 ID 或名称', 'warning');
    return;
  }
  const itemId = itemInput.value.trim().toUpperCase();
  const orderType = typeInput ? typeInput.value : 'buy_order';

  try {
    const res = await fetch(`/api/tracker/depth?item_id=${encodeURIComponent(itemId)}&depth=5&_t=${Date.now()}`);
    const data = await res.json();
    if (data.success) {
      let topP = 0;
      if (orderType === 'buy_order') {
        topP = data.buy_orders.length > 0 ? data.buy_orders[0].price : 0;
      } else {
        topP = data.sell_offers.length > 0 ? data.sell_offers[0].price : 0;
      }
      if (topP > 0) {
        const finalP = Math.max(0.1, Math.round((topP + offset) * 10) / 10);
        if (priceInput) priceInput.value = finalP;
        showOrderToast(`已填入价格: ${finalP} C (榜首 ${topP} C ${offset >= 0 ? '+' : ''}${offset})`, 'info');
      } else {
        showOrderToast('当前商品盘口暂无挂单数据', 'warning');
      }
    }
  } catch (e) {
    console.error('获取榜首价失败:', e);
  }
}

// 商品搜索自动联想
let searchDebounceTimer = null;
function onTrackerItemInput() {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(async () => {
    const input = document.getElementById('trackerItemInput');
    const resultsBox = document.getElementById('trackerItemSearchResults');
    if (!input || !resultsBox) return;

    const q = input.value.trim();
    if (q.length < 2) {
      hideItemSearchResults();
      return;
    }

    try {
      const res = await fetch(`/api/tracker/search?q=${encodeURIComponent(q)}&limit=12`);
      const data = await res.json();
      if (data.success && data.results.length > 0) {
        resultsBox.innerHTML = data.results.map(it => `
          <div class="px-3 py-2 hover:bg-slate-700/80 cursor-pointer text-xs flex items-center justify-between border-b border-[#262e45]/50 transition" onclick="selectTrackerSearchItem('${it.id}', '${it.name}', ${it.top_buy_order})">
            <div>
              <span class="font-bold text-white block">${it.name}</span>
              <span class="text-[10px] text-slate-400 font-mono">${it.id}</span>
            </div>
            <div class="text-right font-mono text-[11px]">
              <span class="text-emerald-400 block">BO: ${it.top_buy_order.toLocaleString()}</span>
              <span class="text-rose-400">IB: ${it.top_sell_offer.toLocaleString()}</span>
            </div>
          </div>
        `).join('');
        resultsBox.classList.remove('hidden');
      } else {
        resultsBox.innerHTML = '<div class="px-3 py-3 text-slate-500 text-xs text-center">未找到匹配的 Bazaar 商品</div>';
        resultsBox.classList.remove('hidden');
      }
    } catch (e) {
      console.warn('搜索商品异常:', e);
    }
  }, 250);
}

function selectTrackerSearchItem(id, name, topBuy) {
  const itemInput = document.getElementById('trackerItemInput');
  const priceInput = document.getElementById('trackerPriceInput');
  if (itemInput) itemInput.value = id;
  if (priceInput && (!priceInput.value || priceInput.value === '0')) {
    if (topBuy > 0) priceInput.value = topBuy;
  }
  hideItemSearchResults();
}

function hideItemSearchResults() {
  const box = document.getElementById('trackerItemSearchResults');
  if (box) box.classList.add('hidden');
}

// 保存订单
function saveOrderFromModal() {
  const editId = document.getElementById('trackerEditOrderId')?.value;
  const itemId = document.getElementById('trackerItemInput')?.value.trim().toUpperCase();
  const orderType = document.getElementById('trackerOrderTypeInput')?.value || 'buy_order';
  const price = parseFloat(document.getElementById('trackerPriceInput')?.value);
  const qty = parseInt(document.getElementById('trackerQtyInput')?.value, 10);
  const notes = document.getElementById('trackerNotesInput')?.value.trim();

  if (!itemId) {
    showOrderToast('请输入商品 Item ID', 'warning');
    return;
  }
  if (isNaN(price) || price <= 0) {
    showOrderToast('请输入有效的目标单价', 'warning');
    return;
  }
  if (isNaN(qty) || qty <= 0) {
    showOrderToast('请输入有效的挂单数量', 'warning');
    return;
  }

  if (editId) {
    // 编辑现有订单
    const ord = orderTrackerState.orders.find(o => o.id === editId);
    if (ord) {
      ord.targetPrice = price;
      ord.initialQty = qty;
      ord.orderType = orderType;
      ord.notes = notes;
      showOrderToast(`已更新挂单: ${ord.itemName || ord.itemId}`, 'success');
    }
  } else {
    // 新增订单
    const newOrd = {
      id: 'ord_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      itemId: itemId,
      itemName: cleanItemName(itemId),
      orderType: orderType,
      targetPrice: price,
      initialQty: qty,
      notes: notes,
      createdAt: Date.now()
    };
    orderTrackerState.orders.unshift(newOrd);
    showOrderToast(`已添加挂单盯盘: ${newOrd.itemName}`, 'success');
  }

  saveTrackedOrders();
  closeAddOrderModal();
  renderOrderTrackerUI();
  updateFloatingRadarDock();
  pollOrderTracker(true);
}

function deleteTrackedOrder(orderId) {
  orderTrackerState.orders = orderTrackerState.orders.filter(o => o.id !== orderId);
  delete orderTrackerState.inspectResults[orderId];
  saveTrackedOrders();
  renderOrderTrackerUI();
  updateFloatingRadarDock();
  showOrderToast('已从盯盘列表中移除订单', 'info');
}

function clearCompletedOrders() {
  const beforeCount = orderTrackerState.orders.length;
  orderTrackerState.orders = orderTrackerState.orders.filter(o => {
    const info = orderTrackerState.inspectResults[o.id];
    return !(info && info.status === 'FILLED');
  });
  const removed = beforeCount - orderTrackerState.orders.length;
  saveTrackedOrders();
  renderOrderTrackerUI();
  updateFloatingRadarDock();
  showOrderToast(`已清理 ${removed} 笔已完全成交的订单`, 'info');
}

// ==============================================================================
// 8. 农作物大表与各模块一键直连盯盘 (One-Click Track Integration)
// ==============================================================================
function openOrderTrackerWithPrefill(itemId, itemName, targetPrice, orderType = 'buy_order') {
  // 打开添加订单弹窗并预填
  openAddOrderModal();
  const itemInput = document.getElementById('trackerItemInput');
  const priceInput = document.getElementById('trackerPriceInput');
  if (itemInput) itemInput.value = itemId;
  if (priceInput && targetPrice > 0) priceInput.value = targetPrice;
  setOrderTypeRadio(orderType);
}

// 快速复制夺榜价
function copyReclaimPrice(price) {
  if (!price) return;
  navigator.clipboard.writeText(price.toString()).then(() => {
    showOrderToast(`已复制夺回榜首价: ${price} C 到剪贴板`, 'success');
  }).catch(() => {
    showOrderToast(`夺榜价: ${price} C`, 'info');
  });
}

// 筛选切换
function setTrackerFilter(filter) {
  orderTrackerState.filterStatus = filter;
  const btns = document.querySelectorAll('.radar-filter-btn');
  btns.forEach(b => {
    if (b.getAttribute('data-filter') === filter) {
      b.className = "radar-filter-btn active px-3 py-1 rounded-lg text-xs font-bold transition bg-indigo-600 text-white shadow-sm border border-indigo-500";
    } else {
      b.className = "radar-filter-btn px-3 py-1 rounded-lg text-xs font-bold transition bg-[#181d2c] text-slate-300 hover:text-white border border-[#262e45]";
    }
  });
  renderTrackerCards();
}

function onTrackerSearchInput() {
  const input = document.getElementById('trackerSearchInput');
  if (input) {
    orderTrackerState.searchQuery = input.value.trim();
    renderTrackerCards();
  }
}

// 设置切换 (声音与通知)
function toggleSoundSetting() {
  orderTrackerState.soundEnabled = !orderTrackerState.soundEnabled;
  saveTrackerSettings();
  updateSettingTogglesUI();
  showOrderToast(`声音提示已${orderTrackerState.soundEnabled ? '开启 🔊' : '关闭 🔇'}`, 'info');
}

function toggleDesktopNotificationSetting() {
  if (!orderTrackerState.desktopNotifyEnabled) {
    if ('Notification' in window) {
      Notification.requestPermission().then(perm => {
        if (perm === 'granted') {
          orderTrackerState.desktopNotifyEnabled = true;
          saveTrackerSettings();
          updateSettingTogglesUI();
          showOrderToast('系统桌面通知已开启 🔔', 'success');
          new Notification('SkyStreetHelper 挂单雷达', { body: '系统通知已成功开启！' });
        } else {
          showOrderToast('桌面通知权限未被允许，请在浏览器地址栏开启权限', 'warning');
        }
      });
    } else {
      showOrderToast('当前浏览器不支持系统桌面通知', 'warning');
    }
  } else {
    orderTrackerState.desktopNotifyEnabled = false;
    saveTrackerSettings();
    updateSettingTogglesUI();
    showOrderToast('系统桌面通知已关闭', 'info');
  }
}

function updateSettingTogglesUI() {
  const soundBtn = document.getElementById('trackerSoundToggleBtn');
  const notifyBtn = document.getElementById('trackerNotifyToggleBtn');

  if (soundBtn) {
    if (orderTrackerState.soundEnabled) {
      soundBtn.className = "px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-semibold flex items-center gap-1.5 transition";
      soundBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i><span>声音: 开启</span>';
    } else {
      soundBtn.className = "px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition";
      soundBtn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i><span>声音: 关闭</span>';
    }
  }

  if (notifyBtn) {
    if (orderTrackerState.desktopNotifyEnabled) {
      notifyBtn.className = "px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-semibold flex items-center gap-1.5 transition";
      notifyBtn.innerHTML = '<i class="fa-solid fa-bell"></i><span>通知: 开启</span>';
    } else {
      notifyBtn.className = "px-2.5 py-1 rounded-lg bg-slate-800 text-slate-400 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition";
      notifyBtn.innerHTML = '<i class="fa-solid fa-bell-slash"></i><span>通知: 关闭</span>';
    }
  }
}

// 辅助格式化
function cleanItemName(id) {
  if (!id) return '';
  return id.split('_').map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
}

// Toast 提示
function showOrderToast(msg, type = 'info') {
  let container = document.getElementById('orderToastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'orderToastContainer';
    container.className = 'fixed top-5 right-5 z-50 flex flex-col space-y-2 pointer-events-none';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  const borderCol = type === 'error' ? 'border-rose-500/50 bg-rose-950/90 text-rose-200' :
                    type === 'warning' ? 'border-amber-500/50 bg-amber-950/90 text-amber-200' :
                    type === 'success' ? 'border-emerald-500/50 bg-emerald-950/90 text-emerald-200' :
                    'border-indigo-500/50 bg-indigo-950/90 text-indigo-200';
  
  toast.className = `px-4 py-2.5 rounded-xl border ${borderCol} shadow-xl backdrop-blur-md text-xs font-medium flex items-center space-x-2 transition-all transform duration-300 pointer-events-auto`;
  toast.innerHTML = `
    <i class="fa-solid ${type === 'error' ? 'fa-circle-xmark text-rose-400' : type === 'warning' ? 'fa-triangle-exclamation text-amber-400' : type === 'success' ? 'fa-circle-check text-emerald-400' : 'fa-circle-info text-indigo-400'}"></i>
    <span>${msg}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-x-4');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// 绑定全局
window.initOrderTracker = initOrderTracker;
window.pollOrderTracker = pollOrderTracker;
window.openAddOrderModal = openAddOrderModal;
window.openEditOrderModal = openEditOrderModal;
window.closeAddOrderModal = closeAddOrderModal;
window.saveOrderFromModal = saveOrderFromModal;
window.deleteTrackedOrder = deleteTrackedOrder;
window.clearCompletedOrders = clearCompletedOrders;
window.openDepthBookModal = openDepthBookModal;
window.closeDepthBookModal = closeDepthBookModal;
window.fetchAndRenderDepthBook = fetchAndRenderDepthBook;
window.setOrderTypeRadio = setOrderTypeRadio;
window.setQuickQty = setQuickQty;
window.fetchTopPriceForCurrentItem = fetchTopPriceForCurrentItem;
window.onTrackerItemInput = onTrackerItemInput;
window.selectTrackerSearchItem = selectTrackerSearchItem;
window.openOrderTrackerWithPrefill = openOrderTrackerWithPrefill;
window.copyReclaimPrice = copyReclaimPrice;
window.setTrackerFilter = setTrackerFilter;
window.onTrackerSearchInput = onTrackerSearchInput;
window.toggleSoundSetting = toggleSoundSetting;
window.toggleDesktopNotificationSetting = toggleDesktopNotificationSetting;
window.testTrackerSound = testTrackerSound;
window.onFloatingDockClick = onFloatingDockClick;

// 页面就绪后自动启动盯盘系统
document.addEventListener('DOMContentLoaded', () => {
  initOrderTracker();
  updateSettingTogglesUI();
});
