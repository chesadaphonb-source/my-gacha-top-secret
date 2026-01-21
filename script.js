/* --- Configuration --- */
const prizes = [
    { name: "Rank 5 (General)", count: 50, color: "#65a5f0" },
    { name: "Rank 4 (Rare)", count: 30, color: "#d376f0" },
    { name: "Rank 3 (Epic)", count: 15, color: "#d376f0" },
    { name: "Rank 2 (Vice)", count: 5, color: "#ffd700" },
    { name: "Rank 1 (Grand)", count: 3, color: "#ffd700" }
];

let participants = [];
let headers = [];
let currentTier = 0;
let isWarping = false;
let starColor = "#fff";
let winnersHistory = {};

/* --- 1. Load Data --- */
function loadData() {
    const urlInput = document.getElementById('sheetUrl');
    if(!urlInput) return;
    const url = urlInput.value.trim();
    if(!url) return alert("กรุณาใส่ลิงก์ CSV");

    const btn = document.querySelector('#setupContainer button');
    if(btn) { btn.innerText = "กำลังโหลด..."; btn.disabled = true; }

    fetch(url)
        .then(response => response.text())
        .then(csv => {
            const lines = csv.split(/\r?\n/).filter(line => line.trim() !== "");
            if (lines.length < 2) { alert("Data Error"); if(btn) btn.disabled=false; return; }
            headers = lines[0].split(',').map(h => h.trim());
            participants = lines.slice(1).map(line => {
                const data = line.split(',');
                let obj = {};
                headers.forEach((h, i) => obj[h] = data[i] ? data[i].trim() : "-");
                obj._id = data[0].trim();
                return obj;
            });
            
            prizes.forEach(p => winnersHistory[p.name] = []);
            document.getElementById('setupContainer').style.display = 'none';
            document.getElementById('mainScreen').style.display = 'block';
            updateUI();
        })
        .catch(err => { console.error(err); alert("Link Error"); if(btn) btn.disabled=false; });
}

/* --- 2. Update UI --- */
function updateUI() {
    const mainScreen = document.getElementById('mainScreen');
    if (currentTier >= prizes.length) {
        mainScreen.innerHTML = `
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

/* --- 3. Raffle Logic --- */
function startWish() {
    const currentPrizeName = prizes[currentTier].name;
    if (winnersHistory[currentPrizeName] && winnersHistory[currentPrizeName].length > 0) {
        alert("⛔ รางวัลรอบนี้สุ่มไปแล้วครับ!");
        return;
    }
    if(participants.length === 0) return alert("รายชื่อหมดแล้ว!");
    
    const tier = prizes[currentTier];
    const meteor = document.getElementById('meteor');
    const flash = document.getElementById('flashOverlay');
    
    isWarping = true;
    document.querySelector('.container').style.opacity = 0;
    document.querySelector('.btn-history-toggle').style.display = 'none';

    meteor.style.color = tier.color; 
    flash.style.background = tier.color;

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
    winnersHistory[tier.name].push(...winners);
       saveToSheet(winners, tier.name);
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
    document.querySelector('.btn-history-toggle').style.display = 'block';
}

function nextRound() { closeResult(); currentTier++; updateUI(); }

function resetGame() {
    location.reload(); // วิธี Reset ที่สะอาดที่สุด
}

/* --- 4. History & Copy System --- */
function toggleHistory() {
    const modal = document.getElementById('historyModal');
    const list = document.getElementById('historyList');
    const sheetInput = document.getElementById('sheetUrl');
    const sheetUrl = sheetInput ? sheetInput.value.trim() : "";

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
                    contentHtml += `<div class="history-item">${name} <span>${dept}</span></div>`;
                });
                contentHtml += `</div>`;
            });
            tabsHtml += `</div>`;
            contentHtml += `</div>`;
           
            list.innerHTML = tabsHtml + contentHtml;
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

/* --- 5. Background Animation --- */
const canvas = document.getElementById('starCanvas');
const ctx = canvas.getContext('2d');
let w, h, stars = [], planets = [];
function resize() { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; }
window.addEventListener('resize', resize); resize();

class Star {
    constructor() { this.reset(); }
    reset() { this.x = (Math.random() - 0.5) * w * 2; this.y = (Math.random() - 0.5) * h * 2; this.z = Math.random() * w; this.pz = this.z; }
    update() { this.z -= isWarping ? 80 : 2; if (this.z < 1) { this.reset(); this.z = w; this.pz = this.z; } }
    draw() {
        let sx = (this.x / this.z) * w + w / 2; let sy = (this.y / this.z) * h + h / 2;
        let px = (this.x / this.pz) * w + w / 2; let py = (this.y / this.pz) * h + h / 2;
        this.pz = this.z; let r = (1 - this.z / w) * 3;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(sx, sy);
        ctx.strokeStyle = isWarping ? starColor : "rgba(255,255,255,0.4)";
        ctx.lineWidth = isWarping ? r : r / 2; ctx.stroke();
    }
}
for(let i=0; i<2000; i++) stars.push(new Star());

function animate() {
    ctx.fillStyle = "#0c0c10"; ctx.fillRect(0, 0, w, h);
    stars.forEach(s => { s.update(); s.draw(); });
    requestAnimationFrame(animate);
}

// ⚠️ เอา Web App URL ที่ได้จากข้อ 1 มาใส่ตรงนี้
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycby_BJhSpOljb4B0rgocuzrV-ehaiL9Tq5yCWkJcAFiL85cGYUTGb5RF7jvczH99B7Ie0g/exec"; 

function saveToSheet(winners, rankName) {
    // แปลงข้อมูลให้อยู่ในรูปแบบที่ Script เราเข้าใจ
    const dataToSend = {
        rank: rankName,
        winners: winners.map(w => ({
            id: w[headers[0]] || "-",   // อิงตามหัวตารางคอลัมน์แรก
            name: w[headers[1]] || "-", // อิงตามหัวตารางคอลัมน์สอง
            dept: w[headers[2]] || "-"  // อิงตามหัวตารางคอลัมน์สาม
        }))
    };

    // ส่งข้อมูลออกแบบเงียบๆ (ไม่ Refresh หน้า)
    fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors", // สำคัญ: ต้องใช้ no-cors เพื่อให้ส่งข้ามโดเมนได้โดยไม่ติด Error
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(dataToSend)
    }).then(() => {
        console.log("Sent to sheet successfully!");
    }).catch(err => console.error("Error sending to sheet:", err));
}

animate();

