/* ══════════════════════════════════════════════════════════════════════
   歡迎頁模組（welcome-screen.js）
   遊戲開場後、正式進入遊戲前的「選漁港 + 設難度 + 啟航」畫面。

   本檔案結構（由上到下）：
     1. CSS 樣式注入（document.head.appendChild(_style)）
        地圖背景、頂部列、漁港氣泡、右下角面板、暱稱框、天氣卡、版權列…
     2. HTML 結構注入（插在 #intro-screen 之後），含整個歡迎頁 DOM
        以及「聯絡作者」表單彈窗
     3. 歡迎頁地圖邏輯（IIFE 內的所有 function，由本檔自行管理狀態）：
          - 依視窗大小換算 tw.png 地圖的實際渲染範圍，把 6 個漁港氣泡與
            小船定位到地圖上正確的座標（getImgRect / positionHarbors）
          - 選擇漁港、顯示右下角資訊面板、移動小船（wsSelectHarbor）
          - 暱稱輸入、收集圖鑑徽章、音效開關、結算報告開關
          - 按下「⚓ 守護漁港」後，畫面以選中漁港為中心縮放淡出，
            轉場結束才呼叫 main.js 的 initGame() 正式開局（wsStartGame）
          - Canvas 海浪波紋背景動畫（島嶼邊緣隨機冒出擴散圓圈）
          - 用 MutationObserver 偵測 #welcome-screen 何時被顯示/隱藏，
            統一觸發「重新定位港口、啟動波浪動畫、抽當日天氣與封港事件」

   依賴：
     db.js           — weatherDB、eventDB、locationDB（漁港顯示用的徽章/星等資訊另存於本檔 HARBOR_INFO）
     weather-event.js — window.rollAndApplyWeather()（依天氣決定哪些漁港今日封港）
     main.js         — initGame()、openCollection()、gameDifficulty、sfxEnabled、showSummaryMode
   ══════════════════════════════════════════════════════════════════════ */
(function(){

	/* ── 注入歡迎頁 CSS ── */
	var _style = document.createElement('style');
	_style.textContent = `
	/* ── 歡迎頁根容器 ── */
	#welcome-screen {
		position: absolute;
		top: 0; left: 0;
		width: 100%; height: 100%;
		z-index: 1000;
		overflow: hidden;
		opacity: 0;
		animation: welcomeFadeIn 1.5s ease-in-out forwards;
		transition: opacity 1.2s ease-in-out, visibility 1.2s;
		font-family: "Microsoft JhengHei", "PingFang TC", sans-serif;
		-webkit-tap-highlight-color: transparent;
	}
	@keyframes welcomeFadeIn { from{opacity:0} to{opacity:1} }
	#welcome-screen.fade-out { opacity:0; visibility:hidden; }
	#welcome-screen.hidden   { opacity:0; visibility:hidden; pointer-events:none; }

	/* ── 背景地圖（tw.png 鋪滿，object-fit:cover） ── */
	#ws-map-bg {
		position: absolute;
		inset: 0;
		z-index: 0;
	}
	#ws-map-bg img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center top;
		display: block;
		user-select: none;
		-webkit-user-drag: none;
	}

	/* ── 頂部列 ── */
	#ws-topbar {
		position: absolute;
		top: 0; left: 0; right: 0;
		height: 52px;
		padding: env(safe-area-inset-top, 0px) 14px 0;
		background: rgba(3, 12, 26, 0.82);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		display: flex;
		align-items: center;
		justify-content: space-between;
		z-index: 50;
		border-bottom: 1px solid rgba(80,160,220,0.12);
	}
	#ws-top-title {
		display: flex;
		align-items: center;
	}
	#ws-title-text {
		font-family: "Microsoft JhengHei", "PingFang TC", sans-serif;
		font-size: clamp(.95rem, 3.5vw, 1.15rem);
		font-weight: 900;
		color: #e0f0ff;
		letter-spacing: .18em;
		text-shadow: 0 0 12px rgba(80,180,255,0.65);
	}

	/* ── 海浪 canvas ── */
	#ws-waves {
		position: absolute;
		inset: 0;
		width: 100%; height: 100%;
		z-index: 2;
		pointer-events: none;
	}

	#ws-top-icons {
		display: flex;
		gap: 8px;
		align-items: center;
	}
	.ws-icon-btn {
		width: 36px; height: 36px;
		border-radius: 50%;
		border: 1px solid rgba(80,160,220,0.3);
		background: rgba(8,22,45,0.75);
		display: flex; align-items: center; justify-content: center;
		font-size: 1.1rem;
		cursor: pointer;
		transition: background .18s, transform .12s;
		position: relative;
		-webkit-tap-highlight-color: transparent;
	}
	.ws-icon-btn:active { transform: scale(0.92); }
	.ws-icon-btn.ws-off { opacity: 0.45; }

	/* ── Toast 提示 ── */
	#ws-toast {
		position: absolute;
		top: 58px; right: 12px;
		background: rgba(8,22,45,0.95);
		border: 1px solid rgba(80,160,220,0.35);
		border-radius: 10px;
		padding: 7px 13px;
		font-size: .82rem;
		color: #d0eaff;
		z-index: 200;
		pointer-events: none;
		opacity: 0;
		transform: translateY(-6px);
		transition: opacity .22s, transform .22s;
		white-space: nowrap;
	}
	#ws-toast.show {
		opacity: 1;
		transform: translateY(0);
	}

	/* ── 港口容器（鋪滿全螢幕，與 welcome-screen 同層） ── */
	#ws-harbor-layer {
		position: absolute;
		top: 0; left: 0;
		width: 100%; height: 100%;
		z-index: 10;
		pointer-events: none;
	}

	/* ── 港口氣泡 ── */
	.ws-harbor {
		position: absolute;
		transform: translate(-50%, -50%);
		cursor: pointer;
		pointer-events: all;
		z-index: 12;
	}
	.ws-harbor .ws-h-core {
		width: 14px; height: 14px;
		border-radius: 50%;
		background: #7fd9ff;
		border: 1.5px solid rgba(255,255,255,0.55);
		margin: auto;
		transition: background .22s, transform .22s;
		animation: wsHarborPulse 2.8s ease-in-out infinite;
	}
	@keyframes wsHarborPulse {
		0%,100% { transform: scale(1); }
		50%      { transform: scale(1.18); }
	}
	.ws-harbor .ws-h-ring {
		position: absolute;
		top: 50%; left: 50%;
		width: 26px; height: 26px;
		border-radius: 50%;
		border: 1.5px solid rgba(127,217,255,0.4);
		transform: translate(-50%, -50%);
		animation: wsRingPulse 2.8s ease-in-out infinite;
		pointer-events: none;
	}
	@keyframes wsRingPulse {
		0%   { transform: translate(-50%,-50%) scale(.7); opacity:.7; }
		100% { transform: translate(-50%,-50%) scale(1.6); opacity:0; }
	}
	.ws-harbor .ws-h-label {
		position: absolute;
		top: 18px;
		left: 50%;
		transform: translateX(-50%);
		white-space: nowrap;
		font-size: .94rem;
		font-weight: 700;
		color: #fff;
		text-shadow: 0 1px 5px rgba(0,0,0,0.95), 0 0 8px rgba(0,0,0,0.8);
		pointer-events: none;
	}
	/* 西岸漁港標籤往右顯示，避免被邊緣切到 */
	.ws-harbor.label-right .ws-h-label {
		left: 14px;
		transform: none;
	}
	/* 選中狀態 */
	.ws-harbor.ws-selected .ws-h-core {
		background: #ffd86b;
		border-color: #fff;
		box-shadow: 0 0 0 3px rgba(255,216,107,0.35);
		animation: none;
		transform: scale(1.2);
	}
	.ws-harbor.ws-selected .ws-h-ring {
		border-color: rgba(255,216,107,0.6);
		animation: wsRingPulseGold 1.8s ease-in-out infinite;
	}
	@keyframes wsRingPulseGold {
		0%   { transform: translate(-50%,-50%) scale(.8); opacity:.8; }
		100% { transform: translate(-50%,-50%) scale(1.8); opacity:0; }
	}
	.ws-harbor.ws-selected .ws-h-label {
		color: #ffd86b;
		text-shadow: 0 1px 5px rgba(0,0,0,0.95), 0 0 12px rgba(255,216,107,0.5);
	}

	/* ── 小船 ── */
	#ws-boat {
		position: absolute;
		font-size: 1.5rem;
		transform: translate(-50%, -50%);
		transition: left 1.13s cubic-bezier(.2,.85,.2,1),
					top  1.13s cubic-bezier(.2,.85,.2,1);
		z-index: 11;
		pointer-events: auto;
		cursor: pointer;
		filter: drop-shadow(0 0 6px rgba(255,255,255,0.5));
		animation: wsBoatFloat 2.8s ease-in-out infinite;
	}
	#ws-boat:active { transform: translate(-50%, -50%) scale(0.9); }
	@keyframes wsBoatFloat {
		0%,100% { margin-top: 0; }
		50%      { margin-top: -3px; }
	}

	/* ── 右下角面板 ── */
	#ws-panel {
		position: absolute;
		right: 12px;
		bottom: 36px; /* 版權列高度上方 */
		width: 170px;
		max-height: calc(100vh - 36px - 64px); /* 扣掉頂部列與版權列，避免溢出螢幕 */
		overflow-y: auto;
		background: rgba(4, 14, 30, 0.8);
		border: 1px solid rgba(60,140,200,0.25);
		border-radius: 16px;
		padding: 12px 8px;
		z-index: 30;
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		box-shadow: 0 8px 32px rgba(0,0,0,0.45);
	}
	#ws-panel-hint {
		text-align: center;
		color: rgba(255,255,255,0.92);
		font-size: .82rem;
		line-height: 1.6;
		padding: 12px 2px;
	}
	#ws-panel-harbor-info {
		display: none;
	}
	#ws-panel-harbor-name {
		font-size: .92rem;
		font-weight: 700;
		color: #e8f4ff;
		margin-bottom: 1px;
		text-shadow: 0 0 10px rgba(80,180,255,0.5);
	}
	#ws-panel-harbor-name .ws-stars {
		color: #5ab0ff;
	}
	#ws-panel-badge {
		font-size: .72rem;
		color: #f5c842;
		margin-bottom: 9px;
	}
	.ws-panel-label {
		font-size: .68rem;
		letter-spacing: .1em;
		color: rgba(100,170,210,0.7);
		margin-bottom: 4px;
	}
	#ws-name-input {
		width: 100%;
		box-sizing: border-box;
		background: rgba(255,255,255,0.07);
		border: 1px solid rgba(60,140,200,0.3);
		border-radius: 8px;
		padding: 7px 9px;
		color: #ffffff;
		font-size: .85rem;
		font-family: "Microsoft JhengHei", sans-serif;
		outline: none;
		-webkit-user-select: text;
		user-select: text;
		transition: border-color .2s;
	}
	#ws-name-input::placeholder { color: rgba(120,180,220,0.4); }
	#ws-name-input:focus { border-color: rgba(100,200,255,0.6); }

	.ws-diff-row { display: flex; gap: 4px; margin-bottom: 10px; }
	.ws-diff-btn {
		flex: 1;
		padding: 6px 0;
		border-radius: 7px;
		border: 1px solid rgba(60,140,200,0.25);
		background: rgba(255,255,255,0.05);
		color: rgba(160,210,240,0.8);
		font-size: .825rem;
		cursor: pointer;
		transition: all .18s;
		font-family: "Microsoft JhengHei", sans-serif;
		-webkit-tap-highlight-color: transparent;
		text-align: center;
	}

	/* ── 左上角：守護員暱稱輸入框 ── */
	#ws-name-box {
		position: absolute;
		left: 12px;
		top: 64px; /* 頂部列高度下方 */
		width: 150px;
		background: rgba(4,14,30,0.8);
		border: 1px solid rgba(60,140,200,0.25);
		border-radius: 14px;
		padding: 10px 12px;
		z-index: 30;
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		box-shadow: 0 8px 32px rgba(0,0,0,0.35);
	}
	#ws-name-box .ws-panel-label { margin-bottom: 6px; color: #ffffff; }
	#ws-name-box .ws-panel-label {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	#ws-collection-badge {
		width: 26px;
		height: 26px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		font-size: .92rem;
		line-height: 1;
		cursor: pointer;
		background: rgba(255,255,255,0.07);
		border: 1px solid rgba(80,160,220,0.3);
		filter: none;
		transition: filter .18s ease, transform .12s ease, background .18s ease;
		-webkit-tap-highlight-color: transparent;
	}
	#ws-collection-badge:active { transform: scale(0.85); background: rgba(255,255,255,0.14); }
	#ws-collection-badge.ws-badge-empty { filter: grayscale(1) opacity(0.55); }

	/* ── 天氣海象卡片（暱稱框下方，只顯示當天天氣） ── */
	#ws-weather-box {
		position: absolute;
		left: 12px;
		top: 142px; /* 暱稱框下方 */
		max-width: 220px;
		width: max-content;
		background: rgba(4,14,30,0.8);
		border: 1px solid rgba(60,140,200,0.25);
		border-radius: 14px;
		padding: 8px 14px;
		z-index: 30;
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		box-shadow: 0 8px 32px rgba(0,0,0,0.35);
		opacity: 0;
		transform: translateY(-6px);
		transition: opacity .5s ease, transform .5s ease;
	}
	#ws-weather-box.show { opacity: 1; transform: translateY(0); }
	#ws-weather-box { cursor: pointer; }
	#ws-weather-label {
		font-size: .66rem;
		letter-spacing: .12em;
		color: rgba(160,210,240,0.65);
		margin-bottom: 3px;
	}
	#ws-weather-name {
		font-size: .88rem;
		font-weight: 700;
		color: #e8f4ff;
		white-space: nowrap;
		line-height: 1.4;
	}

	/* ── 港口關閉狀態：圓點變灰，文字維持原色清晰可讀 ── */
	.ws-harbor.ws-closed {
		cursor: not-allowed;
	}
	.ws-harbor.ws-closed .ws-h-core {
		background: #888;
		border-color: rgba(180,180,180,0.5);
		animation: none;
	}
	.ws-harbor.ws-closed .ws-h-ring { display: none; }
	.ws-diff-btn:active { transform: scale(0.94); }
	.ws-diff-btn.ws-active {
		background: rgba(255,183,77,0.15);
		border-color: rgba(255,200,100,0.55);
		color: #ffe89e;
		font-weight: 700;
	}

	#ws-start-btn {
		width: 100%;
		padding: 9px 0;
		border-radius: 12px;
		border: none;
		background: linear-gradient(135deg, #1a7abf, #0d5a94);
		color: #fff;
		font-size: .95rem;
		font-weight: 700;
		letter-spacing: .08em;
		cursor: pointer;
		font-family: "Microsoft JhengHei", sans-serif;
		transition: transform .12s, opacity .12s;
		-webkit-tap-highlight-color: transparent;
		position: relative;
		overflow: hidden;
	}
	#ws-start-btn::after {
		content: '';
		position: absolute;
		top: -50%; left: -70%;
		width: 40%; height: 200%;
		background: rgba(255,255,255,0.12);
		transform: rotate(28deg);
		animation: wsBtnShimmer 3s ease-in-out infinite;
	}
	@keyframes wsBtnShimmer { 0%,60%{left:-70%} 80%{left:130%} 100%{left:130%} }
	#ws-start-btn:active { transform: scale(0.96); opacity: .92; }

	/* ── 左下角：簡介 + 教學 ── */
	#ws-bottom-left {
		position: absolute;
		left: 12px;
		bottom: 36px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		z-index: 30;
	}
	.ws-sub-btn {
		padding: 7px 13px;
		border-radius: 14px;
		border: 1px solid rgba(100,180,220,0.28);
		background: rgba(4,14,30,0.82);
		color: rgba(160,215,245,0.85);
		font-size: .88rem;
		font-weight: 700;
		cursor: pointer;
		font-family: "Microsoft JhengHei", sans-serif;
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		transition: all .18s;
		white-space: nowrap;
		-webkit-tap-highlight-color: transparent;
	}
	.ws-sub-btn:active { transform: scale(0.95); background: rgba(10,30,58,0.9); }

	/* ── 版權列（永遠最底，不被遮蓋） ── */
	#ws-copyright {
		position: absolute;
		bottom: 0; left: 0; right: 0;
		height: 30px;
		background: rgba(2, 8, 18, 0.88);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 40;
		border-top: 1px solid rgba(40,100,160,0.15);
		padding-bottom: env(safe-area-inset-bottom, 0px);
	}
	#ws-copyright span {
		font-size: .84rem;
		color: rgba(160,210,240,0.75);
		letter-spacing: .04em;
	}
	#ws-copyright a {
		color: rgba(160,210,240,0.9);
		cursor: pointer;
		text-decoration: underline;
		text-underline-offset: 2px;
		text-decoration-color: rgba(160,210,240,0.4);
	}

	/* ── 結算報告關閉時的紅X覆蓋層 ── */
	#ws-rpt-btn .ws-rpt-x {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.1rem;
		font-weight: 900;
		color: #ff3333;
		pointer-events: none;
		line-height: 1;
	}
	`;
	document.head.appendChild(_style);

	/* ── 注入歡迎頁 HTML ── */
	var _ws = document.createElement('div');
	_ws.id = 'welcome-screen';
	_ws.style.display = 'none';
	_ws.innerHTML = `
		<!-- ── 背景：台灣地圖 ── -->
		<div id="ws-map-bg">
			<img src="image/tw.png" alt="台灣地圖" draggable="false">
		</div>

		<!-- ── 海浪動畫層 ── -->
		<canvas id="ws-waves"></canvas>

		<!-- ── 頂部列 ── -->
		<div id="ws-topbar">
			<div id="ws-top-title">
				<div id="ws-title-text">台灣海線任務</div>
			</div>
			<div id="ws-top-icons">
				<div class="ws-icon-btn" id="ws-sfx-btn" onclick="wsToggleSound()" title="音效・音樂">🔊</div>
				<div class="ws-icon-btn" id="ws-rpt-btn" onclick="wsToggleReport()" title="結算報告">📊</div>
			</div>
		</div>

		<!-- ── Toast 提示 ── -->
		<div id="ws-toast"></div>

		<!-- ── 港口氣泡層（JS 定位） ── -->
		<div id="ws-harbor-layer">
			<!-- 基隆八斗子：東北角海岸 -->
			<div class="ws-harbor" id="wsh-badouzi" data-id="badouzi" onclick="wsSelectHarbor('badouzi')">
				<div class="ws-h-ring"></div>
				<div class="ws-h-core"></div>
				<div class="ws-h-label">八斗子</div>
			</div>
			<!-- 宜蘭南方澳：東岸中上 -->
			<div class="ws-harbor" id="wsh-nanfangao" data-id="nanfangao" onclick="wsSelectHarbor('nanfangao')">
				<div class="ws-h-ring"></div>
				<div class="ws-h-core"></div>
				<div class="ws-h-label">南方澳</div>
			</div>
			<!-- 苗栗龍鳳：西岸中上 -->
			<div class="ws-harbor label-right" id="wsh-longfeng" data-id="longfeng" onclick="wsSelectHarbor('longfeng')">
				<div class="ws-h-ring"></div>
				<div class="ws-h-core"></div>
				<div class="ws-h-label">龍鳳</div>
			</div>
			<!-- 台中梧棲：西岸中段 -->
			<div class="ws-harbor label-right" id="wsh-wuqi" data-id="wuqi" onclick="wsSelectHarbor('wuqi')">
				<div class="ws-h-ring"></div>
				<div class="ws-h-core"></div>
				<div class="ws-h-label">梧棲</div>
			</div>
			<!-- 台南安平：西南岸 -->
			<div class="ws-harbor label-right" id="wsh-anping" data-id="anping" onclick="wsSelectHarbor('anping')">
				<div class="ws-h-ring"></div>
				<div class="ws-h-core"></div>
				<div class="ws-h-label">安平</div>
			</div>
			<!-- 屏東東港：南端偏東 -->
			<div class="ws-harbor" id="wsh-donggang" data-id="donggang" onclick="wsSelectHarbor('donggang')">
				<div class="ws-h-ring"></div>
				<div class="ws-h-core"></div>
				<div class="ws-h-label">東港</div>
			</div>
		</div>

		<!-- ── 小船 ── -->
		<div id="ws-boat" onclick="wsBoatClick()">⛵</div>

		<!-- ── 右下角面板 ── -->
		<div id="ws-panel">
			<!-- 未選港狀態 -->
			<div id="ws-panel-hint">👆 點選地圖上<br>的漁港出發</div>
			<!-- 選港後內容 -->
			<div id="ws-panel-content" style="display:none;">
				<div id="ws-panel-harbor-name"></div>
				<div id="ws-panel-badge"></div>
				<div class="ws-panel-label">難度選擇</div>
				<div class="ws-diff-row">
					<button class="ws-diff-btn ws-active" onclick="wsSetDiff(0.4,this)">新手</button>
					<button class="ws-diff-btn" onclick="wsSetDiff(0.7,this)">標準</button>
					<button class="ws-diff-btn" onclick="wsSetDiff(0.9,this)">專業</button>
				</div>
				<button id="ws-start-btn" onclick="wsStartGame()">⚓ 守護漁港</button>
			</div>
		</div>

		<!-- ── 左上角：守護員暱稱輸入 ── -->
		<div id="ws-name-box">
			<div class="ws-panel-label">
				<span>守護員暱稱</span>
				<span id="ws-collection-badge" class="ws-badge-empty" onclick="wsOpenCollection()" title="我的海紋收集">🏅</span>
			</div>
			<input id="ws-name-input" type="text"
				placeholder="輸入你的暱稱…" maxlength="12">
		</div>

		<!-- ── 天氣海象卡片（只顯示當天天氣，點擊顯示說明） ── -->
		<div id="ws-weather-box" onclick="wsShowWeatherDesc()">
			<div id="ws-weather-label">今日天氣</div>
			<div id="ws-weather-name"></div>
		</div>

		<!-- ── 左下角：簡介 + 教學 ── -->
		<div id="ws-bottom-left">
			<button class="ws-sub-btn" onclick="openInfo()">簡介說明</button>
			<button class="ws-sub-btn" onclick="startTutorial()">新手教學</button>
		</div>

		<!-- ── 版權列（永遠在最底，不被遮蓋） ── -->
		<div id="ws-copyright">
			<span>© 2026 海紋守護團 ·
				<a onclick="openContact()">聯絡作者</a>
			</span>
		</div>

		<!-- ── 聯絡我們彈窗 ── -->
		<div id="contact-overlay" style="display:none;position:absolute;inset:0;z-index:100;background:rgba(0,0,0,.82);align-items:center;justify-content:center;font-family:'Microsoft JhengHei','PingFang TC',sans-serif;">
			<div style="width:88%;max-width:360px;background:rgba(8,20,14,.96);border:1px solid rgba(100,200,150,.28);border-radius:20px;padding:28px 24px 24px;position:relative;">
				<button onclick="closeContact()" style="position:absolute;top:14px;right:16px;background:none;border:none;cursor:pointer;font-size:20px;color:rgba(200,240,220,.55);">✕</button>
				<div style="font-size:1.4rem;font-weight:900;color:rgba(200,245,220,.9);letter-spacing:1px;margin-bottom:4px;">聯絡作者</div>
				<div style="font-size:13px;color:rgba(160,210,180,.55);margin-bottom:20px;">歡迎留下您的想法或回饋</div>
				<iframe name="contact-iframe" style="display:none;"></iframe>
				<form id="contact-form" action="https://formspree.io/f/mrevayqw" method="POST" target="contact-iframe" style="display:flex;flex-direction:column;gap:12px;">
					<div>
						<div style="font-size:13px;color:rgba(160,210,180,.6);margin-bottom:5px;">名字（選填）</div>
						<input name="name" type="text" maxlength="30" placeholder="您的名字…" style="width:100%;box-sizing:border-box;background:rgba(255,255,255,.08);border:1px solid rgba(100,200,150,.25);border-radius:10px;padding:10px 12px;color:rgba(220,245,230,.9);font-size:15px;font-family:inherit;outline:none;">
					</div>
					<div>
						<div style="font-size:13px;color:rgba(160,210,180,.6);margin-bottom:5px;">聯絡方式（選填）</div>
						<input name="contact_method" type="text" maxlength="100" placeholder="Email / Line / WhatsApp…" style="width:100%;box-sizing:border-box;background:rgba(255,255,255,.08);border:1px solid rgba(100,200,150,.25);border-radius:10px;padding:10px 12px;color:rgba(220,245,230,.9);font-size:15px;font-family:inherit;outline:none;">
					</div>
					<div>
						<div style="font-size:13px;color:rgba(160,210,180,.6);margin-bottom:5px;">留言內容（必填）</div>
						<textarea name="message" required maxlength="500" placeholder="想說的話…" rows="4" style="width:100%;box-sizing:border-box;background:rgba(255,255,255,.08);border:1px solid rgba(100,200,150,.25);border-radius:10px;padding:10px 12px;color:rgba(220,245,230,.9);font-size:15px;font-family:inherit;outline:none;resize:none;"></textarea>
					</div>
					<div id="contact-msg" style="font-size:12px;text-align:center;min-height:18px;color:rgba(120,220,160,.8);"></div>
					<button type="submit" id="contact-submit-btn" style="width:100%;padding:14px;border-radius:50px;border:none;cursor:pointer;font-size:1rem;font-weight:900;font-family:inherit;background:linear-gradient(135deg,rgba(60,180,110,.9),rgba(30,140,80,.9));color:#fff;box-shadow:0 4px 16px rgba(40,160,90,.35);">送出留言</button>
				</form>
			</div>
		</div>
	`;
	/* 插入到 intro-screen 之後 */
	var _introScreen = document.getElementById('intro-screen');
	if(_introScreen && _introScreen.parentNode){
		_introScreen.parentNode.insertBefore(_ws, _introScreen.nextSibling);
	} else {
		document.body.appendChild(_ws);
	}

	/* ══ 歡迎頁地圖邏輯 ══════════════════════════════════ */

	/* ── 漁港座標（百分比座標對應 tw.png 原圖） ──
	   實際數值已移至 db.js 的 locationDB（每筆資料的 px/py 欄位）。
	   getHarbors() 每次呼叫都即時從 locationDB 組出 { id: {px, py} }，
	   而不是在這支檔案載入的當下就組好一份固定的物件：
	   因為 index.html 裡 <script src="db.js"> 是排在 welcome-screen.js
	   之後才載入，若在這裡的最上層直接組一次 HARBORS，會拿到還沒定義
	   的 locationDB。之後要調整漁港在地圖上的位置，只需改 db.js 裡
	   對應漁港的 px/py，不用動這支檔案。
	*/
	function getHarbors(){
		var out = {};
		(typeof locationDB !== 'undefined' ? locationDB : []).forEach(function(loc){
			out[loc.id] = { px: loc.px, py: loc.py };
		});
		return out;
	}

	/* 徽章資料（配合 db.js locationDB） */
	var HARBOR_INFO = {
		badouzi:  { name:'基隆八斗子漁港', shortName:'八斗子漁港', badge:'北岬海紋章', stars:'★★★★'   },
		nanfangao:{ name:'宜蘭南方澳漁港', shortName:'南方澳漁港', badge:'洄光海紋章', stars:'★★★★★'  },
		longfeng: { name:'苗栗龍鳳漁港',   shortName:'龍鳳漁港',   badge:'龍鳳初航章', stars:'★★★'     },
		wuqi:     { name:'台中梧棲漁港',   shortName:'梧棲漁港',   badge:'中港豐海章', stars:'★'        },
		anping:   { name:'台南安平漁港',   shortName:'安平漁港',   badge:'安平豐海章', stars:'★★'       },
		donggang: { name:'屏東東港漁港',   shortName:'東港漁港',   badge:'黑潮守護章', stars:'★★★★'   },
	};

	/* 暴露給 weather-event.js 使用 */
	window.HARBOR_INFO = HARBOR_INFO;

	/* ── 取得 tw.png 在螢幕上的實際渲染矩形 ──
	   img 是 object-fit:cover / object-position:center top
	   cover：縮放到「短邊填滿容器」，長邊溢出裁切。
	   用 window.innerWidth/Height，不依賴元素 offsetWidth（避免 display:none 時為 0）
	*/
	function getImgRect(){
		var img = document.querySelector('#ws-map-bg img');
		var cW  = window.innerWidth;
		var cH  = window.innerHeight;
		if(!img || !img.naturalWidth || !img.naturalHeight){
			return {left:0, top:0, width:cW, height:cH};
		}
		var nW = img.naturalWidth, nH = img.naturalHeight;
		var scale = Math.max(cW / nW, cH / nH); /* cover */
		var rW = nW * scale, rH = nH * scale;
		/* object-position: center top */
		var left = (cW - rW) / 2;
		var top  = 0;
		return { left:left, top:top, width:rW, height:rH };
	}

	/* ── 將港口氣泡和小船定位到地圖正確座標 ── */
	/**
	 * 依目前地圖實際渲染範圍（getImgRect），把 HARBORS 設定的百分比座標
	 * 換算成螢幕像素，套用到每個漁港氣泡的 left/top。
	 * 小船第一次定位（尚未被玩家選過港口時）會放在暱稱輸入框右側，
	 * 且暫時關閉 transition，避免畫面剛載入時出現「滑過去」的位移動畫。
	 */
	function positionHarbors(){
		var r = getImgRect();
		if(!r.width) return;
		var harbors = getHarbors();
		Object.keys(harbors).forEach(function(id){
			var h  = harbors[id];
			var el = document.getElementById('wsh-'+id);
			if(!el) return;
			var x = r.left + h.px * r.width;
			var y = r.top  + h.py * r.height;
			el.style.left = x + 'px';
			el.style.top  = y + 'px';
		});
		/* 小船初始位置：守護員暱稱輸入框旁邊 */
		var boat = document.getElementById('ws-boat');
		if(boat && !window._wsBoatMoved){
			var nameBoxEl = document.getElementById('ws-name-box');
			var px = nameBoxEl
				? (nameBoxEl.offsetLeft + nameBoxEl.offsetWidth + 22) / window.innerWidth
				: 0.46;
			var py = nameBoxEl
				? (nameBoxEl.offsetTop + nameBoxEl.offsetHeight * 0.5) / window.innerHeight
				: 0.1;
			boat.style.transition = 'none'; /* 初始定位不要動畫 */
			boat.style.left = (px * window.innerWidth)  + 'px';
			boat.style.top  = (py * window.innerHeight) + 'px';
			/* 下一幀恢復 transition */
			requestAnimationFrame(function(){
				boat.style.transition = '';
			});
		}
	}

	/* ── 圖片確保載入後再定位 ── */
	var _img = document.querySelector('#ws-map-bg img');
	function _doPosition(){
		requestAnimationFrame(function(){
			positionHarbors();
		});
	}
	if(_img){
		if(_img.complete && _img.naturalWidth){
			_doPosition();
		} else {
			_img.addEventListener('load', _doPosition);
		}
	}

	/* ── 頁面載入後直接補觸發（應對各種初始顯示時機） ── */
	setTimeout(positionHarbors, 100);
	setTimeout(positionHarbors, 400);

	/* ── resize 時重新定位 ── */
	var _resizeTimer;
	window.addEventListener('resize', function(){
		clearTimeout(_resizeTimer);
		_resizeTimer = setTimeout(positionHarbors, 80);
	});

	/* ── 選港 ── */
	/* 玩家選港狀態存進 sessionStorage：同一個分頁重新整理（例如切換難度後）
	   仍會記得上次選的漁港，不必重選。 */
	window.selectedLocationId = sessionStorage.getItem('selectedLocationId') || null;

	/**
	 * 玩家點擊地圖上某個漁港氣泡時呼叫。
	 * @param {string} id 漁港代碼（對應 HARBORS / HARBOR_INFO 的 key）
	 * 流程：若該港今日已被天氣／事件關閉則彈出原因提示並中止；
	 * 否則切換選中樣式、更新右下角資訊面板內容、把小船移動過去。
	 */
	window.wsSelectHarbor = function(id){
		/* 保險檢查：已關閉的港口不可選，改顯示原因說明 2 秒 */
		var elCheck = document.getElementById('wsh-'+id);
		if(elCheck && elCheck.classList.contains('ws-closed')){
			var r = window._wsWeatherResult;
			var msg = '⛔ 此港口今日封港';
			if(r){
				if(r.closedByEvent && r.closedByEvent[id] && r.event){
					msg = '⛔ ' + r.event.name + '：' + r.event.desc;
				} else if(r.weather){
					msg = '⛔ ' + r.weather.name + '：' + r.weather.desc;
				}
			}
			wsShowToast(msg, 2000);
			return;
		}
		/* 取消舊選中 */
		document.querySelectorAll('.ws-harbor').forEach(function(el){
			el.classList.remove('ws-selected');
		});
		/* 設定新選中 */
		var el = document.getElementById('wsh-'+id);
		if(el) el.classList.add('ws-selected');

		window.selectedLocationId = id;
		sessionStorage.setItem('selectedLocationId', id);

		/* 更新面板 */
		var info = HARBOR_INFO[id] || {};
		document.getElementById('ws-panel-harbor-name').innerHTML = (info.name || id) + ' <span class="ws-stars">' + (info.stars || '') + '</span>';
		document.getElementById('ws-panel-badge').textContent = '🏅 ' + (info.badge || '');
		document.getElementById('ws-panel-hint').style.display    = 'none';
		document.getElementById('ws-panel-content').style.display = 'block';

		/* 移動小船 */
		var r    = getImgRect();
		var h    = getHarbors()[id];
		var boat = document.getElementById('ws-boat');
		if(boat && h){
			boat.style.left = (r.left + h.px * r.width)  + 'px';
			boat.style.top  = (r.top  + h.py * r.height) + 'px';
			window._wsBoatMoved = true;
		}
	};

	/* 選港恢復由 MutationObserver 在 welcome-screen 顯示時統一處理 */

	/* ── 守護員暱稱徽章：依是否已輸入暱稱切換灰階 ── */
	function wsUpdateCollectionBadge(){
		var nameEl = document.getElementById('ws-name-input');
		var badge  = document.getElementById('ws-collection-badge');
		if(!badge) return;
		var hasName = !!(nameEl && nameEl.value.trim().length);
		badge.classList.toggle('ws-badge-empty', !hasName);
	}

	/* ── 點擊徽章：開啟「我的海紋收集」（依目前輸入框暱稱） ── */
	window.wsOpenCollection = function(){
		var nameEl = document.getElementById('ws-name-input');
		var typed  = nameEl && nameEl.value.trim();
		window.playerName = typed || '守護員';
		if(typeof openCollection === 'function'){
			openCollection();
		} else {
			wsShowToast('⚠️ 收集功能尚未載入');
		}
	};

	/* ── 點擊小船：提示可點選漁港出發 ── */
	window.wsBoatClick = function(){
		wsShowToast('💡 可以點擊漁港出發', 2000);
	};

	/* ── 自動帶入上次暱稱（頁面載入時即執行，不依賴選港） ── */
	(function(){
		var nameEl = document.getElementById('ws-name-input');
		if(!nameEl) return;
		var last = localStorage.getItem('lastPlayerName');
		if(last) nameEl.value = last;
		wsUpdateCollectionBadge();
		nameEl.addEventListener('input', wsUpdateCollectionBadge);
	})();

	/* ── Toast ── */
	var _toastTimer;
	/**
	 * 在畫面右上角顯示一則短暫提示訊息。
	 * @param {string} msg 顯示文字
	 * @param {number} [duration=1600] 顯示毫秒數，超過後自動淡出
	 */
	function wsShowToast(msg, duration){
		var t = document.getElementById('ws-toast');
		if(!t) return;
		t.textContent = msg;
		t.classList.add('show');
		clearTimeout(_toastTimer);
		_toastTimer = setTimeout(function(){ t.classList.remove('show'); }, duration || 1600);
	}
	/* 暴露給 weather-event.js 使用 */
	window.wsShowToast = wsShowToast;

	/* 點擊天氣框，顯示天氣說明 2 秒 */
	window.wsShowWeatherDesc = function(){
		var r = window._wsWeatherResult;
		if(!r || !r.weather) return;
		wsShowToast(r.weather.name + '：' + r.weather.desc, 2000);
	};

	/* ── 難度 ── */
	window.wsSetDiff = function(val, btn){
		if(typeof gameDifficulty !== 'undefined') gameDifficulty = val;
		document.querySelectorAll('.ws-diff-btn')
			.forEach(function(b){ b.classList.remove('ws-active'); });
		btn.classList.add('ws-active');
	};

	/* ── 音效・音樂 ──
	   歡迎頁本身沒有背景音樂，開關只儲存狀態，
	   不在這裡呼叫 bgm.play()，由遊戲開始後的 initGame 處理。
	*/
	var _sfxOn = sessionStorage.getItem('sfxEnabled') !== 'false';
	(function(){
		var btn = document.getElementById('ws-sfx-btn');
		if(!btn) return;
		if(!_sfxOn){ btn.textContent = '🔇'; btn.classList.add('ws-off'); }
	})();
	window.wsToggleSound = function(){
		_sfxOn = !_sfxOn;
		var btn = document.getElementById('ws-sfx-btn');
		if(btn){
			btn.textContent = _sfxOn ? '🔊' : '🔇';
			btn.classList.toggle('ws-off', !_sfxOn);
		}
		if(typeof sfxEnabled !== 'undefined') sfxEnabled = _sfxOn;
		sessionStorage.setItem('sfxEnabled', _sfxOn ? 'true' : 'false');
		/* 歡迎頁不播放 bgm，僅確保關閉時停掉（若遊戲音樂還在響） */
		if(!_sfxOn){
			var bgm = document.getElementById('bgm');
			if(bgm) bgm.pause();
		}
		wsShowToast(_sfxOn ? '🔊 音效已開啟' : '🔇 音效已關閉');
	};

	/* ── 結算報告 ── */
	var _rptOn = sessionStorage.getItem('reportMode') !== 'false';
	// 依目前 _rptOn 開關狀態重繪結算報告按鈕圖示（關閉時疊加一個紅色 ✕）。
	function _updateRptBtn(){
		var btn = document.getElementById('ws-rpt-btn');
		if(!btn) return;
		/* 清空舊內容 */
		btn.innerHTML = '';
		var icon = document.createElement('span');
		icon.textContent = '📊';
		if(!_rptOn){ icon.style.filter = 'grayscale(1)'; }
		btn.appendChild(icon);
		if(!_rptOn){
			var x = document.createElement('span');
			x.className = 'ws-rpt-x';
			x.textContent = '✕';
			btn.appendChild(x);
			btn.classList.add('ws-off');
		} else {
			btn.classList.remove('ws-off');
		}
	}
	_updateRptBtn();
	window.wsToggleReport = function(){
		_rptOn = !_rptOn;
		_updateRptBtn();
		if(typeof showSummaryMode !== 'undefined') showSummaryMode = _rptOn;
		sessionStorage.setItem('reportMode', _rptOn ? 'true' : 'false');
		wsShowToast(_rptOn ? '📊 結算報告已開啟' : '📊 結算報告已關閉');
	};

	/* ── 守護漁港（啟航） ── */
	/**
	 * 玩家按下「⚓ 守護漁港」後的啟航流程：
	 *   1. 檢查是否已選港口、該港口是否仍開放（避免選完後天氣事件才把它關閉的競態狀況）
	 *   2. 記住暱稱（localStorage）、把目前設定（暱稱/結算報告開關）同步給 main.js
	 *   3. 視覺效果：以選中漁港的螢幕座標為縮放中心（transform-origin），
	 *      把整個 welcome-screen 放大 2.5 倍並淡出，製造「鏡頭推近港口」的轉場感
	 *   4. 轉場動畫結束（3.05 秒）後才呼叫 main.js 的 initGame() 正式開局
	 */
	window.wsStartGame = function(){
		if(!window.selectedLocationId){
			wsShowToast('⚠️ 請先選擇出發漁港');
			return;
		}
		/* 保險檢查：避免殘留選擇繞過已封港的港口 */
		var elCheck2 = document.getElementById('wsh-'+window.selectedLocationId);
		if(elCheck2 && elCheck2.classList.contains('ws-closed')){
			wsShowToast('⛔ 此港口今日封港，請重新選擇');
			return;
		}
		var nameEl = document.getElementById('ws-name-input');
		var typedName = nameEl && nameEl.value.trim();
		if(typedName) localStorage.setItem('lastPlayerName', typedName);
		window.playerName = typedName || '守護員';
		sessionStorage.setItem('selectedLocationId', window.selectedLocationId);

		/* 按下按鈕的當下，就把選中的漁港 id 鎖進一個獨立變數，直接往下傳給 initGame()。
		   不要仰賴 3 秒轉場動畫「結束後」才重新去讀 window.selectedLocationId／sessionStorage——
		   這 3 秒空窗期內，不管什麼原因（背景頁面被系統回收、瀏覽器行為等）讓那兩個共用值
		   變成 null，都會導致 initGame() 抓到錯的地點。鎖進區域變數、當參數傳遞，
		   就能徹底避開這整類「延遲讀取共用可變狀態」造成的競爭問題。 */
		var lockedLocationId = window.selectedLocationId;

		/* 同步結算報告狀態到遊戲中按鈕 */
		if(typeof showSummaryMode !== 'undefined') showSummaryMode = _rptOn;
		var rBtn = document.getElementById('report-control');
		if(rBtn){
			if(_rptOn){
				rBtn.style.opacity = '1';
				rBtn.innerHTML = '📊';
			} else {
				rBtn.style.opacity = '0.85';
				rBtn.innerHTML = '<span style="filter:grayscale(1);display:inline-block;">📊</span>' +
					'<span style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:1.2em;font-weight:900;color:#ff2222;pointer-events:none;">✕</span>';
			}
		}

		/* ── ZOOM IN 到選中漁港後再啟動遊戲 ── */
		var harbDot = document.getElementById('wsh-' + window.selectedLocationId);
		var mapBg   = document.getElementById('ws-map-bg');
		var wsEl    = document.getElementById('welcome-screen');
		if(harbDot && mapBg && wsEl){
			var dotX = parseFloat(harbDot.style.left);
			var dotY = parseFloat(harbDot.style.top);
			var cW   = window.innerWidth;
			var cH   = window.innerHeight;
			/* 計算 transform-origin：以港口為縮放中心 */
			var ox = (dotX / cW * 100).toFixed(1) + '%';
			var oy = (dotY / cH * 100).toFixed(1) + '%';

			/* 黑色遮罩：墊在 welcome-screen 正下方，蓋住縮放期間可能露出的殘留背景
			   （transform-origin 是用漁港在地圖容器內的座標換算成視窗百分比，
			     精準度受地圖容器位置/縮放影響，遮罩可確保不管誤差多少都不會露餡） */
			var zoomMask = document.createElement('div');
			zoomMask.id = 'ws-zoom-mask';
			zoomMask.style.cssText = 'position:fixed;inset:0;background:#000;z-index:999;pointer-events:none;opacity:1;';
			document.body.appendChild(zoomMask);

			wsEl.style.transition        = 'transform 3s cubic-bezier(.4,0,.2,1)';
			wsEl.style.transformOrigin   = ox + ' ' + oy;
			wsEl.style.transform         = 'scale(5)';
			setTimeout(function(){
				wsEl.style.animation       = 'none';  /* 解除 welcomeFadeIn(forwards)對opacity的鎖定 */
				wsEl.style.transition      = '';
				wsEl.style.opacity         = '0';   /* 先藏起來，避免歸位瞬間被看到 */
				wsEl.style.transform       = '';
				wsEl.style.transformOrigin = '';
				if(typeof initGame === 'function') initGame(lockedLocationId);
				/* 遊戲畫面淡入需要 1 秒（body.game-started 的 transition），
				   遮罩跟著淡出，蓋過這段切換空檔，淡完後移除 */
				zoomMask.style.transition = 'opacity 1s ease';
				zoomMask.style.opacity    = '0';
				setTimeout(function(){ zoomMask.remove(); }, 1050);
			}, 3000);
		} else {
			if(typeof initGame === 'function') initGame(lockedLocationId);
		}
	};

	/* ── 海浪動畫（canvas，台灣島周邊偶發波紋） ── */
	(function(){
		var cv  = document.getElementById('ws-waves');
		if(!cv) return;
		var ctx = cv.getContext('2d');

		/* 波紋物件池 */
		var ripples = [];

		/* tw.png 在畫面上的島嶼邊界（近似橢圓，由 getImgRect 換算）
		   島嶼在原圖中：cx≈50%, cy≈50%, rx≈38%, ry≈40%
		   每次產生波紋時，從橢圓邊界隨機取一點 */
		function randIslandEdge(){
			var r = getImgRect();
			if(!r.width) return null;
			/* 島的橢圓參數（原圖百分比） */
			var icx = 0.49, icy = 0.50, irx = 0.34, iry = 0.38;
			var angle = Math.random() * Math.PI * 2;
			/* 橢圓邊上取點，加少許 jitter */
			var jitter = 0.92 + Math.random() * 0.16;
			var px = icx + Math.cos(angle) * irx * jitter;
			var py = icy + Math.sin(angle) * iry * jitter;
			return {
				x: r.left + px * r.width,
				y: r.top  + py * r.height,
			};
		}

		// 在 randIslandEdge() 算出的隨機島嶼邊緣座標上，新增一個半徑會逐漸放大、透明度逐漸降低的波紋物件。
		function addRipple(){
			var pt = randIslandEdge();
			if(!pt) return;
			ripples.push({
				x: pt.x, y: pt.y,
				r: 0,
				maxR: 28 + Math.random() * 22,
				life: 0,          /* 0~1 */
				speed: 0.006 + Math.random() * 0.005,
			});
		}

		/* 每隔 0.9~2s 隨機加一個波紋（原 1.8~4s，頻率 200%） */
		function scheduleRipple(){
			addRipple();
			setTimeout(scheduleRipple, 900 + Math.random() * 1100);
		}

		function resize(){
			cv.width  = window.innerWidth;
			cv.height = window.innerHeight;
		}
		resize();
		window.addEventListener('resize', resize);

		var _rafId;
		/**
		 * 波紋動畫主迴圈（requestAnimationFrame 持續呼叫）：
		 * 每顆波紋依 life（0~1 進度）畫出一圈逐漸放大、逐漸透明的圓圈，
		 * 進度過 0.2 後會疊加畫第二圈（半徑、出現時機都稍微落後第一圈），
		 * 製造出雙圈漣漪的視覺效果；life 到 1 或完全透明就從陣列移除。
		 */
		function draw(){
			ctx.clearRect(0, 0, cv.width, cv.height);
			for(var i = ripples.length - 1; i >= 0; i--){
				var rp = ripples[i];
				rp.life += rp.speed;
				rp.r = rp.maxR * rp.life;
				var alpha = (1 - rp.life) * 0.38;
				if(alpha <= 0 || rp.life >= 1){
					ripples.splice(i, 1);
					continue;
				}
				ctx.beginPath();
				ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2);
				ctx.strokeStyle = 'rgba(140,210,255,' + alpha.toFixed(3) + ')';
				ctx.lineWidth = 1.2;
				ctx.stroke();

				/* 第二圈（比第一圈小、稍微慢半拍） */
				if(rp.life > 0.2){
					var r2    = rp.maxR * (rp.life - 0.18);
					var a2    = (1 - (rp.life - 0.18)) * 0.22;
					if(r2 > 0 && a2 > 0){
						ctx.beginPath();
						ctx.arc(rp.x, rp.y, r2, 0, Math.PI * 2);
						ctx.strokeStyle = 'rgba(180,230,255,' + a2.toFixed(3) + ')';
						ctx.lineWidth = 0.8;
						ctx.stroke();
					}
				}
			}
			_rafId = requestAnimationFrame(draw);
		}

		/* 只在 welcome-screen 可見時跑動畫 */
		function startWaves(){
			if(_rafId) return;
			scheduleRipple();
			draw();
		}
		function stopWaves(){
			cancelAnimationFrame(_rafId);
			_rafId = null;
			ripples = [];
		}

		/* 把波浪的 start/stop 暴露給外層統一的 MutationObserver 呼叫 */
		window._wsStartWaves = startWaves;
		window._wsStopWaves  = stopWaves;
	})();

	/* ── 統一 MutationObserver：welcome-screen 顯示時同時定位港口＋啟動波浪＋抽天氣事件 ── */
	/* welcome-screen 的顯示/隱藏是由外部（index.html / main.js）直接改 style.display
	   或切換 class 來控制，本檔並不知道何時會被顯示，所以用 MutationObserver
	   監看它的 style/class 屬性變化，一旦偵測到「變成可見」就統一處理：
	   重新定位漁港座標（畫面尺寸可能已變）、啟動海浪動畫、重新抽一次當日天氣與封港事件。 */
	var _wsEl = document.getElementById('welcome-screen');
	if(_wsEl){
		// 用「上升緣」偵測（從不可見 → 可見的那一刻才動作），
		// 而不是「只要目前可見，任何 style 屬性變動都算一次」。
		// 原本的寫法會讓 ZOOM 轉場期間（wsStartGame 改 transform/opacity/
		// transition 等 style 屬性、但沒有動到 display）被誤判成
		// 「welcome-screen 又重新顯示了」，導致 rollAndApplyWeather()
		// 在轉場過程中被重複呼叫、重新抽一次封港事件，
		// 有機會把玩家剛選好、已經鎖定的漁港判定為封港、清空選擇。
		var _wsWasVisible = (_wsEl.style.display !== 'none' && _wsEl.style.display !== '');
		new MutationObserver(function(){
			var visible = (_wsEl.style.display !== 'none' && _wsEl.style.display !== '');
			if(visible && !_wsWasVisible){
				positionHarbors();
				setTimeout(positionHarbors, 50);
				setTimeout(positionHarbors, 200);
				if(window._wsStartWaves) window._wsStartWaves();
				if(typeof window.rollAndApplyWeather === 'function') window.rollAndApplyWeather();
			} else if(!visible && _wsWasVisible){
				if(window._wsStopWaves) window._wsStopWaves();
			}
			_wsWasVisible = visible;
		}).observe(_wsEl, { attributes:true, attributeFilter:['style','class'] });
	}

	/* 頁面首次載入時，若 welcome-screen 一開始就是可見狀態，也要抽一次 */
	if(_wsEl && _wsEl.style.display !== 'none' && _wsEl.style.display !== ''){
		if(typeof window.rollAndApplyWeather === 'function') window.rollAndApplyWeather();
	}

})();
