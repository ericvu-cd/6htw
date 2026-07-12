// =============================================
// 🏆 結束畫面 showWinScreen(winner)
// =============================================

function showWinScreen(winner) {
    const isPlayer = !winner.isAI;

    // ── 勝利時解鎖難度章 ──
    if (isPlayer) {
        const diffLabelShort = gameDifficulty <= 0.4 ? "新手" : gameDifficulty >= 0.9 ? "專業" : "標準";
        progress.unlockDifficulty(window.playerName, diffLabelShort);
    }

    // ── 行為型勳章判斷，追蹤本局新解鎖 ──
    const newlyUnlockedBadges = [];

    if (isPlayer && typeof badgeTracker !== "undefined") {
        const cards = badgeTracker.playerCards;
        const total = cards.length;
        const playerName = window.playerName;

        const checkAndUnlock = (key) => {
            if (!playerName || !playerName.trim() || playerName.trim() === '守護員') return;
            const data = progress.load(playerName);
            const already = data && data.behaviorBadges && data.behaviorBadges.includes(key);
            progress.unlockBehaviorBadge(playerName, key);
            if (!already) newlyUnlockedBadges.push(key);
        };

        if (total > 0) {
            const allCards   = cards.map(c => c.card);
            const allSuccess = cards.every(c => c.isSuccess);

            if (total >= 3 && allCards.every(f => f.l === 1)) checkAndUnlock("綠燈先鋒");
            if (allCards.filter(f => f.m.includes("一支釣")).length >= 4) checkAndUnlock("一支釣達人");
            if (allCards.every(f => f.l === 1) && allSuccess && total >= 3) checkAndUnlock("完美永續局");
            if (allCards.filter(f => f.l === 3).length >= 3) checkAndUnlock("紅燈護送員");
            if (allCards.filter(f => f.d === "養殖").length >= 3) checkAndUnlock("養殖支持者");
            if (allCards.some(f => f.n === "鯨鯊")) checkAndUnlock("深海傳說");
            if (badgeTracker.returnCount >= 3) checkAndUnlock("浴火重生");
            if (allSuccess && total >= 4) checkAndUnlock("百發百中");
            const uniqueGreenSed = [...new Set(allCards.filter(f => f.l === 1 && f.h === "定棲性").map(f => f.n))];
            if (uniqueGreenSed.length >= 3) checkAndUnlock("珊瑚守護者");
            if (new Set(allCards.flatMap(f => f.m)).size >= 5) checkAndUnlock("漁法通");
            if (total >= 4 && allCards.every(f => f.d === "近海") && allSuccess) checkAndUnlock("近海英雄");
            const isPerfect  = allCards.every(f => f.l === 1) && allSuccess && total >= 3;
            const isBullseye = allSuccess && total >= 4;
            if (isPerfect && isBullseye && badgeTracker.returnCount >= 3) checkAndUnlock("海紋守護王");
        }
    }

    // 解除 ui-lock
    const uiLock = document.getElementById("ui-lock");
    if (uiLock) uiLock.style.display = "none";

    // 寫入初始手牌快照 → 組成「🏆本局結果」總結段落
    if (typeof initialHands !== "undefined" && initialHands.length > 0) {
        const meta = (typeof window !== "undefined" && window.gameMeta) ? window.gameMeta : {};
        const diffShort = meta.diffShort || (gameDifficulty <= 0.4 ? "新手" : gameDifficulty >= 0.9 ? "專業" : "標準");
        gameEndSummary = {
            location: meta.locationLabel || "未指定海線",
            diffText: `${diffShort}（${gameDifficulty}）`,
            winnerName: winner.n,
            totalRounds: typeof roundCount !== "undefined" ? roundCount : "?",
            initialHands: initialHands
        };
        if (typeof renderLog === "function") renderLog();
    }

    // ── BGM 切換 ──
    const gameBgm = document.getElementById("bgm");
    const musicWasOn = gameBgm && !gameBgm.paused;
    if (musicWasOn) gameBgm.pause();
    const winBgm = new Audio("MZ.mp3");
    winBgm.loop = true; winBgm.volume = 0;
    if (musicWasOn) {
        winBgm.play().catch(() => {});
        let vol = 0;
        const fadeInBgm = setInterval(() => { vol = Math.min(1, vol + 0.04); winBgm.volume = vol; if (vol >= 1) clearInterval(fadeInBgm); }, 80);
    }

    const hasNewBadge = isPlayer && newlyUnlockedBadges.length > 0;
    let currentBadgeIdx = 0;

    // ── CSS Keyframes（注入一次）──
    if (!document.getElementById("win-screen-keyframes")) {
        const style = document.createElement("style");
        style.id = "win-screen-keyframes";
        style.textContent = `
            @keyframes winRayFade    {0%,100%{opacity:.2}50%{opacity:.9}}
            @keyframes winGoldPulse  {0%,100%{transform:translateX(-50%) scale(1);opacity:.55}50%{transform:translateX(-50%) scale(1.28);opacity:1}}
            @keyframes winDeepPulse  {0%,100%{transform:translateX(-50%) scale(1);opacity:.45}50%{transform:translateX(-50%) scale(1.34);opacity:1}}
            @keyframes winSpinRing   {to{transform:rotate(360deg)}}
            @keyframes winDropIn     {from{opacity:0;transform:scale(.4) translateY(-30px)}to{opacity:1;transform:scale(1) translateY(0)}}
            @keyframes winFadeUp     {from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
            @keyframes winParticle   {0%{transform:translateY(0) translateX(0);opacity:0}8%{opacity:1}92%{opacity:.7}100%{transform:translateY(-600px) translateX(var(--dx,8px));opacity:0}}
            @keyframes winCFall      {0%{transform:translateY(-8px) rotate(0deg);opacity:1}100%{transform:translateY(660px) rotate(730deg);opacity:0}}
            @keyframes winBadgePop   {0%{opacity:0;transform:scale(.3) rotate(-12deg)}65%{transform:scale(1.12) rotate(2deg)}100%{opacity:1;transform:scale(1) rotate(0deg)}}
            @keyframes winBadgeSlide {from{opacity:0;transform:translateX(40px) scale(.85)}to{opacity:1;transform:translateX(0) scale(1)}}
            @keyframes winAuraBreath {0%,100%{box-shadow:0 0 28px 8px rgba(255,210,40,.45),0 0 60px 20px rgba(255,180,20,.2)}50%{box-shadow:0 0 52px 18px rgba(255,220,60,.85),0 0 100px 40px rgba(255,190,30,.4)}}
            @keyframes winAuraBlue   {0%,100%{box-shadow:0 0 28px 8px rgba(60,140,255,.45),0 0 60px 20px rgba(40,100,255,.2)}50%{box-shadow:0 0 52px 18px rgba(80,160,255,.85),0 0 100px 40px rgba(60,130,255,.4)}}
            @keyframes winIconFloat  {0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-10px) scale(1.06)}}
            @keyframes winIconFloatSm{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
            @keyframes winSharePulse {0%,100%{transform:scale(1);box-shadow:0 4px 20px rgba(255,160,40,.5)}50%{transform:scale(1.03);box-shadow:0 6px 32px rgba(255,160,40,.85)}}
            @keyframes winSharePulseB{0%,100%{transform:scale(1);box-shadow:0 4px 20px rgba(60,130,255,.5)}50%{transform:scale(1.03);box-shadow:0 6px 32px rgba(60,130,255,.85)}}
            @keyframes winDotPulse   {0%,100%{transform:scale(1)}50%{transform:scale(1.5)}}
        `;
        document.head.appendChild(style);
    }

    // ── 全螢幕遮罩 ──
    const overlay = document.createElement("div");
    overlay.id = "win-overlay";
    overlay.style.cssText = `
        position:fixed;inset:0;z-index:5000;overflow:hidden;
        font-family:"Microsoft JhengHei","PingFang TC",sans-serif;
        background:#000;opacity:0;transition:opacity 1s ease;
    `;

    // 背景圖
    const bgDiv = document.createElement("div");
    bgDiv.style.cssText = `
        position:absolute;inset:0;
        background:url('image/bge.png') center center/cover no-repeat;
        opacity:${isPlayer ? 1 : 0.9};
        ${isPlayer ? '' : 'filter:hue-rotate(190deg) saturate(.85) brightness(.65);'}
    `;
    overlay.appendChild(bgDiv);

    // 漸層遮罩
    const mask = document.createElement("div");
    mask.style.cssText = `
        position:absolute;inset:0;pointer-events:none;
        background:${isPlayer
            ? 'linear-gradient(180deg,rgba(2,10,6,.22) 0%,rgba(1,6,3,.05) 35%,rgba(0,8,3,.72) 100%)'
            : 'linear-gradient(180deg,rgba(1,5,15,.32) 0%,rgba(2,8,20,.08) 35%,rgba(0,4,16,.78) 100%)'};
    `;
    overlay.appendChild(mask);

    // ── 特效層 ──
    const fxLayer = document.createElement("div");
    fxLayer.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:hidden;";
    overlay.appendChild(fxLayer);

    // 光柱
    if (isPlayer) {
        [{l:"8%",w:"3px",d:"-10",t:"0s"},{l:"22%",w:"6px",d:"-5",t:".5s"},
         {l:"38%",w:"10px",d:"-1",t:"1.1s"},{l:"56%",w:"7px",d:"3",t:".25s"},
         {l:"72%",w:"5px",d:"6",t:".9s"},{l:"87%",w:"3px",d:"10",t:"1.6s"}
        ].forEach(r => {
            const ray = document.createElement("div");
            ray.style.cssText = `position:absolute;top:0;left:${r.l};width:${r.w};height:68%;border-radius:4px;transform-origin:top center;transform:rotate(${r.d}deg);background:linear-gradient(180deg,rgba(120,255,170,.32) 0%,transparent 100%);animation:winRayFade 4s ${r.t} ease-in-out infinite;`;
            fxLayer.appendChild(ray);
        });
        const glow = document.createElement("div");
        glow.style.cssText = `position:absolute;bottom:-80px;left:50%;transform:translateX(-50%);width:380px;height:380px;border-radius:50%;background:radial-gradient(circle,rgba(255,200,50,.2) 0%,transparent 60%);animation:winGoldPulse 3.2s ease-in-out infinite;`;
        fxLayer.appendChild(glow);
    } else {
        const deepGlow = document.createElement("div");
        deepGlow.style.cssText = `position:absolute;bottom:-80px;left:50%;transform:translateX(-50%);width:400px;height:400px;border-radius:50%;background:radial-gradient(circle,rgba(40,100,255,.16) 0%,transparent 58%);animation:winDeepPulse 4s ease-in-out infinite;`;
        fxLayer.appendChild(deepGlow);
    }

    // 粒子
    function spawnParticle() {
        const p = document.createElement("div");
        const sz = 2 + Math.random() * 5;
        const dur = 8 + Math.random() * 10;
        const colors = isPlayer
            ? ["rgba(120,255,170,.8)","rgba(255,220,80,.75)","rgba(255,200,60,.7)","rgba(200,255,210,.6)"]
            : ["rgba(100,185,255,.8)","rgba(80,160,255,.7)","rgba(150,210,255,.6)","rgba(60,145,255,.65)"];
        p.style.cssText = `position:absolute;border-radius:50%;pointer-events:none;width:${sz}px;height:${sz}px;left:${Math.random()*96}%;bottom:-${sz}px;background:${colors[Math.floor(Math.random()*colors.length)]};animation:winParticle ${dur}s ${Math.random()*4}s linear forwards;--dx:${(Math.random()*28-14).toFixed(1)}px;`;
        fxLayer.appendChild(p);
        setTimeout(() => p.remove(), (dur + 5) * 1000);
    }
    for (let i = 0; i < 20; i++) spawnParticle();
    const particleTimer = setInterval(spawnParticle, 900);

    // 彩帶
    const confColors = ["#ffd060","#ff7eb3","#7ee8fa","#22d48a","#b8a4ff","#ff9068","#ffe580","#a8f0c8"];
    function burstConfetti() {
        for (let i = 0; i < 32; i++) {
            const c = document.createElement("div");
            const dur = 2.2 + Math.random() * 2.6;
            c.style.cssText = `position:absolute;border-radius:2px;pointer-events:none;left:${5+Math.random()*90}%;top:-8px;width:${5+Math.random()*8}px;height:${5+Math.random()*8}px;background:${confColors[Math.floor(Math.random()*confColors.length)]};transform:rotate(${Math.random()*360}deg);animation:winCFall ${dur}s ${Math.random()*.8}s linear forwards;`;
            fxLayer.appendChild(c);
            setTimeout(() => c.remove(), (dur + 1.2) * 1000);
        }
    }
    if (isPlayer) {
        setTimeout(burstConfetti, 200);
        setTimeout(burstConfetti, 1600);
        setTimeout(burstConfetti, 3200);
    }

    // ── 中央內容（flex column, 垂直居中）──
    const content = document.createElement("div");
    content.style.cssText = `
        position:absolute;inset:0;z-index:20;
        display:flex;flex-direction:column;align-items:center;justify-content:center;
        padding:32px 20px 28px;gap:0;
        overflow-y:auto;-webkit-overflow-scrolling:touch;
    `;

    // ── 小標題（玩家名 + 狀態）──
    const titleRow = document.createElement("div");
    titleRow.style.cssText = `
        text-align:center;margin-bottom:${hasNewBadge ? '20px' : '26px'};
        animation:winFadeUp .6s .2s both;
    `;

    if (isPlayer) {
        const winIcon = document.createElement("div");
        winIcon.style.cssText = `font-size:38px;margin-bottom:8px;animation:winIconFloatSm 2.4s ease-in-out infinite;filter:drop-shadow(0 0 12px rgba(255,200,40,.9));`;
        winIcon.textContent = "🏆";
        titleRow.appendChild(winIcon);

        const titleText = document.createElement("div");
        titleText.style.cssText = `font-size:1.9rem;font-weight:900;color:#fff;letter-spacing:2px;line-height:1.15;text-shadow:0 0 24px rgba(100,255,160,.7),0 2px 12px rgba(0,0,0,.95);`;
        titleText.innerHTML = `✦ ${winner.n} 任務達成 ✦`;
        titleRow.appendChild(titleText);

        const subText = document.createElement("div");
        subText.style.cssText = `font-size:.95rem;color:rgba(170,255,200,.85);margin-top:6px;text-shadow:0 1px 8px rgba(0,0,0,.8);`;
        subText.innerHTML = "感謝您守護海洋資源，實踐永續食魚精神！";
        titleRow.appendChild(subText);
    } else {
        const loseIcon = document.createElement("div");
        loseIcon.style.cssText = `font-size:36px;margin-bottom:8px;animation:winIconFloatSm 2.6s ease-in-out infinite;filter:drop-shadow(0 0 10px rgba(60,140,255,.8));`;
        loseIcon.textContent = "🌊";
        titleRow.appendChild(loseIcon);

        const titleText = document.createElement("div");
        titleText.style.cssText = `font-size:1.85rem;font-weight:900;color:rgba(215,235,255,.97);letter-spacing:2px;line-height:1.15;text-shadow:0 0 22px rgba(50,130,255,.65),0 2px 12px rgba(0,0,0,.95);`;
        titleText.textContent = "海域重歸寧靜";
        titleRow.appendChild(titleText);

        const subText = document.createElement("div");
        subText.style.cssText = `font-size:.95rem;color:rgba(140,190,255,.85);margin-top:6px;text-shadow:0 1px 8px rgba(0,0,0,.8);`;
        subText.innerHTML = `由 <strong style="color:#c8e0ff;">${winner.n}</strong> 率先與大海達成和解，這次還差一點點…`;
        titleRow.appendChild(subText);
    }
    content.appendChild(titleRow);

    // ── 勳章輪播區（有新勳章才出現，是畫面主角）──
    if (hasNewBadge) {
        const carouselWrap = document.createElement("div");
        carouselWrap.style.cssText = `
            width:100%;max-width:340px;
            display:flex;flex-direction:column;align-items:center;
            margin-bottom:22px;
            animation:winFadeUp .65s .35s both;
        `;

        // 勳章卡片
        const card = document.createElement("div");
        card.style.cssText = `
            width:100%;
            background:rgba(10,8,4,.55);
            border:2px solid rgba(255,215,60,.5);
            border-radius:28px;
            padding:28px 20px 22px;
            display:flex;flex-direction:column;align-items:center;gap:10px;
            position:relative;overflow:hidden;
            backdrop-filter:blur(12px);
        `;

        // 卡片內光暈背景
        const cardGlow = document.createElement("div");
        cardGlow.style.cssText = `position:absolute;inset:0;border-radius:28px;background:radial-gradient(ellipse at 50% 40%,rgba(255,200,40,.18) 0%,transparent 68%);pointer-events:none;`;
        card.appendChild(cardGlow);

        // 新成就標籤
        const newLabel = document.createElement("div");
        newLabel.style.cssText = `font-size:11px;font-weight:700;letter-spacing:3px;color:rgba(255,230,100,.75);`;
        newLabel.textContent = newlyUnlockedBadges.length > 1 ? `✨ 解鎖了 ${newlyUnlockedBadges.length} 枚新成就` : "✨ 新成就解鎖";
        card.appendChild(newLabel);

        // 大圖示
        const iconEl = document.createElement("div");
        iconEl.style.cssText = `
            font-size:96px;line-height:1;
            filter:drop-shadow(0 0 20px rgba(255,210,40,.9));
            animation:winBadgePop .7s cubic-bezier(.34,1.56,.64,1) both, winIconFloat 2.6s .7s ease-in-out infinite;
        `;

        // 勳章名稱
        const nameEl = document.createElement("div");
        nameEl.style.cssText = `font-size:1.5rem;font-weight:900;color:rgba(255,248,185,.97);letter-spacing:1px;text-align:center;text-shadow:0 0 18px rgba(255,210,40,.7);`;

        // 分享提示小字
        const hintEl = document.createElement("div");
        hintEl.style.cssText = `font-size:12px;color:rgba(255,230,120,.6);letter-spacing:.5px;margin-top:-2px;`;
        hintEl.textContent = "這個成就可以分享給朋友 👇";

        card.appendChild(iconEl);
        card.appendChild(nameEl);
        card.appendChild(hintEl);

        // 點點指示器（多枚才顯示）
        let dotsEl = null;
        if (newlyUnlockedBadges.length > 1) {
            dotsEl = document.createElement("div");
            dotsEl.style.cssText = `display:flex;gap:7px;margin-top:4px;`;
            for (let i = 0; i < newlyUnlockedBadges.length; i++) {
                const d = document.createElement("div");
                d.style.cssText = `width:7px;height:7px;border-radius:50%;background:rgba(255,215,60,${i===0?'.95':'.3'});transition:background .3s,transform .3s;`;
                dotsEl.appendChild(d);
            }
            card.appendChild(dotsEl);
        }

        carouselWrap.appendChild(card);
        content.appendChild(carouselWrap);

        // ── 切換邏輯 ──
        const BADGE_META = {
            "綠燈先鋒":"🟢","一支釣達人":"🎣","完美永續局":"🏆",
            "紅燈護送員":"🔴","養殖支持者":"🌾","深海傳說":"🐋",
            "浴火重生":"🔄","百發百中":"💯","海紋守護王":"👑",
            "珊瑚守護者":"🪸","漁法通":"🎯","近海英雄":"🌏"
        };

        function showBadge(idx, animate) {
            const key = newlyUnlockedBadges[idx];
            const icon = BADGE_META[key] || "⭐";
            if (animate) {
                iconEl.style.animation = "none";
                nameEl.style.animation = "none";
                void iconEl.offsetWidth;
                iconEl.style.animation = "winBadgeSlide .4s cubic-bezier(.34,1.56,.64,1) both, winIconFloat 2.6s .4s ease-in-out infinite";
                nameEl.style.animation = "winBadgeSlide .4s .05s ease both";
            }
            iconEl.textContent = icon;
            nameEl.textContent = key;
            if (dotsEl) {
                [...dotsEl.children].forEach((d, i) => {
                    d.style.background = `rgba(255,215,60,${i===idx?'.95':'.28'})`;
                    d.style.transform = i===idx ? 'scale(1.4)' : 'scale(1)';
                });
            }
            currentBadgeIdx = idx;
            // 更新分享按鈕文字（稍後建立，用 ref）
            if (window._winShareBtn) {
                window._winShareBtn.textContent = `📤 分享「${key}」成就`;
            }
        }

        showBadge(0, false);

        // 自動輪播
        let autoTimer = null;
        if (newlyUnlockedBadges.length > 1) {
            autoTimer = setInterval(() => {
                showBadge((currentBadgeIdx + 1) % newlyUnlockedBadges.length, true);
            }, 3200);
        }

        // 手勢滑動
        let touchStartX = 0;
        card.addEventListener("touchstart", e => { touchStartX = e.touches[0].clientX; }, { passive: true });
        card.addEventListener("touchend", e => {
            const dx = e.changedTouches[0].clientX - touchStartX;
            if (Math.abs(dx) < 40) return;
            if (autoTimer) clearInterval(autoTimer);
            const next = dx < 0
                ? (currentBadgeIdx + 1) % newlyUnlockedBadges.length
                : (currentBadgeIdx - 1 + newlyUnlockedBadges.length) % newlyUnlockedBadges.length;
            showBadge(next, true);
            autoTimer = setInterval(() => {
                showBadge((currentBadgeIdx + 1) % newlyUnlockedBadges.length, true);
            }, 3200);
        }, { passive: true });
    }

    // ── 按鈕區 ──
    const btnZone = document.createElement("div");
    btnZone.style.cssText = `
        display:flex;flex-direction:column;align-items:center;gap:12px;
        width:100%;max-width:340px;
        animation:winFadeUp .65s ${hasNewBadge ? '.55s' : '.4s'} both;
    `;

    // ── 主角按鈕：分享（有新勳章時）or 重新啟航（無新勳章時）──
    if (hasNewBadge) {
        // 分享是主角
        const btnShare = document.createElement("button");
        btnShare.style.cssText = `
            width:100%;padding:19px;border-radius:50px;border:none;cursor:pointer;
            font-size:1.15rem;font-weight:900;letter-spacing:.5px;
            font-family:"Microsoft JhengHei","PingFang TC",sans-serif;
            background:linear-gradient(135deg,#ffd060,#ff8c42);
            color:#3a1800;
            animation:winSharePulse 2.4s ease-in-out infinite;
        `;
        btnShare.textContent = `📤 分享「${newlyUnlockedBadges[0]}」成就`;
        window._winShareBtn = btnShare;
        btnShare.onclick = () => shareAchievementCard(isPlayer, winner, newlyUnlockedBadges[currentBadgeIdx]);
        btnZone.appendChild(btnShare);

        // 重新啟航是次要
        const btnRestart = document.createElement("button");
        btnRestart.style.cssText = `
            width:100%;padding:15px;border-radius:50px;cursor:pointer;
            font-size:1rem;font-weight:700;letter-spacing:.3px;
            font-family:"Microsoft JhengHei","PingFang TC",sans-serif;
            border:1.5px solid rgba(255,210,80,.45);
            background:rgba(255,180,40,.12);
            color:rgba(255,240,160,.92);
        `;
        btnRestart.textContent = "↺ 重新啟航冒險";
        btnRestart.onclick = () => _restartGame(winBgm, gameBgm, particleTimer);
        btnZone.appendChild(btnRestart);

    } else {
        // 無新勳章：分享是主角
        const btnShare = document.createElement("button");
        btnShare.style.cssText = `
            width:100%;padding:19px;border-radius:50px;border:none;cursor:pointer;
            font-size:1.15rem;font-weight:900;letter-spacing:.5px;
            font-family:"Microsoft JhengHei","PingFang TC",sans-serif;
            ${isPlayer
                ? 'background:linear-gradient(135deg,#ffd060,#ff8c42);color:#3a1800;animation:winSharePulse 2.4s ease-in-out infinite;'
                : 'background:linear-gradient(135deg,#3a7bff,#1a4fcc);color:#fff;animation:winSharePulseB 2.4s ease-in-out infinite;'}
        `;
        btnShare.textContent = "📤 分享這場冒險";
        btnShare.onclick = () => shareGameCard(isPlayer, winner);
        btnZone.appendChild(btnShare);

        // 重新啟航是次要
        const btnRestart = document.createElement("button");
        btnRestart.style.cssText = `
            width:100%;padding:15px;border-radius:50px;cursor:pointer;
            font-size:1rem;font-weight:700;letter-spacing:.3px;
            font-family:"Microsoft JhengHei","PingFang TC",sans-serif;
            border:1.5px solid ${isPlayer?'rgba(255,210,80,.4)':'rgba(100,165,255,.4)'};
            background:${isPlayer?'rgba(255,180,40,.1)':'rgba(60,100,200,.1)'};
            color:${isPlayer?'rgba(255,240,160,.9)':'rgba(158,208,255,.9)'};
        `;
        btnRestart.textContent = "↺ 重新啟航冒險";
        btnRestart.onclick = () => _restartGame(winBgm, gameBgm, particleTimer);
        btnZone.appendChild(btnRestart);
    }

    // 底部文字連結列
    const linkRow = document.createElement("div");
    linkRow.style.cssText = `display:flex;gap:24px;margin-top:4px;`;

    [["📋 出牌紀錄", () => {
        overlay.style.opacity = "0"; overlay.style.pointerEvents = "none";
        openLog();
        const orig = window.closeLog;
        window.closeLog = () => { orig(); overlay.style.transition="opacity .4s ease"; overlay.style.opacity="1"; overlay.style.pointerEvents=""; window.closeLog=orig; };
    }], ["🐠 我的收集", () => { if (typeof openCollection==='function') openCollection(); }]
    ].forEach(([label, fn]) => {
        const link = document.createElement("button");
        link.style.cssText = `
            background:none;border:none;cursor:pointer;padding:4px 0;
            font-size:.88rem;font-weight:600;
            font-family:"Microsoft JhengHei","PingFang TC",sans-serif;
            color:${isPlayer?'rgba(200,255,220,.55)':'rgba(150,200,255,.55)'};
            text-decoration:underline;text-underline-offset:3px;
            text-decoration-color:rgba(255,255,255,.2);
        `;
        link.textContent = label;
        link.onclick = fn;
        linkRow.appendChild(link);
    });
    btnZone.appendChild(linkRow);
    content.appendChild(btnZone);
    overlay.appendChild(content);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => requestAnimationFrame(() => { overlay.style.opacity = "1"; }));
}

// ── 重新啟動遊戲 ──
function _restartGame(winBgm, gameBgm, particleTimer) {
    winBgm.pause();
    if (gameBgm) gameBgm.play().catch(() => {});
    clearInterval(particleTimer);
    window._winShareBtn = null;
    sessionStorage.setItem("sfxEnabled", sfxEnabled ? "true" : "false");
    sessionStorage.setItem("skipIntro", "1");
    location.reload();
}


// =============================================
// 📤 分享勳章成就卡片
// =============================================

const BADGE_META_SHARE = {
    "綠燈先鋒":"🟢","一支釣達人":"🎣","完美永續局":"🏆",
    "紅燈護送員":"🔴","養殖支持者":"🌾","深海傳說":"🐋",
    "浴火重生":"🔄","百發百中":"💯","海紋守護王":"👑",
    "珊瑚守護者":"🪸","漁法通":"🎯","近海英雄":"🌏"
};

async function shareAchievementCard(isPlayer, winner, badgeKey) {
    const icon = BADGE_META_SHARE[badgeKey] || "⭐";
    const diffLabel = gameDifficulty <= 0.4 ? "新手" : gameDifficulty >= 0.9 ? "專業" : "標準";

    const W = 390, H = 693;
    const canvas = document.createElement("canvas");
    canvas.width = W * 2; canvas.height = H * 2;
    const ctx = canvas.getContext("2d");
    ctx.scale(2, 2);

    let bgImg = null;
    try { bgImg = await loadImageAsBlob("image/bge.png"); } catch(_) {}
    ctx.fillStyle = "#020a04";
    ctx.fillRect(0, 0, W, H);

    if (bgImg) {
        const sc = Math.max(W/bgImg.width, H/bgImg.height);
        ctx.save();
        ctx.globalAlpha = .88;
        ctx.drawImage(bgImg, (W-bgImg.width*sc)/2, (H-bgImg.height*sc)/2, bgImg.width*sc, bgImg.height*sc);
        ctx.restore();
    }

    // 深色遮罩
    const grd = ctx.createLinearGradient(0,0,0,H);
    grd.addColorStop(0,   "rgba(3,12,6,.58)");
    grd.addColorStop(.4,  "rgba(1,6,3,.18)");
    grd.addColorStop(1,   "rgba(0,6,2,.9)");
    ctx.fillStyle = grd;
    ctx.fillRect(0,0,W,H);

    // 卡片圓角框
    const cx = W/2, cy = H/2;
    const cw = 320, ch = 320, cr = 28;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx-cw/2+cr, cy-ch/2);
    ctx.lineTo(cx+cw/2-cr, cy-ch/2);
    ctx.arcTo(cx+cw/2, cy-ch/2, cx+cw/2, cy-ch/2+cr, cr);
    ctx.lineTo(cx+cw/2, cy+ch/2-cr);
    ctx.arcTo(cx+cw/2, cy+ch/2, cx+cw/2-cr, cy+ch/2, cr);
    ctx.lineTo(cx-cw/2+cr, cy+ch/2);
    ctx.arcTo(cx-cw/2, cy+ch/2, cx-cw/2, cy+ch/2-cr, cr);
    ctx.lineTo(cx-cw/2, cy-ch/2+cr);
    ctx.arcTo(cx-cw/2, cy-ch/2, cx-cw/2+cr, cy-ch/2, cr);
    ctx.closePath();
    ctx.fillStyle = "rgba(10,8,4,.62)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,215,60,.55)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // 遊戲名
    ctx.font = "600 15px 'PingFang TC','Microsoft JhengHei',sans-serif";
    ctx.fillStyle = "rgba(155,240,185,.6)";
    ctx.letterSpacing = "4px";
    ctx.fillText("海紋守護團", cx, cy - 128);
    ctx.letterSpacing = "0px";

    // 「成就解鎖」
    ctx.font = "500 12px 'PingFang TC','Microsoft JhengHei',sans-serif";
    ctx.fillStyle = "rgba(255,225,100,.72)";
    ctx.letterSpacing = "3px";
    ctx.fillText("✨  新成就解鎖  ✨", cx, cy - 100);
    ctx.letterSpacing = "0px";

    // 大圖示
    ctx.font = "88px serif";
    ctx.fillText(icon, cx, cy - 18);

    // 勳章名
    ctx.font = "900 32px 'PingFang TC','Microsoft JhengHei',sans-serif";
    ctx.shadowColor = "rgba(255,215,60,.65)";
    ctx.shadowBlur = 22;
    ctx.fillStyle = "rgba(255,248,185,.98)";
    ctx.fillText(badgeKey, cx, cy + 88);
    ctx.shadowBlur = 0;

    // 玩家 & 難度
    ctx.font = "500 15px 'PingFang TC','Microsoft JhengHei',sans-serif";
    ctx.fillStyle = "rgba(175,255,210,.7)";
    ctx.fillText(`${winner.n}・${diffLabel}難度`, cx, cy + 128);

    // 版權小字
    ctx.font = "400 14px 'PingFang TC','Microsoft JhengHei',sans-serif";
    ctx.letterSpacing = "1px";
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(200,230,255,.5)";
    ctx.fillText("© 2026 海紋守護團", cx, H - 28);
    ctx.letterSpacing = "0px";

    canvas.toBlob(async (blob) => {
        if (!blob) { alert("卡片產生失敗"); return; }
        const file = new File([blob], `海紋守護團_${badgeKey}.png`, { type:"image/png" });
        const text = `我在《海紋守護團》解鎖了「${badgeKey}」成就！${icon} 你也來挑戰看看 🌊`;
        if (navigator.canShare && navigator.canShare({ files:[file] })) {
            try { await navigator.share({ files:[file], text }); }
            catch(e) { if (e.name !== "AbortError") fallbackDownload(canvas, `海紋守護團_${badgeKey}`); }
        } else {
            fallbackDownload(canvas, `海紋守護團_${badgeKey}`);
        }
    }, "image/png");
}


// =============================================
// 📤 分享遊戲卡片（無新勳章時）
// =============================================

async function shareGameCard(isPlayer, winner) {
    const diffLabel = gameDifficulty <= 0.4 ? "新手" : gameDifficulty >= 0.9 ? "專業" : "標準";
    const rounds = typeof roundCount !== "undefined" ? roundCount : 0;

    const W = 390, H = 693;
    const canvas = document.createElement("canvas");
    canvas.width = W*2; canvas.height = H*2;
    const ctx = canvas.getContext("2d");
    ctx.scale(2, 2);

    let bgImg = null;
    try { bgImg = await loadImageAsBlob("image/bge.png"); } catch(_) {}
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    if (bgImg) {
        const sc = Math.max(W/bgImg.width, H/bgImg.height);
        ctx.save();
        ctx.globalAlpha = isPlayer ? .9 : .6;
        if (!isPlayer) ctx.filter = "hue-rotate(190deg) saturate(.85) brightness(.65)";
        ctx.drawImage(bgImg, (W-bgImg.width*sc)/2, (H-bgImg.height*sc)/2, bgImg.width*sc, bgImg.height*sc);
        ctx.filter = "none";
        ctx.restore();
    }

    const grd = ctx.createLinearGradient(0,0,0,H);
    if (isPlayer) { grd.addColorStop(0,"rgba(2,14,6,.4)"); grd.addColorStop(.45,"rgba(1,8,4,.16)"); grd.addColorStop(1,"rgba(0,10,4,.82)"); }
    else          { grd.addColorStop(0,"rgba(2,6,20,.5)"); grd.addColorStop(.45,"rgba(1,4,14,.22)"); grd.addColorStop(1,"rgba(0,4,18,.86)"); }
    ctx.fillStyle = grd; ctx.fillRect(0,0,W,H);

    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const CX = W/2; let Y = 210;

    ctx.font = "900 40px 'PingFang TC','Microsoft JhengHei',sans-serif";
    ctx.letterSpacing = "4px";
    ctx.shadowColor = isPlayer?"rgba(100,255,160,.5)":"rgba(50,130,255,.45)";
    ctx.shadowBlur = 26;
    ctx.fillStyle = isPlayer?"#fff":"rgba(215,235,255,.96)";
    ctx.fillText("海紋守護團", CX, Y); Y += 38;
    ctx.shadowBlur = 0;
    ctx.font = "500 15px 'PingFang TC','Microsoft JhengHei',sans-serif";
    ctx.letterSpacing = "3px";
    ctx.fillStyle = isPlayer?"rgba(155,240,185,.65)":"rgba(125,175,255,.6)";
    ctx.fillText("台灣海線任務", CX, Y); Y += 52;
    ctx.letterSpacing = "0px"; ctx.shadowBlur = 0;

    if (isPlayer) {
        ctx.font = "700 21px 'PingFang TC','Microsoft JhengHei',sans-serif";
        ctx.fillStyle = "#fff";
        ctx.shadowColor = "rgba(80,255,140,.32)"; ctx.shadowBlur = 14;
        [`${winner.n} 在【${diffLabel}】難度的考驗下`, `與大海交手了 ${rounds} 個回合`, `守護了海洋的平衡`].forEach(l => { ctx.fillText(l, CX, Y); Y += 38; });
        ctx.shadowBlur = 0; Y += 20;
        ctx.font = "500 19px 'PingFang TC','Microsoft JhengHei',sans-serif";
        ctx.fillStyle = "rgba(155,240,185,.8)";
        ctx.fillText("🐟 每一張牌，都是一個選擇", CX, Y);
    } else {
        ctx.font = "900 27px 'PingFang TC','Microsoft JhengHei',sans-serif";
        ctx.fillStyle = "rgba(210,230,255,.95)";
        ctx.shadowColor = "rgba(50,120,255,.35)"; ctx.shadowBlur = 16;
        ctx.fillText("大海這次贏了。", CX, Y); ctx.shadowBlur = 0; Y += 50;
        ctx.font = "500 19px 'PingFang TC','Microsoft JhengHei',sans-serif";
        ctx.fillStyle = "rgba(125,180,255,.65)";
        ctx.fillText("守護員折返，海域等你再來", CX, Y);
    }

    // 版權小字
    ctx.font = "400 14px 'PingFang TC','Microsoft JhengHei',sans-serif";
    ctx.letterSpacing = "1px";
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(200,230,255,.5)";
    ctx.fillText("© 2026 海紋守護團", CX, H - 28);
    ctx.letterSpacing = "0px";

    canvas.toBlob(async (blob) => {
        if (!blob) { alert("卡片產生失敗"); return; }
        const file = new File([blob], "image/海紋守護團.png", {type:"image/png"});
        const text = isPlayer
            ? `${winner.n} 在《海紋守護團》守護了海洋！難度【${diffLabel}】，共 ${rounds} 回合 🎉🌊`
            : `${winner.n} 在《海紋守護團》這次沒守住…下次再來 🌊`;
        if (navigator.canShare && navigator.canShare({ files:[file] })) {
            try { await navigator.share({ files:[file], text }); }
            catch(e) { if (e.name !== "AbortError") fallbackDownload(canvas, "海紋守護團"); }
        } else { fallbackDownload(canvas, "海紋守護團"); }
    }, "image/png");
}

function loadImageAsBlob(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src + "?_=" + Date.now();
    });
}

function fallbackDownload(canvas, name = "海紋守護團") {
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = name + ".png";
    a.click();
}
