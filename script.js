/* ==========================================================================
   ส่วนที่ 1: เชื่อมต่อ server และตั้งค่าตัวแปร (Global)
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

// เริ่มต้นระบบ
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const gameRef = ref(db, 'gacha_room_v1');

// --- 6. Expose Functions to Window (สำคัญมาก! เพื่อให้ปุ่ม HTML กดติด) ---
window.loadData = loadData;
window.startWish = startWish;
window.nextRound = nextRound;
window.resetGame = resetGame;
window.toggleHistory = toggleHistory;
window.copyToClipboard = copyToClipboard;
window.filterHistory = filterHistory;
window.closeResult = closeResult;
window.forceClearCache = forceClearCache; // เพิ่มตัวนี้ให้ด้วยครับ

// --- Configuration & Global Variables ---
const prizes = [
    { name: "รางวัลที่ 6 (200 บาท)", count: 32, color: "#33CC00" },
    { name: "รางวัลที่ 5 (300 บาท)", count: 16, color: "#33CC00" },
    { name: "รางวัลที่ 4 (400 บาท)", count: 13, color: "#99CCFF" },
    { name: "รางวัลที่ 3 (500 บาท)", count: 13, color: "#FF9999" },
    { name: "รางวัลที่ 2 (1000 บาท)", count: 4, color: "#CC33FF" },
    { name: "รางวัลที่ 1 (2000 บาท)", count: 1, color: "#FFD700" }
];

let participants = [];
let headers = [];
let currentTier = 0;
let isWarping = false;
let starColor = "#fff";
let winnersHistory = {};

// เช็ค Admin
const urlParams = new URLSearchParams(window.location.search);
const isAdmin = urlParams.get('admin') === 'true';

/* ==========================================================================
   ส่วนที่ 2: Listener (ตัวรับคำสั่งจาก Cloud)
   ========================================================================== */
onValue(gameRef, (snapshot) => {
    const data = snapshot.val();
    if (data) {
        // อัปเดตข้อมูลพื้นฐาน
        headers = data.headers || [];
        participants = data.participants || [];
        winnersHistory = data.history || {};
        currentTier = data.currentTier || 0;

        // ถ้าไม่มีคน (คือยังไม่ได้ Load Data) ให้แสดงหน้า Setup
        if (!participants || participants.length === 0) {
             document.getElementById('setupContainer').style.display = 'block';
             document.getElementById('mainScreen').style.display = 'none';
             return; 
        }

        // ถ้าตั้งค่าเสร็จแล้ว ให้เปลี่ยนหน้า
        if (data.isSetupDone) {
            document.getElementById('setupContainer').style.display = 'none';
            document.getElementById('mainScreen').style.display = 'block';
            updateUI();
        }

        // --- ควบคุม Animation ตามสถานะ Server ---
        if (data.status === 'WARPING') {
             if (!isWarping) { 
                 starColor = data.activeColor;
                 runWarpEffect(); // เรียกฟังก์ชันวาร์ป
             }
        } else if (data.status === 'SHOW_RESULT') {
            stopWarpEffect(); // หยุดวาร์ป
            const tier = prizes[currentTier];
            if(data.lastRoundWinners) {
                showResults(data.lastRoundWinners, tier);
            }
        } else if (data.status === 'IDLE') {
             closeResult(); 
             stopWarpEffect();
        }
    }
});

/* ==========================================================================
   ส่วนที่ 3: Logic การทำงาน (Admin สั่งงาน)
   ========================================================================== */

// 1. Load Data
function loadData() {
    if (!isAdmin) return; 

    const urlInput = document.getElementById('sheetUrl');
    if(!urlInput) return;
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

// 2. กดปุ่มสุ่ม
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

// 3. คำนวณผู้ชนะ
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

// 4. ไปรอบถัดไป
function nextRound() { 
    if(!isAdmin) return;
    update(gameRef, {
        status: 'IDLE',
        currentTier: currentTier + 1
    });
}

// 5. Reset Game (แก้ไข: ให้มีการแจ้งเตือนชัดเจน)
function resetGame() {
    if(!isAdmin) return;
    
    if(confirm("⚠️ คำเตือนสำคัญ!\n\nนี่คือการล้างข้อมูล 'ทั้งหมด' ในระบบ\n- รายชื่อผู้โชคดีจะหายไป\n- ประวัติการจับรางวัลจะหายไป\n\nยืนยันที่จะล้างค่าหรือไม่?")) {
        set(gameRef, null).then(() => {
            alert("✅ ล้างระบบเรียบร้อย!");
            location.reload();
        });
    }
}

/* --- UI Helper Functions --- */
function updateUI() {
    const mainScreen = document.getElementById('mainScreen');
    if (currentTier >= prizes.length) {
        mainScreen.innerHTML = `
            <h1 class="gold-text" style="font-size:40px;">🎉 จบกิจกรรม! 🎉</h1>
            <p>ขอบคุณผู้ร่วมสนุกทุกท่าน</p>
            <button class="btn-wish" onclick="toggleHistory()">📜 ดูสรุปรายชื่อ</button>
            ${isAdmin ? '<br><br><button class="btn-wish" onclick="resetGame()">↺ เริ่มใหม่ (Reset)</button>' : ''}
        `;
        return;
    }
    const tier = prizes[currentTier];
    document.getElementById('bannerDisplay').innerHTML = `
        <h1 style="color:${tier.color}; font-size: clamp(30px, 6vw, 60px); margin:0; text-shadow: 0 0 20px currentColor;">${tier.name}</h1>
        <p style="font-size: 20px; color:#ddd;">จำนวนรางวัล: ${tier.count}</p>
    `;
    document.getElementById('poolCount').innerText = `คงเหลือผู้ลุ้นรางวัล: ${participants.length} คน`;
    starColor = tier.color;
}

function runWarpEffect() {
    const meteor = document.getElementById('meteor');
    const flash = document.getElementById('flashOverlay');
    isWarping = true;
    document.querySelector('.container').style.opacity = 0;
    
    if(document.querySelector('.btn-history-toggle')) 
        document.querySelector('.btn-history-toggle').style.display = 'none';
   
    const btnUpdate = document.getElementById('btnUpdate');
    if(btnUpdate) btnUpdate.style.display = 'none';

    // ✅ เพิ่ม: ซ่อนปุ่ม Reset ตอนวาร์ปด้วย (เพื่อความสวยงาม)
    const btnReset = document.getElementById('btnResetSystem');
    if(btnReset) btnReset.style.display = 'none';

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
    title.style.textAlign = 'left'; 
    title.style.width = '100%';
    title.style.paddingLeft = '10px'; 
    
    grid.innerHTML = "";

    winners.forEach((winner, index) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.style.borderColor = tier.color;
        card.style.animationDelay = `${index * 0.05}s`;
        card.style.overflow = "hidden";

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
    
    if(document.querySelector('.btn-history-toggle'))
        document.querySelector('.btn-history-toggle').style.display = 'block';

    const btnUpdate = document.getElementById('btnUpdate');
    if(btnUpdate) btnUpdate.style.display = 'block';

    // ✅ เพิ่ม: โชว์ปุ่ม Reset กลับมา (ถ้าเป็น admin)
    const btnReset = document.getElementById('btnResetSystem');
    if(btnReset && isAdmin) btnReset.style.display = 'block';
}

/* --- History & Copy System --- */
function toggleHistory() {
    const modal = document.getElementById('historyModal');
    const list = document.getElementById('historyList');

    if (modal.style.display === 'flex') {
        modal.style.display = 'none';
    } else {
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
                        <div style="text-align:right; margin-bottom:10px;">
                            <button onclick="copyToClipboard('${prize.name}')" style="background:#4a90e2; color:white; border:none; padding:8px 15px; border-radius:5px; cursor:pointer; font-size:14px; font-weight:bold;">📋 ก๊อปปี้รายชื่อ ${prize.name}</button>
                        </div>
                `;
                winners.forEach(w => {
                    const name = w[headers[1]] || "ไม่ระบุชื่อ";
                    const dept = w[headers[2]] || "-"; 
                    contentHtml += `<div class="history-item searchable-item">${name} <span>${dept}</span></div>`;
                });
                contentHtml += `</div>`;
            });

            tabsHtml += `</div>`;
            contentHtml += `</div>`;
            const searchHtml = `
                <div style="padding: 10px 20px; text-align: center;">
                    <input type="text" id="historySearchInput" onkeyup="filterHistory()" placeholder="🔍 พิมพ์ชื่อเพื่อค้นหา..." 
                    style="width: 100%; max-width: 400px; padding: 10px; border-radius: 20px; border: 1px solid #555; background: #222; color: #fff; text-align: center; outline: none;">
                </div>
            `;
            list.innerHTML = tabsHtml + searchHtml + contentHtml;
            initDragScroll();
        }
        modal.style.display = 'flex';
    }
}

function initDragScroll() {
    const slider = document.getElementById('tabsContainer');
    if(!slider) return;
    let isDown = false; let startX; let scrollLeft;
    slider.addEventListener('mousedown', (e) => { isDown = true; startX = e.pageX - slider.offsetLeft; scrollLeft = slider.scrollLeft; });
    slider.addEventListener('mouseleave', () => { isDown = false; });
    slider.addEventListener('mouseup', () => { isDown = false; });
    slider.addEventListener('mousemove', (e) => { if (!isDown) return; e.preventDefault(); const x = e.pageX - slider.offsetLeft; const walk = (x - startX) * 2; slider.scrollLeft = scrollLeft - walk; });
}

window.switchTab = function(event, tabId) {                                             
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    event.currentTarget.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    const target = document.getElementById(tabId);
    if(target) target.classList.add('active');
    const searchInput = document.getElementById('historySearchInput');
    if (searchInput) {
        searchInput.value = ""; 
        document.querySelectorAll('.searchable-item').forEach(item => item.style.display = "flex");
    }
}

function copyToClipboard(rankName) {
    const winners = winnersHistory[rankName];
    if (!winners || winners.length === 0) return;
    let textToCopy = "ID\tName\tDepartment\n"; 
    winners.forEach(w => {
        const id = w[headers[0]] || "-";
        const name = w[headers[1]] || "-";
        const dept = w[headers[2]] || "-";
        textToCopy += `${id}\t${name}\t${dept}\n`;
    });
    navigator.clipboard.writeText(textToCopy).then(() => {
        alert(`คัดลอกรายชื่อ ${rankName} เรียบร้อย!`);
    });
}

function filterHistory() {
    const input = document.getElementById('historySearchInput');
    const filter = input.value.toLowerCase();
    const activeTab = document.querySelector('.tab-content.active');
    if (!activeTab) return;
    const items = activeTab.getElementsByClassName('searchable-item');
    for (let i = 0; i < items.length; i++) {
        const text = items[i].textContent || items[i].innerText;
        items[i].style.display = (text.toLowerCase().indexOf(filter) > -1) ? "flex" : "none";
    }
}

/* --- Background Animation --- */
const canvas = document.getElementById('starCanvas');
const ctx = canvas.getContext('2d');
let w, h, stars = [], planets = [];

function resize() { 
    w = canvas.width = window.innerWidth; 
    h = canvas.height = window.innerHeight; 
}
window.addEventListener('resize', resize); 
resize();

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

class Planet {
    constructor() { this.reset(); }
    reset() {
        this.x = (Math.random() - 0.5) * w * 2;
        this.y = (Math.random() - 0.5) * h * 2;
        this.z = w + Math.random() * w; 
        this.size = Math.random() * 30 + 10; 
        const colors = ["#ff6b6b", "#4ecdc4", "#ffe66d", "#1a535c", "#f7fff7", "#ff9ff3", "#feca57"];
        this.color = colors[Math.floor(Math.random() * colors.length)];
        this.hasRing = Math.random() > 0.7; 
        this.ringAngle = Math.random() * Math.PI;
    }
    update() {
        this.z -= isWarping ? 60 : 1.5; 
        if (this.z < 1) {
            this.reset();
            this.z = w + 500; 
        }
    }
    draw() {
        let sx = (this.x / this.z) * w + w / 2;
        let sy = (this.y / this.z) * h + h / 2;
        let r = (1 - this.z / w) * this.size;
        if (r < 0) r = 0; 
        if (this.hasRing) {
            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(this.ringAngle);
            ctx.beginPath();
            ctx.ellipse(0, 0, r * 2.2, r * 0.6, 0, 0, Math.PI * 2);
            ctx.strokeStyle = this.color;
            ctx.lineWidth = r * 0.4; 
            ctx.globalAlpha = isWarping ? 0.5 : 0.3; 
            ctx.stroke();
            ctx.restore();
        }
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.globalAlpha = isWarping ? 0.8 : 1.0; 
        ctx.fill();
        ctx.globalAlpha = 1.0; 
    }
}

stars = [];
planets = []; 
for(let i=0; i<3000; i++) stars.push(new Star());
for(let i=0; i<30; i++) planets.push(new Planet()); 

function animate() {
    ctx.fillStyle = "#0c0c10"; 
    ctx.fillRect(0, 0, w, h);
    stars.forEach(s => { s.update(); s.draw(); });
    planets.forEach(p => { p.update(); p.draw(); });
    requestAnimationFrame(animate);
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
    }).then(() => {
        console.log("Sent to sheet successfully!");
    }).catch(err => console.error("Error sending to sheet:", err));
}

function forceClearCache() {
    if(!confirm("ต้องการล้าง Cache เพื่ออัปเดตข้อมูลใช่ไหม?")) return;
    localStorage.clear();
    sessionStorage.clear();
    const url = new URL(window.location.href);
    url.searchParams.set('v', Date.now()); 
    window.location.href = url.toString();
}

// ==========================================
// ✅ ส่วนที่แก้ไข: เพิ่มการจัดการปุ่ม Reset System
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // เช็คสิทธิ์ Admin
    const urlParams = new URLSearchParams(window.location.search);
    const isAdminUser = urlParams.get('admin') === 'true';

    const btnStart = document.getElementById('btnStart');
    const msgWaiting = document.getElementById('msgWaiting');
    const controlBar = document.querySelector('.control-bar');
    
    // 👇 ดึงปุ่ม Reset System มาใช้งาน
    const btnReset = document.getElementById('btnResetSystem');

    if (isAdminUser) {
        // 👑 โหมด Admin
        if(btnStart) btnStart.style.display = 'inline-block';
        if(msgWaiting) msgWaiting.style.display = 'none';
        if(controlBar) controlBar.style.display = 'flex';
        
        // ✅ เปิดโชว์ปุ่ม Reset ให้ Admin เห็น
        if(btnReset) btnReset.style.display = 'block';

        console.log("Mode: Admin");
    } else {
        // 👤 โหมดคนดู
        if(btnStart) btnStart.style.display = 'none';
        if(msgWaiting) msgWaiting.style.display = 'flex';
        if(controlBar) controlBar.style.display = 'none';
        
        // 🔒 ซ่อนปุ่ม Reset ให้คนดู (กันเหนียว)
        if(btnReset) btnReset.style.display = 'none';

        console.log("Mode: Viewer");
    }
    animate();

});


