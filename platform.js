/* ═══════════════════════════════════════════════════════════════════════
   platform.js — 與遊戲平台的通訊層
   《友魚守護團：台灣海線任務》接入平台任務系統

   依「任務頁面通訊介面規格.md」實作：
     任務 → 平台：ready / complete / score / exit
     平台 → 任務：player_info（回應 ready）／ack（回應 complete）

   ⚠️ TASK_ID 必須跟後台「任務」分頁設定的這個任務的 ID 完全一致，
      平台用它在 openTaskWindows 裡找到對應視窗記錄。目前先填一個預設值，
      後台實際建立這個任務時如果 ID 不同，只要改這裡這一行即可。
   ═══════════════════════════════════════════════════════════════════════ */

const TASK_ID = '6htw';

// 平台徽章 ID 前綴：漁港章／行為勳章／魚紋章 這三類會同步成平台徽章
// （同伴章／難度章／勝場數 平台沒有對應資料可存，只在本次連線內累計，見 main.js 的 progress 物件）
const BADGE_PREFIX = {
    harbor: '6htw_harbor_',
    behavior: '6htw_behavior_',
    fish: '6htw_fish_'
};

function platformBadgeId(category, name) {
    return BADGE_PREFIX[category] + name;
}

const PLATFORM = {
    connected: (typeof window !== 'undefined' && !!window.opener),
    ready: false,           // 是否已收到 player_info
    nickname: null,
    badgeIds: [],           // 平台回傳的「玩家擁有的全部徽章」（不分任務）
    myScore: null,          // 這個任務目前的個人最佳分數，沒玩過是 null
    _readyCallbacks: []
};

// 註冊「收到 player_info 後」要執行的函式；若已經收到過，立刻執行。
PLATFORM.onReady = function (fn) {
    if (PLATFORM.ready) fn();
    else PLATFORM._readyCallbacks.push(fn);
};

function _flushReadyCallbacks() {
    PLATFORM.ready = true;
    const cbs = PLATFORM._readyCallbacks.slice();
    PLATFORM._readyCallbacks.length = 0;
    cbs.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } });
}

// 送訊息給平台（任務頁面 → 平台的信封格式）。沒有 opener（直接用瀏覽器打開測試）就不送。
function sendToPlatform(type, payload) {
    if (!PLATFORM.connected) { console.log('[platform] (測試模式，未連接平台) ' + type, payload); return; }
    const msg = { source: 'culture-task', version: 1, taskId: TASK_ID, type: type };
    if (payload !== undefined) msg.payload = payload;
    window.opener.postMessage(msg, '*');
}

// 小提示 Toast：優先用 welcome-screen.js 已有的 wsShowToast，沒有的話退回 console。
function _platformToast(msg) {
    if (typeof window.wsShowToast === 'function') window.wsShowToast(msg, 2400);
    else console.log('[platform] ' + msg);
}

/* ── 監聽平台回傳的訊息 ── */
window.addEventListener('message', function (event) {
    const data = event.data;
    if (!data || data.source !== 'culture-platform') return; // 過濾不相關訊息

    if (data.type === 'player_info') {
        const p = data.payload || {};
        PLATFORM.nickname = p.nickname || '守護員';
        PLATFORM.badgeIds = Array.isArray(p.badges) ? p.badges : [];
        PLATFORM.myScore = (p.myScore && typeof p.myScore.scoreValue === 'number') ? p.myScore.scoreValue : null;
        _flushReadyCallbacks();
    } else if (data.type === 'ack' && data.forType === 'complete') {
        const r = data.result || {};
        const parts = [];
        if (r.coinsAwarded) parts.push('+' + r.coinsAwarded + ' 金幣');
        if (r.badgesAwarded && r.badgesAwarded.length) parts.push('新徽章 x' + r.badgesAwarded.length);
        if (parts.length) _platformToast('🎉 ' + parts.join('，'));
        else if (r.rejectedReason) console.log('[platform] 金幣未發放：' + r.rejectedReason);
    }
});

/* ── 任務 → 平台：ready（頁面準備好時發送一次） ── */
function sendReady() {
    sendToPlatform('ready');
}

/* ── 任務 → 平台：complete（發放獎勵；每個新徽章各自送一次，符合規格建議） ──
   coins：這次要發放的金幣數；badgeId：選填，單一徽章 ID。 */
function reportComplete(coins, badgeId) {
    const payload = {};
    if (coins) payload.coins = coins;
    if (badgeId) payload.badgeIds = [badgeId];
    sendToPlatform('complete', payload);
}

// 把「本局新解鎖」的漁港章／行為勳章／魚紋章，逐一轉成平台徽章 ID 並各自回報（各 +10 金幣）。
// 規格明確允許「每次獲得一個都可以各自送一次 complete」，已擁有的平台會自動跳過不重複發放。
function reportNewBadges(newlyUnlocked) {
    const ids = []
        .concat((newlyUnlocked.badges || []).map(function (n) { return platformBadgeId('harbor', n); }))
        .concat((newlyUnlocked.behaviorBadges || []).map(function (n) { return platformBadgeId('behavior', n); }))
        .concat((newlyUnlocked.fish || []).map(function (n) { return platformBadgeId('fish', n); }));
    ids.forEach(function (id) { reportComplete(10, id); });
    return ids;
}

/* ── 任務 → 平台：score + 破紀錄金幣 ──
   只有比目前已知的個人最佳分數更高，才會真的送出（跟平台 submitLeaderboardScore 的規則一致，
   這裡先在前端擋一次可以少送幾次沒意義的訊息；平台那邊本來就會再檔一次比大小）。
   第一次玩（myScore 是 null）不算破紀錄，不給那 +1 金幣，只上傳分數本身。 */
function reportScoreIfHigher(totalScore) {
    if (typeof totalScore !== 'number') return;
    const isFirstTime = PLATFORM.myScore === null;
    if (!isFirstTime && totalScore <= PLATFORM.myScore) return;

    sendToPlatform('score', { scoreLabel: totalScore + ' 分', scoreValue: totalScore });
    if (!isFirstTime) reportComplete(1);
    PLATFORM.myScore = totalScore; // 樂觀更新本地暫存的「目前最佳」，讓同一個連線內下一局比較基準跟著變
}

/* ── 任務 → 平台：exit（離開任務，回平台） ── */
function exitToPlatform() {
    sendToPlatform('exit');
    if (PLATFORM.connected) window.close();
}

// 遊戲進行中按下「返回」：先二次確認，避免手滑中斷正在進行的一局。
function confirmExitDuringGame() {
    if (window.confirm('確定要離開任務、返回平台嗎？\n目前這一局的進度不會被保留。')) {
        exitToPlatform();
    }
}

// 結算畫面的「關閉」按鈕：不需要二次確認（已經是結算畫面，沒有進行中的局要中斷）。
function closeTaskToPlatform() {
    exitToPlatform();
}

window.PLATFORM = PLATFORM;
window.platformBadgeId = platformBadgeId;
window.reportNewBadges = reportNewBadges;
window.reportScoreIfHigher = reportScoreIfHigher;
window.exitToPlatform = exitToPlatform;
window.confirmExitDuringGame = confirmExitDuringGame;
window.closeTaskToPlatform = closeTaskToPlatform;

// 頁面載入完成即回報 ready（監聽器已經在上面掛好，不會漏接 player_info）。
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', sendReady);
} else {
    sendReady();
}
