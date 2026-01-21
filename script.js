/* --- Configuration --- */
const prizes = [
    { name: "Rank 5 (General)", count: 50, color: "#65a5f0" }, // ฟ้า
    { name: "Rank 4 (Rare)", count: 30, color: "#d376f0" },    // ม่วง
    { name: "Rank 3 (Epic)", count: 15, color: "#d376f0" },    // ม่วง
    { name: "Rank 2 (Vice)", count: 5, color: "#ffd700" },     // ทอง
    { name: "Rank 1 (Grand)", count: 3, color: "#ffd700" }     // ทอง
];

let participants = [];
let headers = [];
let currentTier = 0;
let isWarping = false;
let starColor = "#fff";

// 🔥 ตัวแปรเก็บประวัติผู้ชนะ (เพิ่มใหม่)
let winnersHistory = {}; 

/* --- 1. Load Data --- */
function loadData() {
    const url = document.getElementById('sheetUrl').value.trim();
    if(!url) return alert("กรุณาใส่ลิงก์ CSV");

    const btn = document.querySelector('#setupContainer button');
    btn.innerText = "กำลังโหลด..."; btn.disabled = true;

    fetch(url)
        .then(response => response.text())
        .then(csv => {
            const lines = csv.split(/\r?\n/).filter(line => line.trim() !== "");
            if (lines.length < 2) { alert("Data Error"); btn.disabled=false; return; }
            headers = lines[0].split(',').map(h => h.trim());
            participants = lines.slice(1).map(line => {
                const data = line.split(',');
                let obj = {};
                headers.forEach((h, i) => obj[h] = data[i] ? data[i].trim() : "-");
                obj._id = data[0].trim();
                return obj;
            });
            
            // เตรียม Object เก็บประวัติ
            prizes.forEach(p => winnersHistory[p.name] = []);

            document.getElementById('setupContainer').style.display = 'none';
            document.getElementById('mainScreen').style.display = 'block';
            updateUI();
        })
        .catch(err => { console.error(err); alert("Link Error"); btn.disabled=false; });
}

/* --- 2. Update UI --- */
function updateUI() {
    if (currentTier >= prizes.length) {
        document.getElementById('mainScreen').innerHTML = `
            <h1 class="gold-text" style="font-size:40px;">🎉 จบกิจกรรม! 🎉</h1>
            <p>ขอบคุณผู้ร่วมสนุกทุกท่าน</p>
            <button class="btn-wish" onclick="toggleHistory()">📜 ดูสรุปรายชื่อ</button>
            <br><br>
            <button class="btn-wish" onclick="resetGame()">↺ เริ่มใหม่ (Reset)</button>
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

/* --- 3. Animation Logic (Meteor) --- */
function startWish() {

    const currentPrizeName = prizes[currentTier].name;
    if (winnersHistory[currentPrizeName] && winnersHistory[currentPrizeName].length > 0) {
    alert("⛔ รางวัลรอบนี้สุ่มไปแล้วครับ!\nกรุณากดปุ่มเพื่อไป Rank ถัดไป");
    return; // สั่งหยุดทำงานทันที ไม่ให้สุ่มซ้ำ
    }

    if(participants.length === 0) return alert("รายชื่อหมดแล้ว!");
    
    const tier = prizes[currentTier];
    const prizeColor = tier.color; 
    const meteor = document.getElementById('meteor');
    const flash = document.getElementById('flashOverlay');
    
    isWarping = true;
    document.querySelector('.container').style.opacity = 0;
    
    // ซ่อนปุ่ม History ชั่วคราว
    document.querySelector('.btn-history-toggle').style.display = 'none';

    meteor.style.color = prizeColor; 
    flash.style.background = prizeColor;

    setTimeout(() => { meteor.classList.add('meteor-falling'); }, 500);

    setTimeout(() => {
        flash.style.opacity = 1;
        setTimeout(() => {
            performRaffle(); 
            flash.style.opacity = 0; 
            isWarping = false; 
            meteor.classList.remove('meteor-falling'); 
            flash.style.background = "white";
        }, 300);
    }, 1800);
}

function performRaffle() {
    const tier = prizes[currentTier];
    const drawCount = Math.min(tier.count, participants.length);
    for (let i = participants.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [participants[i], participants[j]] = [participants[j], participants[i]];
    }
    const winners = participants.slice(0, drawCount);
    participants = participants.slice(drawCount);
    
    // 🔥 บันทึกผู้ชนะลงประวัติ
    if(!winnersHistory[tier.name]) winnersHistory[tier.name] = [];
    winnersHistory[tier.name].push(...winners);

    showResults(winners, tier);
}

function showResults(winners, tier) {
    const grid = document.getElementById('resultGrid');
    document.getElementById('resultTitle').innerText = tier.name;
    document.getElementById('resultTitle').style.color = tier.color;
    grid.innerHTML = "";

    winners.forEach((winner, index) => {
        const card = document.createElement('div');
        card.className = 'card';
        card.style.borderColor = tier.color;
        card.style.animationDelay = `${index * 0.05}s`;

        const idVal = winner[headers[0]]; 
        const nameVal = winner[headers[1]] || ""; 
        let subInfo = "";
        for(let k=2; k < headers.length; k++) {
            const val = winner[headers[k]];
            if(val && val !== "-") subInfo += `<div class="info-sub">${headers[k]}: ${val}</div>`;
        }

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

function closeResult() {
    document.getElementById('resultScreen').style.display = 'none';
    document.querySelector('.container').style.opacity = 1;
    // แสดงปุ่ม History กลับมา
    document.querySelector('.btn-history-toggle').style.display = 'block';
}

function nextRound() { closeResult(); currentTier++; updateUI(); }

function resetGame() {
    currentTier = 0; participants = []; headers = []; winnersHistory = {};
    document.getElementById('mainScreen').style.display = 'none';
    document.getElementById('setupContainer').style.display = 'block';
    document.querySelector('.container').style.opacity = 1;
    const btn = document.querySelector('#setupContainer button');
    btn.innerText = "Load Data"; btn.disabled = false;
}

/* --- 🔥 Functions สำหรับ History Modal --- */
function toggleHistory() {
    const modal = document.getElementById('historyModal');
    const list = document.getElementById('historyList');
    
    if (modal.style.display === 'flex') {
        modal.style.display = 'none';
    } else {
        const activePrizes = prizes.filter(p => winnersHistory[p.name] && winnersHistory[p.name].length > 0);

        if (activePrizes.length === 0) {
             list.innerHTML = `<p style="text-align:center; color:#888; margin-top:50px; font-size: 16px;">ยังไม่มีการจับรางวัล</p>`;
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
                    // headers[1] = ชื่อ (Column B)
                    // headers[2] = สังกัด (Column C) *ถ้าไม่มีจะขึ้นว่า -
                    const name = w[headers[1]] || "ไม่ระบุชื่อ";
                    const dept = w[headers[2]] || "-"; 

                    // จัดรูปแบบ: เอาชื่อขึ้นก่อน แล้วเอาสังกัดไปใส่ใน <span> ฝั่งขวา
                    contentHtml += `<div class="history-item">${name} <span>${dept}</span></div>`;
                });
                contentHtml += `</div>`;
            });

            tabsHtml += `</div>`;
            contentHtml += `</div>`;

            list.innerHTML = tabsHtml + contentHtml;

            // --- ส่วนระบบ Click & Drag เหมือนเดิม ---
            const slider = document.getElementById('tabsContainer');
            let isDown = false;
            let startX;
            let scrollLeft;
            let isDragging = false;

            slider.addEventListener('mousedown', (e) => {
                isDown = true;
                isDragging = false;
                startX = e.pageX - slider.offsetLeft;
                scrollLeft = slider.scrollLeft;
            });
            slider.addEventListener('mouseleave', () => { isDown = false; slider.classList.remove('dragging'); });
            slider.addEventListener('mouseup', () => {
                isDown = false;
                setTimeout(() => { slider.classList.remove('dragging'); }, 50);
            });
            slider.addEventListener('mousemove', (e) => {
                if (!isDown) return;
                e.preventDefault();
                const x = e.pageX - slider.offsetLeft;
                const walk = (x - startX) * 2;
                if (Math.abs(x - startX) > 5) {
                    isDragging = true;
                    slider.classList.add('dragging');
                    slider.scrollLeft = scrollLeft - walk;
                }
            });
        }
        modal.style.display = 'flex';
    }
}

// ฟังก์ชันสลับแท็บ (เหมือนเดิม ไม่ต้องแก้)
window.switchTab = function(event, tabId) {														
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));			// 1. เอาสถานะ Active ออกจากทุกปุ่ม
    event.currentTarget.classList.add('active');												// 2. ใส่ Active ให้ปุ่มที่กด
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));		// 3. ซ่อนเนื้อหาทั้งหมด
    document.getElementById(tabId).classList.add('active');										// 4. โชว์เนื้อหาของแท็บที่เลือก
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

// Class: Star
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

// Class: Planet
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
            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(this.ringAngle);
            ctx.beginPath();
            ctx.ellipse(0, 0, projectedSize * 2.2, projectedSize * 0.6, 0, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
            ctx.lineWidth = projectedSize * 0.4;
            ctx.stroke();
            ctx.restore();
        }

        ctx.beginPath();
        ctx.arc(sx, sy, projectedSize, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 20;
        ctx.shadowColor = this.color;
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

for(let i=0; i<5000; i++) stars.push(new Star());
for(let i=0; i<10; i++) planets.push(new Planet());

function animate() {
    ctx.fillStyle = isWarping ? "rgba(0,0,0,0.3)" : "#0c0c10";
    ctx.fillRect(0, 0, w, h);
    stars.forEach(s => { s.update(); s.draw(); });
    planets.forEach(p => { p.update(); p.draw(); });
    requestAnimationFrame(animate);
}

animate();

