/* ==========================================================================
   ส่วนที่ 1: เชื่อมต่อ Server & ตั้งค่าพื้นฐาน
   ========================================================================== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// ⚠️ Config Firebase ของคุณ
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
const gameRef = ref(db, 'systemState');

// --- ตรวจสอบสิทธิ์ Admin (จาก URL ?admin=true) ---
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('admin') === 'true') {
    localStorage.setItem('wish_admin', 'true');
}
const isAdmin = localStorage.getItem('wish_admin') === 'true';

// --- Expose ฟังก์ชันให้ HTML เรียกใช้ได้ ---
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
   ส่วนที่ 2: Listener (ตัวรับคำสั่งจาก Cloud)
   ========================================================================== */
onValue(gameRef, (snapshot) => {
    // 1. ปิดหน้า Loading Overlay
    const loader = document.getElementById('globalLoader');
    if (loader) loader.style.display = 'none';

    const state = snapshot.val();
    const setupContainer = document.getElementById('setupContainer');
    const mainScreen = document.getElementById('mainScreen');

    // 2. ถ้า Admin ยัง Setup ไม่เสร็จ
    if (!state || !state.isSetupDone) {
        if (isAdmin) {
            // แอดมิน: ให้เห็นหน้าตั้งค่า
            if(setupContainer) setupContainer.style.display = 'block';
            if(mainScreen) mainScreen.style.display = 'none';
        } else {
            // คนดู: ถ้าข้อมูลยังไม่มา ให้รอที่หน้าว่างๆ หรือ Loading ไปก่อน
            if(setupContainer) setupContainer.style.display = 'none';
            if(mainScreen) mainScreen.style.display = 'none';
            // ถ้าอยากให้คนดูเห็นข้อความรอเท่ๆ ให้เปิด loader ไว้
            if(loader) {
                loader.style.display = 'flex';
                loader.querySelector('.loading-text').innerText = "WAITING FOR HOST...";
            }
        }
        return;
    }

    // 3. ถ้า Setup เสร็จแล้ว -> ✅ บังคับเข้าหน้าจอหลักทันที (ไม่ต้องสนสถานะ IDLE)
    if(setupContainer) setupContainer.style.display = 'none';
    if(mainScreen) mainScreen.style.display = 'block'; // โชว์หน้านี้เสมอ!

    // อัปเดตข้อมูล Local
    participants = state.participants || [];
    headers = state.headers || [];
    winnersHistory = state.history || {};
    currentTier = state.currentTier || 0;
    
    // อัปเดต UI และสถานะปุ่ม
    updateUI();
    updateUIState(isAdmin); 

    // Logic Animation (ส่วน Warp เหมือนเดิม)
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
    
    // Fisher-Yates Shuffle
    for (let i = participants.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [participants[i], participants[j]] = [participants[j], participants[i]];
    }
    
    const winners = participants.slice(0, drawCount);
    const remaining = participants.slice(drawCount);
    
    let newHistory = { ...winnersHistory };
    if (!newHistory[tier.name]) newHistory[tier.name] = [];
    newHistory[tier.name].push(...winners);

    update(gameRef, {
        status: 'SHOW_RESULT',
        lastRoundWinners: winners,
        participants: remaining,
        history: newHistory
    });

    saveToSheet(winners, tier.name);
}

function nextRound() {
    if (!isAdmin) return;
    document.getElementById('resultScreen').style.display = 'none';

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

// ✅ ฟังก์ชันจัดการหน้าจอ Admin/Audience
function updateUIState(isAdmin) {
    const startBtnContainer = document.getElementById('startBtnContainer');
    const adminPanel = document.getElementById('adminPanel'); 
    const msgWaiting = document.getElementById('msgWaiting');
    const btnHistory = document.querySelector('.btn-history-toggle'); // ปุ่ม History

    // 1. ตั้งค่าพื้นฐาน: โชว์ปุ่ม History เสมอ (ทั้งแอดมินและคนดู)
    if (btnHistory) btnHistory.style.display = 'block';

    if (isAdmin) {
        // --- ADMIN VIEW ---
        // แอดมินเห็นปุ่มกดสุ่ม และปุ่มตั้งค่า
        if (startBtnContainer) startBtnContainer.style.display = 'flex';
        if (adminPanel) adminPanel.style.display = 'flex';
        if (msgWaiting) msgWaiting.style.display = 'none';
    } else {
        // --- AUDIENCE VIEW ---
        // คนดูไม่เห็นปุ่มสุ่ม แต่เห็นข้อความรอ
        if (startBtnContainer) startBtnContainer.style.display = 'none';
        if (adminPanel) adminPanel.style.display = 'none';
        // ถ้าอยากให้คนดูเห็นแค่ดาวสวยๆ ไม่มีข้อความ "รอสัญญาณ" รกตา 
        // ก็ตั้ง msgWaiting เป็น 'none' ได้ครับ แต่ถ้าอยากให้มี text ก็ใส่ 'flex'
        if (msgWaiting) msgWaiting.style.display = 'flex'; 
    }
}

function runWarpEffect() {
    isWarping = true;
    const container = document.querySelector('.container');
    
    // ซ่อน UI ระหว่าง Warp
    const controls = document.querySelectorAll('.action-area, .admin-controls, .btn-history-toggle');

    if(container) container.classList.add('suck-in-animation');
    controls.forEach(el => el.classList.add('suck-in-animation'));

    setTimeout(() => {
        if(container) container.style.opacity = 0;
        controls.forEach(el => el.style.opacity = 0);
    }, 700);

    // เรียกฟังก์ชันใน effects.js ให้เร่งความเร็วดาว
    if (window.startMeteorShower) {
        window.startMeteorShower();
    }
}

function stopWarpEffect() {
    isWarping = false;
    // เรียกฟังก์ชันใน effects.js ให้หยุด Warp
    if (window.stopMeteorShower) {
        window.stopMeteorShower();
    }
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
        headerDiv.textContent = winner[headers[0]] || "ID"; 
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
    const btnNext = document.getElementById('btnNextPrize'); 
    
    if (btnNext) {
        if (isAdmin && currentTier < prizes.length - 1) {
            btnNext.style.display = 'inline-block';
        } else {
            btnNext.style.display = 'none';
        }
    }
}

function closeResult() {
    document.getElementById('resultScreen').style.display = 'none';
    goToLatestSession(); 
}

function goToLatestSession() {
    const suckedElements = document.querySelectorAll('.suck-in-animation');
    suckedElements.forEach(el => {
        el.classList.remove('suck-in-animation');
        el.style.opacity = 1;
        el.style.transform = '';
        el.style.filter = '';
    });
    
    // คืนค่า Opacity ให้ปุ่มควบคุม
    const controls = document.querySelectorAll('.action-area, .admin-controls, .btn-history-toggle');
    controls.forEach(el => el.style.opacity = 1);

    document.getElementById('resultScreen').style.display = 'none';
    const container = document.getElementById('mainScreen');
    if(container) {
        container.style.display = 'block';
        container.style.opacity = 1;
    }
    updateUIState(isAdmin); // รีเช็คสถานะปุ่มอีกครั้ง
}

/* ==========================================================================
   ส่วนที่ 5: History
   ========================================================================== */
function toggleHistory() {
    const modal = document.getElementById('historyModal');
    // ถ้าปิดอยู่ -> เปิด
    if (modal.style.display === 'none' || modal.style.display === '') {
        renderHistory(); // เรียกฟังก์ชันวาดเนื้อหา
        modal.style.display = 'flex';
    } else {
        modal.style.display = 'none';
    }
}

// แยกฟังก์ชัน Render ออกมาเพื่อความสะอาด
function renderHistory() {
    const list = document.getElementById('historyList');
    const tabsContainer = document.getElementById('historyTabs');

    // เคลียร์ค่าเก่าทิ้งก่อน
    if (tabsContainer) tabsContainer.innerHTML = '';
    list.innerHTML = '';

    // เช็คว่ารางวัลไหนมีคนได้ไปแล้วบ้าง (filter เฉพาะอันที่มีข้อมูล)
    const activePrizes = prizes.filter(p => winnersHistory[p.name] && winnersHistory[p.name].length > 0);

    // กรณี: ยังไม่มีใครได้รางวัลเลย
    if (activePrizes.length === 0) {
        list.innerHTML = `<div style="text-align:center; padding: 40px; color:#666;">
            <p style="font-size: 50px; margin:0;">🧊</p>
            <p>ยังไม่มีข้อมูลผู้โชคดี</p>
        </div>`;
        return;
    }

    // สร้าง Search Box
    let searchBox = document.createElement('div');
    searchBox.className = 'search-container';
    searchBox.innerHTML = `
        <input type="text" id="historySearchInput" onkeyup="filterHistory()" 
        placeholder="🔍 พิมพ์ชื่อเพื่อค้นหาในหน้านี้..." >
    `;
    list.appendChild(searchBox);

    // เริ่มวนลูปสร้าง Tab และ เนื้อหา
    activePrizes.forEach((prize, index) => {
        const isActive = (index === 0); // ให้แท็บแรกเป็น Active เสมอ
        const activeClass = isActive ? 'active' : '';
        const winners = winnersHistory[prize.name];

        // 1. สร้างปุ่ม Tab ด้านบน
        if (tabsContainer) {
            const btn = document.createElement('button');
            btn.className = `tab-btn ${activeClass}`;
            btn.innerHTML = `${prize.name} <span class="badge">${winners.length}</span>`;
            btn.style.borderColor = prize.color; // ให้ขอบสีตามรางวัล
            btn.onclick = (e) => switchTab(e, `tab-${index}`);
            tabsContainer.appendChild(btn);
        }

        // 2. สร้างกล่องรายชื่อ (Content)
        const contentDiv = document.createElement('div');
        contentDiv.id = `tab-${index}`;
        contentDiv.className = `tab-content ${activeClass}`;

        // ปุ่ม Copy แยกแต่ละรางวัล
        contentDiv.innerHTML = `
            <div style="text-align:right; margin-bottom:10px;">
                <button onclick="copyToClipboard('${prize.name}')" class="btn-copy">
                    📄 คัดลอกรายชื่อรางวัลนี้
                </button>
            </div>
        `;

        // ยัดรายชื่อคนลงไป
        winners.forEach(w => {
            const name = w[headers[1]] || "ไม่ระบุชื่อ";
            const dept = w[headers[2]] || "-";
            const row = document.createElement('div');
            row.className = 'history-item searchable-item';
            row.style.borderLeft = `4px solid ${prize.color}`; // แถบสีข้างชื่อ
            row.innerHTML = `
                <div class="h-name">${name}</div>
                <div class="h-dept">${dept}</div>
            `;
            contentDiv.appendChild(row);
        });

        list.appendChild(contentDiv);
    });
}

// ฟังก์ชันสลับ Tab
window.switchTab = function(event, tabId) {
    // เอา active ออกจากทุกปุ่ม
    document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('active');
        b.style.backgroundColor = 'transparent';
        b.style.color = '#aaa';
    });
    
    // เอา active ออกจากทุกเนื้อหา
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    // ใส่ active ให้ปุ่มที่กด
    const btn = event.currentTarget;
    btn.classList.add('active');
    btn.style.backgroundColor = btn.style.borderColor; // เปลี่ยนสีพื้นหลังเป็นสีรางวัล
    btn.style.color = '#000'; // ตัวหนังสือดำให้อ่านง่าย

    // โชว์เนื้อหาที่เลือก
    document.getElementById(tabId).classList.add('active');
    
    // ล้างช่องค้นหาเวลาเปลี่ยนแท็บ
    const searchInput = document.getElementById('historySearchInput');
    if(searchInput) searchInput.value = '';
    filterHistory(); // รีเซ็ตรายการที่ซ่อน
};

function copyToClipboard(rankName) {
    const winners = winnersHistory[rankName];
    if (!winners || winners.length === 0) return;
    let text = "ID\tName\tInfo\n";
    winners.forEach(w => {
        text += `${w[headers[0]]}\t${w[headers[1]]}\t${w[headers[2]] || ""}\n`;
    });
    navigator.clipboard.writeText(text).then(() => alert("คัดลอกรายชื่อเรียบร้อย!"));
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
    if(!isAdmin || !GOOGLE_SCRIPT_URL) return; 
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

/* ==========================================================================
   ส่วนที่ 6: Drag to Scroll (ระบบลากแท็บ History)
   ========================================================================== */
(function setupDragScroll() {
    const slider = document.getElementById('historyTabs'); // ต้องตรงกับ ID ใน HTML
    if (!slider) return; // กัน Error ถ้ายังไม่มี element

    let isDown = false;
    let startX;
    let scrollLeft;

    slider.addEventListener('mousedown', (e) => {
        isDown = true;
        slider.classList.add('active');
        startX = e.pageX - slider.offsetLeft;
        scrollLeft = slider.scrollLeft;
    });

    slider.addEventListener('mouseleave', () => {
        isDown = false;
        slider.classList.remove('active');
    });

    slider.addEventListener('mouseup', () => {
        isDown = false;
        slider.classList.remove('active');
    });

    slider.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - slider.offsetLeft;
        const walk = (x - startX) * 2; // ปรับความเร็วในการลากที่นี่ (*2 คือเร็ว 2 เท่า)
        slider.scrollLeft = scrollLeft - walk;
    });
})();

