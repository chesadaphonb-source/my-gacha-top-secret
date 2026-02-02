/* --- Configuration --- */
const prizes = [
    { name: "Rank 5 (General)", count: 50, color: "#65a5f0" }, 
    { name: "Rank 4 (Rare)", count: 30, color: "#d376f0" },    
    { name: "Rank 3 (Epic)", count: 15, color: "#d376f0" },    
    { name: "Rank 2 (Vice)", count: 5, color: "#ffd700" },     
    { name: "Rank 1 (Grand)", count: 3, color: "#ffd700" }     
];

/* --- Firebase Config --- */
const firebaseConfig = {
  apiKey: "AIzaSyBesRV471aZjkFADTCKWg_YfipTSY4CCts",
  authDomain: "new-gacha.firebaseapp.com",
  databaseURL: "https://new-gacha-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "new-gacha",
  storageBucket: "new-gacha.firebasestorage.app",
  messagingSenderId: "192874951341",
  appId: "1:192874951341:web:9d3b3c58ef64b1526d8c24",
  measurementId: "G-964CY2L5TC"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

/* --- Variables --- */
let participants = [];
let headers = [];
let currentTier = 0;
let isWarping = false;
let starColor = "#fff";
let winnersHistory = {}; 
let isAdmin = false;

// ตรวจสอบว่าเป็น Admin หรือไม่จาก URL (?role=admin)
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('role') === 'admin') {
    isAdmin = true;
}

/* =========================================
   1. INIT & LISTENER SYSTEM
   ========================================= */

window.onload = function() {
    console.log("System Start. Role:", isAdmin ? "ADMIN" : "AUDIENCE");
    prizes.forEach(p => {
        if (!winnersHistory[p.name]) winnersHistory[p.name] = [];
    });

    if (isAdmin) {
        // Admin: แสดงปุ่ม Setup
        document.getElementById('setupContainer').style.display = 'flex';
        document.getElementById('adminControls').style.display = 'block';
        document.getElementById('resultControls').style.display = 'flex';
    } else {
        // Audience: ซ่อน Setup, รอฟัง Firebase อย่างเดียว
        document.getElementById('setupContainer').style.display = 'none'; 
        document.getElementById('mainScreen').style.display = 'block'; // โชว์หน้าจอรอเลย
        document.getElementById('poolCount').innerText = "Ready for the show...";
        
        // 1. ฟัง Game State (เพื่อเล่น Animation)
        db.ref('gameState').on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) handleSync(data);
        });

        // 2. ฟัง History (เพื่อให้เปิดดู Hall of Fame ได้) *** สำคัญมาก ***
        db.ref('history').on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                winnersHistory = data; 
                console.log("History updated from Firebase");
            }
        });
    }
};

// ฟังก์ชันรับค่าจาก Firebase แล้วแสดงผล (Audience)
function handleSync(data) {
    if (isAdmin) return; // Admin ไม่ต้องฟังตัวเอง (ทำงาน Local แล้วส่งค่าไป)

    // อัปเดต Tier หน้าจอ
    if (data.tierIndex !== undefined) {
        currentTier = data.tierIndex;
        updateUI(false); // false = ไม่ต้องแก้ยอดคงเหลือ (เพราะ Audience ไม่มี CSV)
    }

    // สั่งงาน Animation ตาม State
    if (data.status === 'WARPING') {
        playWarpAnimation(data.winners); // ส่งข้อมูลผู้ชนะไปรอไว้
    } else if (data.status === 'REVEAL') {
        // แสดงผลทันที (กรณีเข้ามาทีหลัง)
        if(document.getElementById('resultScreen').style.display === 'none'){
            showResults(data.winners || [], prizes[currentTier]);
        }
    } else if (data.status === 'IDLE') {
        closeResult();
    } else if (data.status === 'RESET') {
        location.reload();
    }
}


/* =========================================
   2. ADMIN ACTIONS (Load Data & Control)
   ========================================= */

function loadData() {
    const url = document.getElementById('sheetUrl').value.trim();
    if(!url) return alert("กรุณาใส่ลิงก์ CSV");

    const btn = document.querySelector('#setupContainer button');
    btn.innerText = "กำลังโหลด..."; btn.disabled = true;

    fetch(url)
        .then(response => response.text())
        .then(csv => {
            const lines = csv.split(/\r?\n/).filter(line => line.trim() !== "");
            headers = lines[0].split(',').map(h => h.trim());
            participants = lines.slice(1).map(line => {
                const data = line.split(',');
                let obj = {};
                headers.forEach((h, i) => obj[h] = data[i] ? data[i].trim() : "-");
                obj._id = data[0].trim();
                return obj;
            });
            
            prizes.forEach(p => winnersHistory[p.name] = []);
            db.ref('history').remove();
            
            // เตรียมหน้าจอ Admin
            document.getElementById('setupContainer').style.display = 'none';
            document.getElementById('mainScreen').style.display = 'block';
            
            // Reset State ใน Firebase เริ่มต้น
            db.ref('gameState').set({
                status: 'IDLE',
                tierIndex: 0,
                winners: [],
                timestamp: Date.now()
            });

            updateUI(true);
        })
        .catch(err => { console.error(err); alert("Link Error"); btn.disabled=false; });
}

function updateUI(showCount = false) {
    // เช็คว่าจบเกมหรือยัง
    if (currentTier >= prizes.length) {
        document.getElementById('bannerDisplay').innerHTML = `
            <h1 class="gold-text">🎉 จบกิจกรรม! 🎉</h1>
            <p style="color:#ddd; margin-bottom: 20px;">ขอบคุณผู้ร่วมสนุกทุกคน</p>
            
            <button onclick="resetGame()" style="
                padding: 15px 40px;
                font-size: 22px;
                background: linear-gradient(45deg, #ff4757, #ff6b81);
                color: white;
                border: none;
                border-radius: 50px;
                cursor: pointer;
                box-shadow: 0 0 20px rgba(255, 71, 87, 0.6);
                font-weight: bold;
                transition: transform 0.2s;
            " onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
                🔄 เริ่มกิจกรรมใหม่
            </button>
        `;
        
        // ซ่อนปุ่ม Start Wish อันเดิม (จะได้ไม่กดซ้ำ)
        document.getElementById('adminControls').style.display = 'none';
        return;
    }

    // ถ้ายังไม่จบ แสดงผลปกติ
    const tier = prizes[currentTier];
    document.getElementById('bannerDisplay').innerHTML = `
        <h1 style="color:${tier.color}; font-size: clamp(30px, 6vw, 60px); margin:0; text-shadow: 0 0 20px currentColor;">${tier.name}</h1>
        <p style="font-size: 20px; color:#ddd;">จำนวนรางวัล: ${tier.count}</p>
    `;
    
    // โชว์ปุ่ม Start Wish ตามปกติ
    if (isAdmin) {
        document.getElementById('adminControls').style.display = 'block';
    }

    if(showCount) {
        document.getElementById('poolCount').innerText = `คงเหลือผู้ลุ้นรางวัล: ${participants.length} คน`;
    }
    starColor = tier.color;
}
// Admin กดปุ่ม Start
function triggerWish() {
    if(!isAdmin) return;
    if(participants.length === 0) return alert("รายชื่อหมดแล้ว!");

    const tier = prizes[currentTier];
    const drawCount = Math.min(tier.count, participants.length);
    
    // 1. คำนวณผู้ชนะที่เครื่อง Admin
    for (let i = participants.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [participants[i], participants[j]] = [participants[j], participants[i]];
    }
    const winners = participants.slice(0, drawCount);
    participants = participants.slice(drawCount); // ตัดรายชื่อออก

    // บันทึกประวัติ
    if(!winnersHistory[tier.name]) winnersHistory[tier.name] = [];
    winnersHistory[tier.name].push(...winners);
    db.ref('history/' + tier.name).set(winnersHistory[tier.name]);
    
    updateUI(true); // อัปเดตยอดคงเหลือที่เครื่อง Admin

    // 2. ส่งสัญญาณไป Firebase (State: WARPING)
    // ส่งข้อมูลผู้ชนะไปด้วยเลย แต่ยังไม่โชว์
    db.ref('gameState').set({
        status: 'WARPING',
        tierIndex: currentTier,
        winners: winners,
        timestamp: Date.now()
    });

    // 3. เล่น Animation ที่เครื่อง Admin ด้วย
    playWarpAnimation(winners);
}

// ฟังก์ชัน Animation (ใช้ร่วมกันทั้ง Admin และ Audience)
function playWarpAnimation(winners) {
    const tier = prizes[currentTier];
    const meteor = document.getElementById('meteor');
    const flash = document.getElementById('flashOverlay');
    
    isWarping = true;
    document.querySelector('.container').style.opacity = 0;
    document.querySelector('.btn-history-toggle').style.display = 'none';

    meteor.style.color = tier.color; 
    flash.style.background = tier.color;

    // เริ่มอนิเมชั่น
    setTimeout(() => { meteor.classList.add('meteor-falling'); }, 500);

    setTimeout(() => {
        flash.style.opacity = 1;
        setTimeout(() => {
            // จังหวะแสงขาวเต็มจอ -> แสดงผล
            showResults(winners, tier);
            
            // ถ้าเป็น Admin ให้ส่งสัญญาณ REVEAL เพื่อให้คนดูที่เน็ตช้า มั่นใจว่าเปิดการ์ดแน่นอน
            if(isAdmin) {
                db.ref('gameState').update({ status: 'REVEAL' });
            }

            flash.style.opacity = 0; 
            isWarping = false;
            meteor.classList.remove('meteor-falling'); 
            flash.style.background = "white";
        }, 300);
    }, 1800);
}

function showResults(winners, tier) {
    const grid = document.getElementById('resultGrid');
    document.getElementById('resultTitle').innerText = tier.name;
    document.getElementById('resultTitle').style.color = tier.color;
    grid.innerHTML = "";

    // ป้องกัน Error กรณีไม่มี Header (ฝั่ง Audience)
    // ฝั่ง Audience เราไม่มี headers เราต้องเดา key เอา หรือรับข้อมูลดิบมา
    // *เทคนิค:* ใน winners ที่ส่งผ่าน Firebase มันเป็น Object สมบูรณ์อยู่แล้ว
    // แต่เราไม่รู้ว่า Key ไหนคือ ID หรือ ชื่อ
    // ดังนั้นเราจะใช้ Object.keys เพื่อดึงข้อมูล

    winners.forEach((winner, index) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.style.borderColor = tier.color;
        card.style.animationDelay = `${index * 0.05}s`;

        // ดึงข้อมูลแบบ Dynamic (เพราะ Audience ไม่มีตัวแปร headers)
        const keys = Object.keys(winner).filter(k => k !== '_id');
        const idVal = winner._id || winner[keys[0]] || "ID"; 
        const nameVal = winner[keys[0]] || winner[keys[1]] || ""; // เดาว่าคอลัมน์แรกๆ คือชื่อ
        
        // สร้าง Sub Info
        let subInfo = "";
        keys.slice(1).forEach(k => { // ข้ามชื่อไป
            if(winner[k] && winner[k] !== "-") 
                subInfo += `<div class="info-sub">${k}: ${winner[k]}</div>`;
        });

        card.innerHTML = `
            <div class="card-header" style="background:${tier.color};">${idVal}</div>
            <div class="card-body">
                <div class="info-main" style="color:${tier.color}">${nameVal}</div>
                ${subInfo}
            </div>
        `;
        grid.appendChild(card);
    });
    document.getElementById('resultScreen').style.display = 'flex';
}

// Admin กดปิดหน้าต่างผลรางวัล
function closeResult() {
    document.getElementById('resultScreen').style.display = 'none';
    document.querySelector('.container').style.opacity = 1;
    document.querySelector('.btn-history-toggle').style.display = 'block';
    
    if(isAdmin) {
        db.ref('gameState').update({ status: 'IDLE' });
    }
}

// Admin กดถัดไป
function nextRound() { 
    closeResult(); 
    currentTier++; 
    
    if(isAdmin) {
        db.ref('gameState').update({ 
            status: 'IDLE',
            tierIndex: currentTier 
        });
        updateUI(true);
    }
}

/* =========================================
   3. HISTORY & EXTRAS
   ========================================= */

function toggleHistory() {
    // ... (ใช้โค้ดเดิมส่วน History Modal ได้เลย ไม่ต้องแก้) ...
    // ใส่โค้ดส่วน toggleHistory อันเดิมลงไปตรงนี้
    const modal = document.getElementById('historyModal');
    const list = document.getElementById('historyList');
    
    if (modal.style.display === 'flex') {
        modal.style.display = 'none';
    } else {
        // *หมายเหตุ* ฝั่ง Audience จะไม่มี winnersHistory สะสมไว้ในตัวแปร local
        // ถ้ายากให้ Audience ดู History ได้ด้วย ต้องดึงจาก Firebase
        // แต่เพื่อความง่ายตอนนี้ ให้ Admin ดูได้คนเดียวไปก่อน หรือถ้ามีข้อมูล local ก็โชว์ได้
        
        const activePrizes = prizes.filter(p => winnersHistory[p.name] && winnersHistory[p.name].length > 0);

        if (activePrizes.length === 0) {
             list.innerHTML = `<p style="text-align:center; color:#888; margin-top:50px; font-size: 16px;">ยังไม่มีการจับรางวัล (Admin only)</p>`;
        } else {
            let tabsHtml = `<div class="history-tabs" id="tabsContainer">`;
            let contentHtml = `<div class="history-content-wrapper">`;

            activePrizes.forEach((prize, index) => {
                const isActive = index === 0 ? 'active' : '';
                const winners = winnersHistory[prize.name];
                
                tabsHtml += `
                    <button class="tab-btn ${isActive}" onclick="switchTab(event, 'tab-${index}')">
                        ${prize.name} <span style="font-size: 0.85em; opacity: 0.8; margin-left: 4px;">(${winners.length})</span>
                    </button>
                `;

                contentHtml += `<div id="tab-${index}" class="tab-content ${isActive}">`;
                winners.forEach(w => {
                    // ดึงค่าแบบ Dynamic
                    const keys = Object.keys(w).filter(k => k !== '_id');
                    const name = w[keys[0]] || "Name";
                    const dept = w[keys[1]] || "-"; 
                    contentHtml += `<div class="history-item">${name} <span>${dept}</span></div>`;
                });
                contentHtml += `</div>`;
            });

            tabsHtml += `</div>`;
            contentHtml += `</div>`;
            list.innerHTML = tabsHtml + contentHtml;
             // --- Enable Drag Scroll ---
             const slider = document.getElementById('tabsContainer');
             let isDown = false, startX, scrollLeft;
 
             slider.addEventListener('mousedown', (e) => {
                 isDown = true; slider.classList.add('dragging');
                 startX = e.pageX - slider.offsetLeft;
                 scrollLeft = slider.scrollLeft;
             });
             slider.addEventListener('mouseleave', () => { isDown = false; slider.classList.remove('dragging'); });
             slider.addEventListener('mouseup', () => { isDown = false; slider.classList.remove('dragging'); });
             slider.addEventListener('mousemove', (e) => {
                 if (!isDown) return;
                 e.preventDefault();
                 const x = e.pageX - slider.offsetLeft;
                 const walk = (x - startX) * 2;
                 slider.scrollLeft = scrollLeft - walk;
             });
        }
        modal.style.display = 'flex';
    }
}

window.switchTab = function(event, tabId) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    event.currentTarget.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
}

/* =========================================
   4. SPACE BACKGROUND (Star + Saturn)
   ========================================= */
const canvas = document.getElementById('starCanvas');
const ctx = canvas.getContext('2d');
let w, h;
let stars = [];
let planets = [];

function resize() { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; }
window.addEventListener('resize', resize); resize();

class Star {
    constructor() { this.reset(); }
    reset() {
        this.x = (Math.random() - 0.5) * w * 2;
        this.y = (Math.random() - 0.5) * h * 2;
        this.z = Math.random() * w; this.pz = this.z;
    }
    update() {
        this.z -= isWarping ? 80 : 2;
        if (this.z < 1) { this.reset(); this.z = w; this.pz = this.z; }
    }
    draw() {
        let sx = (this.x / this.z) * w + w / 2;
        let sy = (this.y / this.z) * h + h / 2;
        let px = (this.x / this.pz) * w + w / 2;
        let py = (this.y / this.pz) * h + h / 2;
        this.pz = this.z;
        let r = (1 - this.z / w) * 3;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(sx, sy);
        ctx.strokeStyle = isWarping ? starColor : "rgba(255,255,255,0.4)";
        ctx.lineWidth = isWarping ? r : r / 2;
        ctx.lineCap = "round"; ctx.stroke();
    }
}

class Planet {
    constructor() { this.reset(); }
    reset() {
        this.x = (Math.random() - 0.5) * w * 4;
        this.y = (Math.random() - 0.5) * h * 4;
        this.z = Math.random() * w * 3 + w;
        this.size = Math.random() * 30 + 10;
        const colors = ["#4a6b8a", "#d4a76a", "#8a4a4a", "#555555", "#bfa3cc"];
        this.color = colors[Math.floor(Math.random() * colors.length)];
        this.hasRing = Math.random() > 0.6;
        this.ringAngle = Math.random() * Math.PI;
    }
    update() {
        let speed = isWarping ? 120 : 0.5;
        this.z -= speed;
        if (this.z < 1) { this.reset(); this.z = w * 4; }
    }
    draw() {
        let sx = (this.x / this.z) * w + w / 2;
        let sy = (this.y / this.z) * h + h / 2;
        let projectedSize = (1 - this.z / (w * 4)) * this.size;
        if (projectedSize < 0) projectedSize = 0;
        if (this.hasRing) {
            ctx.save(); ctx.translate(sx, sy); ctx.rotate(this.ringAngle);
            ctx.beginPath(); ctx.ellipse(0, 0, projectedSize * 2.2, projectedSize * 0.6, 0, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(255, 255, 255, 0.4)"; ctx.lineWidth = projectedSize * 0.4; ctx.stroke(); ctx.restore();
        }
        ctx.beginPath(); ctx.arc(sx, sy, projectedSize, 0, Math.PI * 2);
        ctx.fillStyle = this.color; ctx.shadowBlur = 20; ctx.shadowColor = this.color; ctx.fill(); ctx.shadowBlur = 0;
    }
}

for(let i=0; i<1000; i++) stars.push(new Star());
for(let i=0; i<8; i++) planets.push(new Planet());

function animate() {
    ctx.fillStyle = isWarping ? "rgba(0,0,0,0.3)" : "#0c0c10";
    ctx.fillRect(0, 0, w, h);
    stars.forEach(s => { s.update(); s.draw(); });
    planets.forEach(p => { p.update(); p.draw(); });
    requestAnimationFrame(animate);
}
animate();

/* --- Configuration --- */
const prizes = [
    { name: "Rank 5 (General)", count: 50, color: "#65a5f0" }, 
    { name: "Rank 4 (Rare)", count: 30, color: "#d376f0" },    
    { name: "Rank 3 (Epic)", count: 15, color: "#d376f0" },    
    { name: "Rank 2 (Vice)", count: 5, color: "#ffd700" },     
    { name: "Rank 1 (Grand)", count: 3, color: "#ffd700" }     
];

/* --- Firebase Config --- */
const firebaseConfig = {
  apiKey: "AIzaSyBesRV471aZjkFADTCKWg_YfipTSY4CCts",
  authDomain: "new-gacha.firebaseapp.com",
  databaseURL: "https://new-gacha-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "new-gacha",
  storageBucket: "new-gacha.firebasestorage.app",
  messagingSenderId: "192874951341",
  appId: "1:192874951341:web:9d3b3c58ef64b1526d8c24",
  measurementId: "G-964CY2L5TC"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

/* --- Variables --- */
let participants = [];
let headers = [];
let currentTier = 0;
let isWarping = false;
let starColor = "#fff";
let winnersHistory = {}; 
let isAdmin = false;

// ตรวจสอบว่าเป็น Admin หรือไม่จาก URL (?role=admin)
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('role') === 'admin') {
    isAdmin = true;
}

/* =========================================
   1. INIT & LISTENER SYSTEM
   ========================================= */

window.onload = function() {
    console.log("System Start. Role:", isAdmin ? "ADMIN" : "AUDIENCE");
    prizes.forEach(p => {
        if (!winnersHistory[p.name]) winnersHistory[p.name] = [];
    });

    if (isAdmin) {
        // Admin: แสดงปุ่ม Setup
        document.getElementById('setupContainer').style.display = 'flex';
        document.getElementById('adminControls').style.display = 'block';
        document.getElementById('resultControls').style.display = 'flex';
    } else {
        // Audience: ซ่อน Setup, รอฟัง Firebase อย่างเดียว
        document.getElementById('setupContainer').style.display = 'none'; 
        document.getElementById('mainScreen').style.display = 'block'; // โชว์หน้าจอรอเลย
        document.getElementById('poolCount').innerText = "Ready for the show...";
        
        // 1. ฟัง Game State (เพื่อเล่น Animation)
        db.ref('gameState').on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) handleSync(data);
        });

        // 2. ฟัง History (เพื่อให้เปิดดู Hall of Fame ได้) *** สำคัญมาก ***
        db.ref('history').on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                winnersHistory = data; 
                console.log("History updated from Firebase");
            }
        });
    }
};

// ฟังก์ชันรับค่าจาก Firebase แล้วแสดงผล (Audience)
function handleSync(data) {
    if (isAdmin) return; // Admin ไม่ต้องฟังตัวเอง (ทำงาน Local แล้วส่งค่าไป)

    // อัปเดต Tier หน้าจอ
    if (data.tierIndex !== undefined) {
        currentTier = data.tierIndex;
        updateUI(false); // false = ไม่ต้องแก้ยอดคงเหลือ (เพราะ Audience ไม่มี CSV)
    }

    // สั่งงาน Animation ตาม State
    if (data.status === 'WARPING') {
        playWarpAnimation(data.winners); // ส่งข้อมูลผู้ชนะไปรอไว้
    } else if (data.status === 'REVEAL') {
        // แสดงผลทันที (กรณีเข้ามาทีหลัง)
        if(document.getElementById('resultScreen').style.display === 'none'){
            showResults(data.winners || [], prizes[currentTier]);
        }
    } else if (data.status === 'IDLE') {
        closeResult();
    } else if (data.status === 'RESET') {
        location.reload();
    }
}


/* =========================================
   2. ADMIN ACTIONS (Load Data & Control)
   ========================================= */

function loadData() {
    const url = document.getElementById('sheetUrl').value.trim();
    if(!url) return alert("กรุณาใส่ลิงก์ CSV");

    const btn = document.querySelector('#setupContainer button');
    btn.innerText = "กำลังโหลด..."; btn.disabled = true;

    fetch(url)
        .then(response => response.text())
        .then(csv => {
            const lines = csv.split(/\r?\n/).filter(line => line.trim() !== "");
            headers = lines[0].split(',').map(h => h.trim());
            participants = lines.slice(1).map(line => {
                const data = line.split(',');
                let obj = {};
                headers.forEach((h, i) => obj[h] = data[i] ? data[i].trim() : "-");
                obj._id = data[0].trim();
                return obj;
            });
            
            prizes.forEach(p => winnersHistory[p.name] = []);
            db.ref('history').remove();
            
            // เตรียมหน้าจอ Admin
            document.getElementById('setupContainer').style.display = 'none';
            document.getElementById('mainScreen').style.display = 'block';
            
            // Reset State ใน Firebase เริ่มต้น
            db.ref('gameState').set({
                status: 'IDLE',
                tierIndex: 0,
                winners: [],
                timestamp: Date.now()
            });

            updateUI(true);
        })
        .catch(err => { console.error(err); alert("Link Error"); btn.disabled=false; });
}

function updateUI(showCount = false) {
    // เช็คว่าจบเกมหรือยัง
    if (currentTier >= prizes.length) {
        document.getElementById('bannerDisplay').innerHTML = `
            <h1 class="gold-text">🎉 จบกิจกรรม! 🎉</h1>
            <p style="color:#ddd; margin-bottom: 20px;">ขอบคุณผู้ร่วมสนุกทุกคน</p>
            
            <button onclick="resetGame()" style="
                padding: 15px 40px;
                font-size: 22px;
                background: linear-gradient(45deg, #ff4757, #ff6b81);
                color: white;
                border: none;
                border-radius: 50px;
                cursor: pointer;
                box-shadow: 0 0 20px rgba(255, 71, 87, 0.6);
                font-weight: bold;
                transition: transform 0.2s;
            " onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
                🔄 เริ่มกิจกรรมใหม่
            </button>
        `;
        
        // ซ่อนปุ่ม Start Wish อันเดิม (จะได้ไม่กดซ้ำ)
        document.getElementById('adminControls').style.display = 'none';
        return;
    }

    // ถ้ายังไม่จบ แสดงผลปกติ
    const tier = prizes[currentTier];
    document.getElementById('bannerDisplay').innerHTML = `
        <h1 style="color:${tier.color}; font-size: clamp(30px, 6vw, 60px); margin:0; text-shadow: 0 0 20px currentColor;">${tier.name}</h1>
        <p style="font-size: 20px; color:#ddd;">จำนวนรางวัล: ${tier.count}</p>
    `;
    
    // โชว์ปุ่ม Start Wish ตามปกติ
    if (isAdmin) {
        document.getElementById('adminControls').style.display = 'block';
    }

    if(showCount) {
        document.getElementById('poolCount').innerText = `คงเหลือผู้ลุ้นรางวัล: ${participants.length} คน`;
    }
    starColor = tier.color;
}
// Admin กดปุ่ม Start
function triggerWish() {
    if(!isAdmin) return;
    if(participants.length === 0) return alert("รายชื่อหมดแล้ว!");

    const tier = prizes[currentTier];
    const drawCount = Math.min(tier.count, participants.length);
    
    // 1. คำนวณผู้ชนะที่เครื่อง Admin
    for (let i = participants.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [participants[i], participants[j]] = [participants[j], participants[i]];
    }
    const winners = participants.slice(0, drawCount);
    participants = participants.slice(drawCount); // ตัดรายชื่อออก

    // บันทึกประวัติ
    if(!winnersHistory[tier.name]) winnersHistory[tier.name] = [];
    winnersHistory[tier.name].push(...winners);
    db.ref('history/' + tier.name).set(winnersHistory[tier.name]);
    
    updateUI(true); // อัปเดตยอดคงเหลือที่เครื่อง Admin

    // 2. ส่งสัญญาณไป Firebase (State: WARPING)
    // ส่งข้อมูลผู้ชนะไปด้วยเลย แต่ยังไม่โชว์
    db.ref('gameState').set({
        status: 'WARPING',
        tierIndex: currentTier,
        winners: winners,
        timestamp: Date.now()
    });

    // 3. เล่น Animation ที่เครื่อง Admin ด้วย
    playWarpAnimation(winners);
}

// ฟังก์ชัน Animation (ใช้ร่วมกันทั้ง Admin และ Audience)
function playWarpAnimation(winners) {
    const tier = prizes[currentTier];
    const meteor = document.getElementById('meteor');
    const flash = document.getElementById('flashOverlay');
    
    isWarping = true;
    document.querySelector('.container').style.opacity = 0;
    document.querySelector('.btn-history-toggle').style.display = 'none';

    meteor.style.color = tier.color; 
    flash.style.background = tier.color;

    // เริ่มอนิเมชั่น
    setTimeout(() => { meteor.classList.add('meteor-falling'); }, 500);

    setTimeout(() => {
        flash.style.opacity = 1;
        setTimeout(() => {
            // จังหวะแสงขาวเต็มจอ -> แสดงผล
            showResults(winners, tier);
            
            // ถ้าเป็น Admin ให้ส่งสัญญาณ REVEAL เพื่อให้คนดูที่เน็ตช้า มั่นใจว่าเปิดการ์ดแน่นอน
            if(isAdmin) {
                db.ref('gameState').update({ status: 'REVEAL' });
            }

            flash.style.opacity = 0; 
            isWarping = false;
            meteor.classList.remove('meteor-falling'); 
            flash.style.background = "white";
        }, 300);
    }, 1800);
}

function showResults(winners, tier) {
    const grid = document.getElementById('resultGrid');
    document.getElementById('resultTitle').innerText = tier.name;
    document.getElementById('resultTitle').style.color = tier.color;
    grid.innerHTML = "";

    // ป้องกัน Error กรณีไม่มี Header (ฝั่ง Audience)
    // ฝั่ง Audience เราไม่มี headers เราต้องเดา key เอา หรือรับข้อมูลดิบมา
    // *เทคนิค:* ใน winners ที่ส่งผ่าน Firebase มันเป็น Object สมบูรณ์อยู่แล้ว
    // แต่เราไม่รู้ว่า Key ไหนคือ ID หรือ ชื่อ
    // ดังนั้นเราจะใช้ Object.keys เพื่อดึงข้อมูล

    winners.forEach((winner, index) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.style.borderColor = tier.color;
        card.style.animationDelay = `${index * 0.05}s`;

        // ดึงข้อมูลแบบ Dynamic (เพราะ Audience ไม่มีตัวแปร headers)
        const keys = Object.keys(winner).filter(k => k !== '_id');
        const idVal = winner._id || winner[keys[0]] || "ID"; 
        const nameVal = winner[keys[0]] || winner[keys[1]] || ""; // เดาว่าคอลัมน์แรกๆ คือชื่อ
        
        // สร้าง Sub Info
        let subInfo = "";
        keys.slice(1).forEach(k => { // ข้ามชื่อไป
            if(winner[k] && winner[k] !== "-") 
                subInfo += `<div class="info-sub">${k}: ${winner[k]}</div>`;
        });

        card.innerHTML = `
            <div class="card-header" style="background:${tier.color};">${idVal}</div>
            <div class="card-body">
                <div class="info-main" style="color:${tier.color}">${nameVal}</div>
                ${subInfo}
            </div>
        `;
        grid.appendChild(card);
    });
    document.getElementById('resultScreen').style.display = 'flex';
}

// Admin กดปิดหน้าต่างผลรางวัล
function closeResult() {
    document.getElementById('resultScreen').style.display = 'none';
    document.querySelector('.container').style.opacity = 1;
    document.querySelector('.btn-history-toggle').style.display = 'block';
    
    if(isAdmin) {
        db.ref('gameState').update({ status: 'IDLE' });
    }
}

// Admin กดถัดไป
function nextRound() { 
    closeResult(); 
    currentTier++; 
    
    if(isAdmin) {
        db.ref('gameState').update({ 
            status: 'IDLE',
            tierIndex: currentTier 
        });
        updateUI(true);
    }
}

/* =========================================
   3. HISTORY & EXTRAS
   ========================================= */

function toggleHistory() {
    // ... (ใช้โค้ดเดิมส่วน History Modal ได้เลย ไม่ต้องแก้) ...
    // ใส่โค้ดส่วน toggleHistory อันเดิมลงไปตรงนี้
    const modal = document.getElementById('historyModal');
    const list = document.getElementById('historyList');
    
    if (modal.style.display === 'flex') {
        modal.style.display = 'none';
    } else {
        // *หมายเหตุ* ฝั่ง Audience จะไม่มี winnersHistory สะสมไว้ในตัวแปร local
        // ถ้ายากให้ Audience ดู History ได้ด้วย ต้องดึงจาก Firebase
        // แต่เพื่อความง่ายตอนนี้ ให้ Admin ดูได้คนเดียวไปก่อน หรือถ้ามีข้อมูล local ก็โชว์ได้
        
        const activePrizes = prizes.filter(p => winnersHistory[p.name] && winnersHistory[p.name].length > 0);

        if (activePrizes.length === 0) {
             list.innerHTML = `<p style="text-align:center; color:#888; margin-top:50px; font-size: 16px;">ยังไม่มีการจับรางวัล (Admin only)</p>`;
        } else {
            let tabsHtml = `<div class="history-tabs" id="tabsContainer">`;
            let contentHtml = `<div class="history-content-wrapper">`;

            activePrizes.forEach((prize, index) => {
                const isActive = index === 0 ? 'active' : '';
                const winners = winnersHistory[prize.name];
                
                tabsHtml += `
                    <button class="tab-btn ${isActive}" onclick="switchTab(event, 'tab-${index}')">
                        ${prize.name} <span style="font-size: 0.85em; opacity: 0.8; margin-left: 4px;">(${winners.length})</span>
                    </button>
                `;

                contentHtml += `<div id="tab-${index}" class="tab-content ${isActive}">`;
                winners.forEach(w => {
                    // ดึงค่าแบบ Dynamic
                    const keys = Object.keys(w).filter(k => k !== '_id');
                    const name = w[keys[0]] || "Name";
                    const dept = w[keys[1]] || "-"; 
                    contentHtml += `<div class="history-item">${name} <span>${dept}</span></div>`;
                });
                contentHtml += `</div>`;
            });

            tabsHtml += `</div>`;
            contentHtml += `</div>`;
            list.innerHTML = tabsHtml + contentHtml;
             // --- Enable Drag Scroll ---
             const slider = document.getElementById('tabsContainer');
             let isDown = false, startX, scrollLeft;
 
             slider.addEventListener('mousedown', (e) => {
                 isDown = true; slider.classList.add('dragging');
                 startX = e.pageX - slider.offsetLeft;
                 scrollLeft = slider.scrollLeft;
             });
             slider.addEventListener('mouseleave', () => { isDown = false; slider.classList.remove('dragging'); });
             slider.addEventListener('mouseup', () => { isDown = false; slider.classList.remove('dragging'); });
             slider.addEventListener('mousemove', (e) => {
                 if (!isDown) return;
                 e.preventDefault();
                 const x = e.pageX - slider.offsetLeft;
                 const walk = (x - startX) * 2;
                 slider.scrollLeft = scrollLeft - walk;
             });
        }
        modal.style.display = 'flex';
    }
}

window.switchTab = function(event, tabId) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    event.currentTarget.classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
}

/* =========================================
   4. SPACE BACKGROUND (Star + Saturn)
   ========================================= */
const canvas = document.getElementById('starCanvas');
const ctx = canvas.getContext('2d');
let w, h;
let stars = [];
let planets = [];

function resize() { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; }
window.addEventListener('resize', resize); resize();

class Star {
    constructor() { this.reset(); }
    reset() {
        this.x = (Math.random() - 0.5) * w * 2;
        this.y = (Math.random() - 0.5) * h * 2;
        this.z = Math.random() * w; this.pz = this.z;
    }
    update() {
        this.z -= isWarping ? 80 : 2;
        if (this.z < 1) { this.reset(); this.z = w; this.pz = this.z; }
    }
    draw() {
        let sx = (this.x / this.z) * w + w / 2;
        let sy = (this.y / this.z) * h + h / 2;
        let px = (this.x / this.pz) * w + w / 2;
        let py = (this.y / this.pz) * h + h / 2;
        this.pz = this.z;
        let r = (1 - this.z / w) * 3;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(sx, sy);
        ctx.strokeStyle = isWarping ? starColor : "rgba(255,255,255,0.4)";
        ctx.lineWidth = isWarping ? r : r / 2;
        ctx.lineCap = "round"; ctx.stroke();
    }
}

class Planet {
    constructor() { this.reset(); }
    reset() {
        this.x = (Math.random() - 0.5) * w * 4;
        this.y = (Math.random() - 0.5) * h * 4;
        this.z = Math.random() * w * 3 + w;
        this.size = Math.random() * 30 + 10;
        const colors = ["#4a6b8a", "#d4a76a", "#8a4a4a", "#555555", "#bfa3cc"];
        this.color = colors[Math.floor(Math.random() * colors.length)];
        this.hasRing = Math.random() > 0.6;
        this.ringAngle = Math.random() * Math.PI;
    }
    update() {
        let speed = isWarping ? 120 : 0.5;
        this.z -= speed;
        if (this.z < 1) { this.reset(); this.z = w * 4; }
    }
    draw() {
        let sx = (this.x / this.z) * w + w / 2;
        let sy = (this.y / this.z) * h + h / 2;
        let projectedSize = (1 - this.z / (w * 4)) * this.size;
        if (projectedSize < 0) projectedSize = 0;
        if (this.hasRing) {
            ctx.save(); ctx.translate(sx, sy); ctx.rotate(this.ringAngle);
            ctx.beginPath(); ctx.ellipse(0, 0, projectedSize * 2.2, projectedSize * 0.6, 0, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(255, 255, 255, 0.4)"; ctx.lineWidth = projectedSize * 0.4; ctx.stroke(); ctx.restore();
        }
        ctx.beginPath(); ctx.arc(sx, sy, projectedSize, 0, Math.PI * 2);
        ctx.fillStyle = this.color; ctx.shadowBlur = 20; ctx.shadowColor = this.color; ctx.fill(); ctx.shadowBlur = 0;
    }
}

for(let i=0; i<1000; i++) stars.push(new Star());
for(let i=0; i<8; i++) planets.push(new Planet());

function animate() {
    ctx.fillStyle = isWarping ? "rgba(0,0,0,0.3)" : "#0c0c10";
    ctx.fillRect(0, 0, w, h);
    stars.forEach(s => { s.update(); s.draw(); });
    planets.forEach(p => { p.update(); p.draw(); });
    requestAnimationFrame(animate);
}
animate();

// ฟังก์ชันเริ่มเกมใหม่ (ล้างค่าทั้งหมด)
function resetGame() {
    if(!confirm("⚠️ ต้องการล้างข้อมูลทั้งหมดและเริ่มเกมใหม่ใช่ไหม?")) return;

    // 1. สั่งลบประวัติใน Firebase
    db.ref('history').remove();

    // 2. ส่งสัญญาณ RESET ไปให้ฝั่งคนดู (ให้หน้าจอคนดูรีโหลดอัตโนมัติ)
    db.ref('gameState').set({
        status: 'RESET',
        timestamp: Date.now()
    });

    // 3. รีโหลดหน้า Admin กลับไปหน้าแรก
    setTimeout(() => {
        window.location.reload();
    }, 500);
}




