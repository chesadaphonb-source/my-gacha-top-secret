/* ==========================================================================
   ส่วนที่ 1: การตั้งค่าและการเชื่อมต่อ (Modified for Safety)
   ========================================================================== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// ⚠️ Config Firebase ของคุณ
const firebaseConfig = {
  apiKey: "AIzaSyAKE2HbyCt-CTjpasigrkaOlGGSwH5DlBM",
  authDomain: "server-random.firebaseapp.com",
  databaseURL: "https://server-random-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "server-random",
  storageBucket: "server-random.firebasestorage.app",
  messagingSenderId: "692801108531",
  appId: "1:692801108531:web:89d571d87f5d74df9c0146",
  measurementId: "G-EME97K8JDN"
};

// --- ตรวจสอบสิทธิ์ (Admin Check) ตั้งแต่บรรทัดแรก ---
const urlParams = new URLSearchParams(window.location.search);
const isAdmin = urlParams.get('admin') === 'true';

// ตัวแปร Global
let app, db, gameRef;
let participants = [];
let headers = [];
let currentTier = 0;
let isWarping = false;
let starColor = "#fff";
let winnersHistory = {};

// ตั้งค่าของรางวัล (แก้ไขตรงนี้ได้)
const prizes = [
    { name: "รางวัลที่ พิเศษ (อักษร Q)", count: 1, color: "#FFD700" }
];

/* ==========================================================================
   ส่วนที่ 2: Logic การเชื่อมต่อ (แยก Admin / Viewer)
   ========================================================================== */

if (isAdmin) {
    // ✅ ADMIN MODE: เชื่อมต่อ Firebase เต็มรูปแบบ
    console.log("🔒 Admin Mode: Connecting to Firebase...");
    
    app = initializeApp(firebaseConfig);
    db = getDatabase(app);
    gameRef = ref(db, 'gacha_room_v1');

    // Listener รับค่าจาก Server
    onValue(gameRef, (snapshot) => {
        const data = snapshot.val();
        const setupBox = document.getElementById('setupContainer');
        const mainScreen = document.getElementById('mainScreen');
        const btnStart = document.getElementById('btnStart');

        // กรณี: ยังไม่มีข้อมูล
        if (!data) {
            setupBox.style.display = 'block';
            mainScreen.style.display = 'none';
            return;
        }

        // อัปเดตข้อมูล
        headers = data.headers || [];
        participants = data.participants || [];
        winnersHistory = data.history || {};
        currentTier = data.currentTier || 0;

        // กรณี: ยังไม่ Load Data
        if (!participants || participants.length === 0) {
            setupBox.style.display = 'block';
            mainScreen.style.display = 'none';
            return;
        }

        // กรณี: พร้อมเล่น
        if (data.isSetupDone) {
            setupBox.style.display = 'none';
            mainScreen.style.display = 'block';
            if(btnStart) btnStart.style.display = 'inline-block';
            updateUI();
        }

        // Handle Status
        if (data.status === 'WARPING') {
             if (!isWarping) { 
                 starColor = data.activeColor;
                 runWarpEffect();
             }
        } else if (data.status === 'SHOW_RESULT') {
            stopWarpEffect();
            const tier = prizes[currentTier];
            if(data.lastRoundWinners) {
                showResults(data.lastRoundWinners, tier);
            }
        } else if (data.status === 'IDLE') {
             closeResult(); 
             stopWarpEffect();
        }
    });

} else {
    // 🛑 VIEWER MODE: ไม่ต่อ Firebase เลย (Safe Mode)
    console.log("👤 Viewer Mode: Connection Disabled to save bandwidth.");
    
    // บังคับแสดงหน้า Waiting ทันทีเมื่อโหลดเสร็จ
    window.addEventListener('load', () => {
        const setupBox = document.getElementById('setupContainer');
        const mainScreen = document.getElementById('mainScreen');
        const msgWaiting = document.getElementById('msgWaiting');
        const btnStart = document.getElementById('btnStart');
        const controlBar = document.querySelector('.control-bar');
        const btnReset = document.getElementById('btnResetSystem');

        if(setupBox) setupBox.style.display = 'none';
        if(mainScreen) mainScreen.style.display = 'block';
        
        // จัดการ UI คนดู
        document.getElementById('bannerDisplay').innerHTML = `
            <h1 style="color:#FFD700; font-size: 50px; text-shadow: 0 0 10px #FFD700;">✨ Wish System ✨</h1>
            <p style="color:#aaa; font-size: 18px;">ระบบพร้อมใช้งาน</p>
        `;
        document.getElementById('poolCount').innerText = "";
        
        if(msgWaiting) {
            msgWaiting.style.display = 'flex';
            msgWaiting.innerHTML = `
                <div class="spinner"></div>
                <h3>Waiting...</h3>
                <p>กรุณาลุ้นผลรางวัลที่ <b>"จอหลัก"</b></p>
            `;
        }
        
        // ซ่อนปุ่มควบคุมทั้งหมด
        if(btnStart) btnStart.style.display = 'none';
        if(controlBar) controlBar.style.display = 'none';
        if(btnReset) btnReset.style.display = 'none';
    });
}

/* ==========================================================================
   ส่วนที่ 3: Expose Functions & Logic (เฉพาะ Admin ถึงกดได้)
   ========================================================================== */

// Expose ให้ HTML เรียกใช้ได้
window.loadData = loadData;
window.startWish = startWish;
window.nextRound = nextRound;
window.resetGame = resetGame;
window.toggleHistory = toggleHistory;
window.copyToClipboard = copyToClipboard;
window.filterHistory = filterHistory;
window.closeResult = closeResult;
window.forceClearCache = forceClearCache;

function loadData() {
    if (!isAdmin) return; 
    const urlInput = document.getElementById('sheetUrl');
    const url = urlInput.value.trim();
    if(!url) return alert("กรุณาใส่ลิงก์ CSV");

    const btn = document.querySelector('#setupContainer button');
    if(btn) { btn.innerText = "กำลังส่งข้อมูล..."; btn.disabled = true; }

    fetch(url)
        .then(response => response.text())
        .then(csv => {
            const lines = csv.split(/\r?\n/).filter(line => line.trim() !== "");
            if (lines.length < 2) { alert("Data Error"); if(btn) btn.disabled=false; return; }
            
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

            set(gameRef, {
                isSetupDone: true,
                status: 'IDLE',
                headers: newHeaders,
                participants: newParticipants,
                history: initialHistory,
                currentTier: 0,
                activeColor: '#fff',
                lastRoundWinners: []
            });
        })
        .catch(err => { console.error(err); alert("Link Error"); if(btn) btn.disabled=false; });
}

function startWish() {
    if(!isAdmin) return; 
   
    const currentPrizeName = prizes[currentTier].name;
    if (winnersHistory[currentPrizeName] && winnersHistory[currentPrizeName].length > 0) {
        alert("⛔ รางวัลรอบนี้สุ่มไปแล้วครับ!");
        return;
    }
    if(participants.length === 0) return alert("รายชื่อหมดแล้ว!");
    
    const tier = prizes[currentTier];

    update(gameRef, {
        status: 'WARPING',
        activeColor: tier.color
    });

    setTimeout(() => {
        performRaffle();
    }, 2000);
}

function performRaffle() {
    if(!isAdmin) return;

    const tier = prizes[currentTier];
    if (!tier) return alert("ไม่พบข้อมูลรางวัล");

    const drawCount = Math.min(tier.count, participants.length);
    
    // Fisher-Yates Shuffle
    for (let i = participants.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [participants[i], participants[j]] = [participants[j], participants[i]];
    }
    
    const winners = participants.slice(0, drawCount);
    const remainingParticipants = participants.slice(drawCount);
    
    let newHistory = { ...winnersHistory };
    
    if (!newHistory[tier.name]) {
        newHistory[tier.name] = [];
    }
    newHistory[tier.name].push(...winners);

    update(gameRef, {
        status: 'SHOW_RESULT',
        lastRoundWinners: winners,
        participants: remainingParticipants,
        history: newHistory
    });

    saveToSheet(winners, tier.name);
}

function nextRound() { 
    if(!isAdmin) return;
    update(gameRef, {
        status: 'IDLE',
        currentTier: currentTier + 1
    });
}

function resetGame() {
    if(!isAdmin) return;
    if(confirm("⚠️ ยืนยันที่จะล้างค่าทั้งหมดหรือไม่?")) {
        set(gameRef, null).then(() => {
            alert("✅ ล้างระบบเรียบร้อย!");
            location.reload();
        });
    }
}

/* --- UI Helpers --- */
function updateUI() {
    const mainScreen = document.getElementById('mainScreen');
    if (currentTier >= prizes.length) {
        mainScreen.innerHTML = `
            <h1 class="gold-text" style="font-size:40px;">🎉 จบกิจกรรม! 🎉</h1>
            <button class="btn-wish" onclick="toggleHistory()">📜 ดูสรุปรายชื่อ</button>
            ${isAdmin ? '<br><br><button class="btn-wish" onclick="resetGame()">↺ Reset System</button>' : ''}
        `;
        return;
    }
    const tier = prizes[currentTier];
    document.getElementById('bannerDisplay').innerHTML = `
        <h1 style="color:${tier.color}; font-size: clamp(30px, 6vw, 60px); margin:0; text-shadow: 0 0 20px currentColor;">${tier.name}</h1>
        <p style="font-size: 20px; color:#ddd;">จำนวนรางวัล: ${tier.count}</p>
    `;
    document.getElementById('poolCount').innerText = `คงเหลือผู้ลุ้นรางวัล: ${participants.length} คน`;
}

function runWarpEffect() {
    const meteor = document.getElementById('meteor');
    const flash = document.getElementById('flashOverlay');
    isWarping = true;
    document.querySelector('.container').style.opacity = 0;
    
    // ซ่อนปุ่มต่างๆ ตอนวาร์ป
    const buttonsToHide = ['.btn-history-toggle', '#btnUpdate', '#btnResetSystem'];
    buttonsToHide.forEach(sel => {
        const el = document.querySelector(sel);
        if(el) el.style.display = 'none';
    });

    if(meteor) { meteor.style.color = starColor; meteor.classList.add('meteor-falling'); }
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
    if(flash) { flash.style.opacity = 0; flash.style.background = "white"; }
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
        
        const headerDiv = document.createElement('div');
        headerDiv.className = 'card-header';
        headerDiv.style.background = tier.color;
        headerDiv.textContent = winner[headers[0]];
        card.appendChild(headerDiv);

        const bodyDiv = document.createElement('div');
        bodyDiv.className = 'card-body';
        
        const mainInfo = document.createElement('div');
        mainInfo.className = 'info-main';
        mainInfo.style.color = tier.color;
        mainInfo.textContent = winner[headers[1]] || "";
        bodyDiv.appendChild(mainInfo);
        
        // ข้อมูลเพิ่มเติม (แผนก ฯลฯ)
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
}

function closeResult() {
    document.getElementById('resultScreen').style.display = 'none';
    document.querySelector('.container').style.opacity = 1;
    
    // คืนค่าปุ่มต่างๆ
    if(document.querySelector('.btn-history-toggle'))
        document.querySelector('.btn-history-toggle').style.display = 'block';
    const btnUpdate = document.getElementById('btnUpdate');
    if(btnUpdate) btnUpdate.style.display = 'block';
    const btnReset = document.getElementById('btnResetSystem');
    if(btnReset && isAdmin) btnReset.style.display = 'block';
}

/* --- History & Utilities --- */
function toggleHistory() {
    const modal = document.getElementById('historyModal');
    const list = document.getElementById('historyList');

    if (modal.style.display === 'flex') {
        modal.style.display = 'none';
    } else {
        // (Logic History แบบเดิมของคุณ ใส่มาให้ครบแล้วครับ)
        const activePrizes = prizes.filter(p => winnersHistory[p.name] && winnersHistory[p.name].length > 0);
        if (activePrizes.length === 0) {
            list.innerHTML = `<p style="text-align:center; color:#888; margin-top:50px;">ยังไม่มีการจับรางวัล</p>`;
        } else {
            // ... (Logic สร้าง Tab History เหมือนเดิม) ...
            let tabsHtml = `<div class="history-tabs" id="tabsContainer">`;
            let contentHtml = `<div class="history-content-wrapper">`;
            
            activePrizes.forEach((prize, index) => {
               const isActive = index === 0 ? 'active' : '';
               const winners = winnersHistory[prize.name];
               tabsHtml += `<button class="tab-btn ${isActive}" onclick="switchTab(event, 'tab-${index}')">${prize.name}</button>`;
               contentHtml += `<div id="tab-${index}" class="tab-content ${isActive}">`;
               contentHtml += `<div style="text-align:right; margin-bottom:10px;"><button onclick="copyToClipboard('${prize.name}')">📋 Copy</button></div>`;
               winners.forEach(w => {
                   const name = w[headers[1]] || "ไม่ระบุชื่อ";
                   const dept = w[headers[2]] || "-"; 
                   contentHtml += `<div class="history-item searchable-item">${name} <span>${dept}</span></div>`;
               });
               contentHtml += `</div>`;
            });
            tabsHtml += `</div>`;
            contentHtml += `</div>`;
            list.innerHTML = tabsHtml + contentHtml;
        }
        modal.style.display = 'flex';
    }
}

window.switchTab = function(event, tabId) {                                           
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    event.currentTarget.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    const target = document.getElementById(tabId);
    if(target) target.classList.add('active');
}

function copyToClipboard(rankName) {
    // ... logic copy เดิม ...
    const winners = winnersHistory[rankName];
    if (!winners) return;
    let text = "";
    winners.forEach(w => text += `${w[headers[0]]}\t${w[headers[1]]}\n`);
    navigator.clipboard.writeText(text).then(() => alert("Copied!"));
}

function filterHistory() { /* ... logic filter เดิม ... */ }

function forceClearCache() {
    if(!confirm("Update System?")) return;
    localStorage.clear();
    sessionStorage.clear();
    const url = new URL(window.location.href);
    url.searchParams.set('v', Date.now()); 
    window.location.href = url.toString();
}

// Google Script URL
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
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSend)
    }).catch(err => console.error(err));
}

/* --- Background Animation (เก็บไว้เพราะสวยดี และไม่กินเน็ต) --- */
const canvas = document.getElementById('starCanvas');
const ctx = canvas.getContext('2d');
let w, h, stars = [], planets = [];

function resize() { 
    w = canvas.width = window.innerWidth; 
    h = canvas.height = window.innerHeight; 
}
window.addEventListener('resize', resize); 
resize();

// ... (Class Star และ Planet เหมือนเดิมเป๊ะ ไม่ต้องแก้) ...
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
        if (this.z < 1) { 
            this.reset(); 
            this.z = w; 
            this.pz = this.z; 
        } 
    }
    draw() {
        let sx = (this.x / this.z) * w + w / 2; 
        let sy = (this.y / this.z) * h + h / 2;
        let px = (this.x / this.pz) * w + w / 2; 
        let py = (this.y / this.pz) * h + h / 2;
        this.pz = this.z; 
        let r = (1 - this.z / w) * 3;
        ctx.beginPath(); 
        ctx.moveTo(px, py); 
        ctx.lineTo(sx, sy);
        ctx.strokeStyle = isWarping ? starColor : "rgba(255,255,255,0.4)";
        ctx.lineWidth = isWarping ? r : r / 2; 
        ctx.stroke();
    }
}
// สร้างดาว
stars = [];
for(let i=0; i<3000; i++) stars.push(new Star());

function animate() {
    ctx.fillStyle = "#0c0c10"; 
    ctx.fillRect(0, 0, w, h);
    stars.forEach(s => { s.update(); s.draw(); });
    requestAnimationFrame(animate);
}
// เริ่ม Animation ทันที
animate();
