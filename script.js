/* ==========================================================================
   ส่วนที่ 1: เชื่อมต่อ Server & ตั้งค่าพื้นฐาน (ห้ามลบ)
   ========================================================================== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// ⚠️ Config Firebase ของคุณ (ตามที่ส่งมา)
const firebaseConfig = {
  apiKey: "AIzaSyDGR3oHvEq9tDQu6hailtyO0Hj1tuMq89I",
  authDomain: "gacha-gg.firebaseapp.com",
  databaseURL: "https://gacha-gg-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "gacha-gg",
  storageBucket: "gacha-gg.firebasestorage.app",
  messagingSenderId: "873455879396",
  appId: "1:873455879396:web:ed5893a7f10356fe8198f1",
  measurementId: "G-21XKJM292C"
};

// เริ่มต้นระบบ
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const gameRef = ref(db, 'systemState'); // ใช้ Node 'systemState' เพื่อเก็บสถานะเกม

// --- ตรวจสอบสิทธิ์ Admin (จาก URL ?admin=true) ---
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('admin') === 'true') {
    localStorage.setItem('wish_admin', 'true');
}
const isAdmin = localStorage.getItem('wish_admin') === 'true';

// --- ⚠️ สำคัญมาก: เปิดฟังก์ชันให้ HTML เรียกใช้ได้ (Expose to Window) ---
window.loadData = loadData;
window.startWish = startWish;
window.nextRound = nextRound;
window.resetGame = resetGame;
window.toggleHistory = toggleHistory;
window.copyToClipboard = copyToClipboard;
window.filterHistory = filterHistory;
window.closeResult = closeResult;
window.forceClearCache = forceClearCache;
window.goToLatestSession = goToLatestSession;

// --- ตัวแปร Global ---
// ปรับแก้ชื่อรางวัลและจำนวนตามต้องการได้ที่นี่
const prizes = [
    { name: "รางวัลที่ 5 (20 บาท)", count: 50, color: "#33CC00" },
    { name: "รางวัลที่ 4 (50 บาท)", count: 30, color: "#99CCFF" },
    { name: "รางวัลที่ 3 (100 บาท)", count: 15, color: "#FF9999" },
    { name: "รางวัลที่ 2 (500 บาท)", count: 5, color: "#CC33FF" },
    { name: "รางวัลที่ 1 (1000 บาท)", count: 3, color: "#FFD700" }
];

let participants = [];
let headers = [];
let currentTier = 0;
let isWarping = false;
let starColor = "#fff";
let winnersHistory = {};

/* ==========================================================================
   ส่วนที่ 2: Listener (ตัวรับคำสั่งจาก Cloud เพื่อเปลี่ยนหน้าจอ)
   ========================================================================== */
onValue(gameRef, (snapshot) => {
    // 1. ปิดหน้า Loading Overlay ทันทีที่เชื่อมต่อ Firebase สำเร็จ
    const loader = document.getElementById('globalLoader');
    if (loader) loader.style.display = 'none';

    const state = snapshot.val();
    const setupContainer = document.getElementById('setupContainer');
    const mainScreen = document.getElementById('mainScreen');
    const audienceStandby = document.getElementById('audienceStandby');

    // 2. ถ้าไม่มีข้อมูล หรือ Admin ยัง Setup ไม่เสร็จ
    if (!state || !state.isSetupDone) {
        if (isAdmin) {
            // Admin: ให้เห็นหน้า Setup ตามปกติ
            if(setupContainer) setupContainer.style.display = 'block';
            if(mainScreen) mainScreen.style.display = 'none';
            if(audienceStandby) audienceStandby.style.display = 'none';
        } else {
            // Audience: ให้เห็นหน้าเรดาร์ (Standby) แทนที่จะเห็นกล่อง URL
            if(setupContainer) setupContainer.style.display = 'none'; // ซ่อน Setup
            if(mainScreen) mainScreen.style.display = 'none';
            if(audienceStandby) audienceStandby.style.display = 'flex'; // โชว์เรดาร์
        }
        return;
    }

    // 3. ถ้า Setup เสร็จแล้ว -> เข้าสู่หน้าเกม
    if(setupContainer) setupContainer.style.display = 'none';
    if(audienceStandby) audienceStandby.style.display = 'none'; // ซ่อนเรดาร์
    if(mainScreen) mainScreen.style.display = 'block';

    // ... (โค้ดอัปเดตตัวแปร participants, headers ฯลฯ ของเดิมต่อจากตรงนี้) ...
    participants = state.participants || [];
    headers = state.headers || [];
    winnersHistory = state.history || {};
    currentTier = state.currentTier || 0;
    
    // ... (ส่วนที่เหลือของฟังก์ชัน onValue เหมือนเดิม) ...
    updateUI();
    refreshAdminUI();

    // Logic Animation (เหมือนเดิม)
    if (state.status === 'WARPING') {
         if (!isWarping) { 
             starColor = state.activeColor || '#fff';
             runWarpEffect(); 
         }
    } else if (state.status === 'SHOW_RESULT') {
        stopWarpEffect();
        if(state.lastRoundWinners) {
            showResults(state.lastRoundWinners, prizes[currentTier]);
        }
    } else if (state.status === 'IDLE') {
         if(document.getElementById('resultScreen').style.display === 'flex') {
             closeResult();
         }
         stopWarpEffect();
    }
});

/* ==========================================================================
   ส่วนที่ 3: Logic การทำงาน (Admin Actions)
   ========================================================================== */

function loadData() {
    if (!isAdmin) return alert("Access Denied: Admin only"); 

    const urlInput = document.getElementById('sheetUrl');
    const url = urlInput.value.trim();
    if(!url) return alert("กรุณาใส่ลิงก์ CSV");

    const btn = document.querySelector('#setupContainer button'); 
    if(btn) { btn.innerText = "กำลังส่งข้อมูล..."; btn.disabled = true; }

    fetch(url)
        .then(response => response.text())
        .then(csv => {
            const lines = csv.split(/\r?\n/).filter(line => line.trim() !== "");
            if (lines.length < 2) { throw new Error("No data found"); }
            
            const newHeaders = lines[0].split(',').map(h => h.trim());
            const newParticipants = lines.slice(1).map(line => {
                const data = line.split(',');
                let obj = {};
                newHeaders.forEach((h, i) => obj[h] = data[i] ? data[i].trim() : "-");
                obj._id = data[0].trim();
                return obj;
            });
            
            const initialHistory = {};
            prizes.forEach(p => initialHistory[p.name] = []);

            // ส่งขึ้น Firebase
            set(gameRef, {
                isSetupDone: true,
                status: 'IDLE',
                headers: newHeaders,
                participants: newParticipants,
                history: initialHistory,
                currentTier: 0,
                activeColor: '#fff',
                timestamp: Date.now()
            });
            
            // ไม่ต้องทำอะไรต่อ onValue จะทำงานเอง
        })
        .catch(err => { 
            console.error(err); 
            alert("Error Loading CSV: " + err.message); 
            if(btn) { btn.innerText = "Load Data"; btn.disabled = false; }
        });
}

function startWish() {
    if(!isAdmin) return; 
    
    if (currentTier >= prizes.length) return alert("แจกครบทุกรางวัลแล้ว!");
    const currentPrizeName = prizes[currentTier].name;
    
    // เช็คว่าเคยแจกไปหรือยัง
    if (winnersHistory[currentPrizeName] && winnersHistory[currentPrizeName].length > 0) {
        if(!confirm(`รางวัล "${currentPrizeName}" มีการแจกไปแล้ว ต้องการแจกซ้ำหรือไม่?`)) return;
    }
    
    if(participants.length === 0) return alert("รายชื่อหมดแล้ว!");
    
    const tier = prizes[currentTier];

    // 1. สั่ง Warping
    update(gameRef, {
        status: 'WARPING',
        activeColor: tier.color
    });

    // 2. รอ Animation 2.5 วินาที แล้วค่อยสุ่ม
    setTimeout(() => {
        performRaffle();
    }, 2500);
}

function performRaffle() {
    const tier = prizes[currentTier];
    const drawCount = Math.min(tier.count, participants.length);
    
    // Fisher-Yates Shuffle (สุ่ม)
    for (let i = participants.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [participants[i], participants[j]] = [participants[j], participants[i]];
    }
    
    const winners = participants.slice(0, drawCount);
    const remaining = participants.slice(drawCount);
    
    let newHistory = { ...winnersHistory };
    if (!newHistory[tier.name]) newHistory[tier.name] = [];
    newHistory[tier.name].push(...winners);

    // อัปเดตผลผู้ชนะและส่งขึ้น Cloud
    update(gameRef, {
        status: 'SHOW_RESULT',
        lastRoundWinners: winners,
        participants: remaining,
        history: newHistory
    });

    // บันทึกลง Sheet (ถ้ามี Script)
    saveToSheet(winners, tier.name);
}

function nextRound() {
    if (!isAdmin) return;
    
    // ปิดหน้าผลรางวัล
    document.getElementById('resultScreen').style.display = 'none';

    // ส่งคำสั่งเปลี่ยน Tier ขึ้น Firebase
    // ระบบจะเปลี่ยนหน้าจอ User กลับไปหน้าสุ่มให้อัตโนมัติเพราะ onValue ทำงานอยู่
    update(gameRef, {
        status: 'IDLE',
        currentTier: currentTier + 1,
        activeColor: '#fff' 
    });
}

function resetGame() {
    if(!isAdmin) return;
    
    if(confirm("⚠️ ยืนยันการล้างระบบ?\n- ข้อมูลรายชื่อจะหายไป\n- ประวัติผู้ชนะจะหายไป")) {
        set(gameRef, null).then(() => {
            alert("✅ ล้างระบบเรียบร้อย!");
            location.reload();
        });
    }
}

/* ==========================================================================
   ส่วนที่ 4: UI & Animation Helpers
   ========================================================================== */

function updateUI() {
    const banner = document.getElementById('bannerDisplay');
    const poolCount = document.getElementById('poolCount');
    
    if(!banner || !poolCount) return;

    if (currentTier >= prizes.length) {
        banner.innerHTML = `<h1 class="gold-text" style="font-size:40px;">🎉 จบกิจกรรม! 🎉</h1>`;
        poolCount.innerText = "ขอบคุณผู้ร่วมสนุกทุกท่าน";
        return;
    }
    
    const tier = prizes[currentTier];
    banner.innerHTML = `
        <h1 style="color:${tier.color}; font-size: clamp(30px, 6vw, 60px); margin:0; text-shadow: 0 0 20px currentColor;">${tier.name}</h1>
        <p style="font-size: 20px; color:#ddd;">แจกรางวัลละ: ${tier.count} ท่าน</p>
    `;
    poolCount.innerText = `คงเหลือผู้ลุ้นรางวัล: ${participants.length} คน`;
}

function refreshAdminUI() {
    const btnStart = document.getElementById('btnStart');
    const msgWaiting = document.getElementById('msgWaiting');
    const btnReset = document.getElementById('btnResetSystem');
    const btnGoToCurrent = document.getElementById('btnGoToCurrent');
    const btnHistory = document.querySelector('.btn-history-toggle');

    if (isAdmin) {
        if(btnStart) btnStart.style.display = 'inline-block';
        if(msgWaiting) msgWaiting.style.display = 'none';
        if(btnReset) btnReset.style.display = 'block';
        if(btnGoToCurrent) btnGoToCurrent.style.display = 'inline-block';
        if(btnHistory) btnHistory.style.display = 'block';
    } else {
        if(btnStart) btnStart.style.display = 'none';
        if(msgWaiting) msgWaiting.style.display = 'flex';
        if(btnReset) btnReset.style.display = 'none';
        if(btnGoToCurrent) btnGoToCurrent.style.display = 'none';
    }
}

function runWarpEffect() {
    isWarping = true;
    const meteor = document.getElementById('meteor');
    const flash = document.getElementById('flashOverlay');
    const container = document.querySelector('.container');
    const controls = document.querySelectorAll('.btn-wish, .btn-history-toggle, .btn-reset-system');

    if(container) container.classList.add('suck-in-animation');
    controls.forEach(el => el.classList.add('suck-in-animation'));

    setTimeout(() => {
        if(container) container.style.opacity = 0;
        controls.forEach(el => el.style.display = 'none');
    }, 700);

    if(meteor) { 
        meteor.style.color = starColor; 
        meteor.classList.add('meteor-falling'); 
    }
    if(flash) { 
        flash.style.background = starColor; 
        setTimeout(() => { flash.style.opacity = 1; }, 1500); 
    }
}

function stopWarpEffect() {
    isWarping = false;
    const meteor = document.getElementById('meteor');
    const flash = document.getElementById('flashOverlay');
    if(meteor) meteor.classList.remove('meteor-falling');
    if(flash) { flash.style.opacity = 0; }
}

function showResults(winners, tier) {
    const grid = document.getElementById('resultGrid');
    const title = document.getElementById('resultTitle');

    title.innerText = tier.name;
    title.style.color = tier.color;
    
    grid.innerHTML = "";
    winners.forEach((winner, index) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.style.borderColor = tier.color;
        card.style.animationDelay = `${index * 0.1}s`;

        const headerDiv = document.createElement('div');
        headerDiv.className = 'card-header';
        headerDiv.style.background = tier.color;
        headerDiv.textContent = winner[headers[0]] || "ID"; // ใช้คอลัมน์แรกเป็นหัว
        card.appendChild(headerDiv);

        const bodyDiv = document.createElement('div');
        bodyDiv.className = 'card-body';
        
        const mainInfo = document.createElement('div');
        mainInfo.className = 'info-main';
        mainInfo.style.color = tier.color;
        mainInfo.textContent = winner[headers[1]] || ""; // ใช้คอลัมน์สองเป็นชื่อหลัก
        bodyDiv.appendChild(mainInfo);

        // แสดงข้อมูลที่เหลือ
        for(let k=2; k < headers.length; k++) {
            const val = winner[headers[k]];
            if(val && val !== "-") {
                const subInfo = document.createElement('div');
                subInfo.className = 'info-sub';
                subInfo.textContent = `${headers[k]}: ${val}`;
                bodyDiv.appendChild(subInfo);
            }
        }
        card.appendChild(bodyDiv);
        grid.appendChild(card);    
    });

    document.getElementById('resultScreen').style.display = 'flex';
    const btnNext = document.getElementById('btnNextPrize'); // เรียกหาปุ่มจาก ID ที่เราเพิ่งตั้ง
    
    if (btnNext) {
        // ถ้าเป็น Admin และ "ไม่ใช่" รางวัลสุดท้าย -> ให้โชว์ปุ่ม
        // (prizes.length - 1 คือ index ของรางวัลสุดท้าย)
        if (isAdmin && currentTier < prizes.length - 1) {
            btnNext.style.display = 'inline-block';
        } else {
            // ถ้าเป็น User หรือ แจกครบแล้ว -> ซ่อนปุ่ม
            btnNext.style.display = 'none';
        }
    }
}

function closeResult() {
    document.getElementById('resultScreen').style.display = 'none';
    goToLatestSession(); 
}

function goToLatestSession() {
    // ล้าง Animation กลับสู่สภาพปกติ
    const suckedElements = document.querySelectorAll('.suck-in-animation');
    suckedElements.forEach(el => {
        el.classList.remove('suck-in-animation');
        el.style.opacity = 1;
        el.style.transform = '';
        el.style.filter = '';
    });

    document.getElementById('resultScreen').style.display = 'none';
    const container = document.getElementById('mainScreen');
    if(container) {
        container.style.display = 'block';
        container.style.opacity = 1;
    }
    refreshAdminUI();
}

/* ==========================================================================
   ส่วนที่ 5: History & Background
   ========================================================================== */
function toggleHistory() {
    const modal = document.getElementById('historyModal');
    const list = document.getElementById('historyList');

    if (modal.style.display === 'flex') {
        modal.style.display = 'none';
    } else {
        // สร้าง Tab History
        const activePrizes = prizes.filter(p => winnersHistory[p.name] && winnersHistory[p.name].length > 0);
        if (activePrizes.length === 0) {
            list.innerHTML = `<p style="text-align:center; color:#888; margin-top:50px;">ยังไม่มีการจับรางวัล</p>`;
        } else {
            let tabsHtml = `<div class="history-tabs" id="tabsContainer">`;
            let contentHtml = `<div class="history-content-wrapper">`;

            activePrizes.forEach((prize, index) => {
                const isActive = index === 0 ? 'active' : '';
                const winners = winnersHistory[prize.name];
                tabsHtml += `<button class="tab-btn ${isActive}" onclick="switchTab(event, 'tab-${index}')">${prize.name} <span>(${winners.length})</span></button>`;
                contentHtml += `
                    <div id="tab-${index}" class="tab-content ${isActive}">
                        <div style="text-align:right; margin-bottom:10px; padding:0 20px;">
                            <button onclick="copyToClipboard('${prize.name}')" style="background:#4a90e2; color:white; border:none; padding:5px 15px; border-radius:5px; cursor:pointer;">📋 Copy รายชื่อ</button>
                        </div>
                `;
                winners.forEach(w => {
                    const name = w[headers[1]] || "ไม่ระบุชื่อ";
                    const info = w[headers[2]] || "-"; 
                    contentHtml += `<div class="history-item searchable-item">${name} <span>${info}</span></div>`;
                });
                contentHtml += `</div>`;
            });
            tabsHtml += `</div>`;
            contentHtml += `</div>`;
            
            // Search Box
            const searchHtml = `
                <div style="padding: 10px 20px; text-align: center;">
                    <input type="text" id="historySearchInput" onkeyup="filterHistory()" placeholder="🔍 พิมพ์ชื่อเพื่อค้นหา..." 
                    style="width: 100%; max-width: 400px; padding: 10px; border-radius: 20px; border: 1px solid #555; background: #222; color: #fff; text-align: center;">
                </div>
            `;
            list.innerHTML = tabsHtml + searchHtml + contentHtml;
        }
        modal.style.display = 'flex';
    }
}

// ฟังก์ชันสลับ Tab (ต้อง attach window)
window.switchTab = function(event, tabId) {                                             
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    event.currentTarget.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    const target = document.getElementById(tabId);
    if(target) target.classList.add('active');
};

function copyToClipboard(rankName) {
    const winners = winnersHistory[rankName];
    if (!winners || winners.length === 0) return;
    let text = "ID\tName\tInfo\n";
    winners.forEach(w => {
        text += `${w[headers[0]]}\t${w[headers[1]]}\t${w[headers[2]] || ""}\n`;
    });
    navigator.clipboard.writeText(text).then(() => alert("คัดลอกแล้ว!"));
}

function filterHistory() {
    const input = document.getElementById('historySearchInput');
    const filter = input.value.toLowerCase();
    const activeTab = document.querySelector('.tab-content.active');
    if (!activeTab) return;
    const items = activeTab.getElementsByClassName('searchable-item');
    for (let i = 0; i < items.length; i++) {
        const text = items[i].textContent;
        items[i].style.display = (text.toLowerCase().indexOf(filter) > -1) ? "flex" : "none";
    }
}

function forceClearCache() {
    localStorage.clear();
    location.reload();
}

// --- Google Sheet Logging (Optional) ---
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby_BJhSpOljb4B0rgocuzrV-ehaiL9Tq5yCWkJcAFiL85cGYUTGb5RF7jvczH99B7Ie0g/exec"; 
function saveToSheet(winners, rankName) {
    if(!isAdmin) return; 
    const dataToSend = {
        rank: rankName,
        winners: winners.map(w => ({
            id: w[headers[0]] || "-", 
            name: w[headers[1]] || "-",
            dept: w[headers[2]] || "-" 
        }))
    };
    fetch(GOOGLE_SCRIPT_URL, {
        method: "POST", mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSend)
    }).catch(err => console.error("Sheet Error:", err));
}

// --- Background Star Animation ---
const canvas = document.getElementById('starCanvas');
if (canvas) {
    const ctx = canvas.getContext('2d');
    let w, h, stars = [];
    const resize = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; };
    window.addEventListener('resize', resize); resize();

    class Star {
        constructor() { this.reset(); }
        reset() { 
            this.x = (Math.random() - 0.5) * w * 2; 
            this.y = (Math.random() - 0.5) * h * 2; 
            this.z = Math.random() * w; 
            this.pz = this.z; 
        }
        update() { 
            this.z -= isWarping ? 80 : 2; 
            if (this.z < 1) { this.reset(); this.z = w; this.pz = this.z; } 
        }
        draw() {
            let sx = (this.x / this.z) * w + w / 2; let sy = (this.y / this.z) * h + h / 2;
            let px = (this.x / this.pz) * w + w / 2; let py = (this.y / this.pz) * h + h / 2;
            this.pz = this.z;
            let r = (1 - this.z / w) * 3;
            ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(sx, sy);
            ctx.strokeStyle = isWarping ? starColor : "rgba(255,255,255,0.4)";
            ctx.lineWidth = isWarping ? r : r / 2; ctx.stroke();
        }
    }
    for(let i=0; i<800; i++) stars.push(new Star());
    
    function animate() {
        ctx.fillStyle = "#0c0c10"; ctx.fillRect(0, 0, w, h);
        stars.forEach(s => { s.update(); s.draw(); });
        requestAnimationFrame(animate);
    }
    animate();
}

// ฟังก์ชันปรับหน้าจอตามสถานะ (Admin หรือ คนดู)
function updateUIState(isAdmin) {
    const startBtnContainer = document.getElementById('startBtnContainer');
    const adminPanel = document.getElementById('adminPanel'); // กลุ่มปุ่ม Re-Sync & Reset
    const msgWaiting = document.getElementById('msgWaiting');

    if (isAdmin) {
        // --- ถ้าเป็น ADMIN ---
        // 1. โชว์ปุ่ม Start
        if (startBtnContainer) startBtnContainer.style.display = 'flex';
        // 2. โชว์ปุ่มควบคุม (Reset/Re-Sync)
        if (adminPanel) adminPanel.style.display = 'flex';
        // 3. ซ่อนข้อความ Waiting
        if (msgWaiting) msgWaiting.style.display = 'none';
        
    } else {
        // --- ถ้าเป็น AUDIENCE (คนดู) ---
        // 1. ซ่อนปุ่ม Start
        if (startBtnContainer) startBtnContainer.style.display = 'none';
        // 2. ซ่อนปุ่มควบคุมทั้งหมด
        if (adminPanel) adminPanel.style.display = 'none';
        // 3. โชว์ข้อความ Waiting พร้อมตัวหมุนๆ
        if (msgWaiting) {
            msgWaiting.style.display = 'flex'; 
            // msgWaiting จะแสดงผลเป็น Flex เพื่อจัดตัวหมุนให้อยู่กึ่งกลางกับข้อความ
        }
    }
}


