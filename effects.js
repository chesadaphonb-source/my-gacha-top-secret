/* =================================================================
   GLOBAL CONFIG & DOM ELEMENTS
   ================================================================= */
const DOM = {
    starCanvas: document.getElementById('starCanvas'),
    meteor: document.getElementById('meteor'),
    setupBox: document.querySelector('.setup-box'),
    loader: document.querySelector('.loading-overlay'),
    planetSpinner: document.querySelector('.planet-spinner .planet'), // ตัวดาวที่จะเปลี่ยนสี
    loadingText: document.querySelector('.loading-text'),
    resultScreen: document.getElementById('resultScreen'),
    resultGrid: document.querySelector('.result-grid'),
    historyModal: document.querySelector('.history-modal'),
    historyList: document.getElementById('historyList'),
    inputs: {
        name: document.getElementById('inputName'),
        wish: document.getElementById('inputWish')
    }
};

// ฐานข้อมูลผลลัพธ์ (ตัวอย่าง: คุณสามารถแก้ตรงนี้เพื่อเปลี่ยนคำทำนาย/ของรางวัล)
const MOCK_RESULTS = [
    { title: "สำเร็จแน่นอน!", sub: "ความพยายามของคุณจะส่งผลในเร็ววัน", type: "good" },
    { title: "มีโอกาสสูง", sub: "ดวงดาวกำลังเรียงตัวเข้าข้างคุณ", type: "good" },
    { title: "รออีกนิด", sub: "จังหวะเวลายังไม่ใช่ ตอนนี้ให้เตรียมตัวไว้", type: "neutral" },
    { title: "ปาฏิหาริย์", sub: "สิ่งที่ขอจะเกิดขึ้นแบบที่คุณไม่คาดคิด!", type: "rare" },
    { title: "ต้องพยายามเพิ่ม", sub: "ดวงช่วย 10% อีก 90% คือฝีมือคุณ", type: "hard" }
];

/* =================================================================
   1. BACKGROUND: STAR FIELD & METEOR
   ================================================================= */
function initStars() {
    const ctx = DOM.starCanvas.getContext('2d');
    let width, height, stars = [];

    function resize() {
        width = window.innerWidth;
        height = window.innerHeight;
        DOM.starCanvas.width = width;
        DOM.starCanvas.height = height;
        createStars();
    }

    function createStars() {
        stars = [];
        for (let i = 0; i < 200; i++) {
            stars.push({
                x: Math.random() * width,
                y: Math.random() * height,
                r: Math.random() * 1.5,
                a: Math.random() // alpha (opacity)
            });
        }
    }

    function draw() {
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = "white";
        stars.forEach(star => {
            ctx.globalAlpha = star.a;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
            ctx.fill();
        });
        requestAnimationFrame(draw);
    }

    window.addEventListener('resize', resize);
    resize();
    draw();
}

// ระบบดาวตก (สุ่มเวลาตก)
function startMeteorShower() {
    function shootMeteor() {
        // สุ่มตำแหน่งเริ่มและมุมตก
        const startX = Math.random() * window.innerWidth;
        const startY = Math.random() * (window.innerHeight / 2); // ตกจากครึ่งบน
        
        DOM.meteor.style.left = startX + 'px';
        DOM.meteor.style.top = startY + 'px';
        
        // เริ่มอนิเมชัน
        DOM.meteor.classList.remove('meteor-falling');
        void DOM.meteor.offsetWidth; // Trigger reflow
        DOM.meteor.classList.add('meteor-falling');

        // สุ่มเวลาครั้งถัดไป (5 - 15 วินาที)
        const nextTime = Math.random() * 10000 + 5000;
        setTimeout(shootMeteor, nextTime);
    }
    shootMeteor();
}

/* =================================================================
   2. CORE LOGIC: WISHING & LOADING
   ================================================================= */
function startWish() {
    const name = DOM.inputs.name.value.trim();
    const wish = DOM.inputs.wish.value.trim();

    if (!name || !wish) {
        alert("กรุณากรอกชื่อและคำอธิษฐานก่อนส่งดวงดาวครับ ✨");
        return;
    }

    // 1. ซ่อนหน้า Setup
    DOM.setupBox.style.display = 'none';

    // 2. สุ่มดาวเคราะห์สำหรับ Loading (Saturn, Ice, Magma, Cyber)
    const planetTypes = ['planet-saturn', 'planet-ice', 'planet-magma', 'planet-cyber'];
    const randomPlanet = planetTypes[Math.floor(Math.random() * planetTypes.length)];
    
    // ลบคลาสเก่าออกก่อน แล้วใส่คลาสใหม่
    DOM.planetSpinner.className = 'planet'; 
    DOM.planetSpinner.classList.add(randomPlanet);

    // 3. แสดง Loading Screen
    DOM.loader.style.opacity = '1';
    DOM.loader.style.zIndex = '9999'; // ให้แน่ใจว่าบังทุกอย่าง
    DOM.loader.style.display = 'flex'; // แก้จาก CSS เดิมที่อาจซ่อนไว้

    // เปลี่ยนข้อความ Loading
    const loadingTexts = ["กำลังเชื่อมต่อจักรวาล...", "อ่านค่ากลุ่มดาว...", "คำนวณความเป็นไปได้...", "ส่งคำขอไปยังกาแล็กซี..."];
    let textIndex = 0;
    const textInterval = setInterval(() => {
        DOM.loadingText.innerText = loadingTexts[textIndex % loadingTexts.length];
        textIndex++;
    }, 800);

    // 4. จำลองเวลาโหลด (3 วินาที) แล้วแสดงผล
    setTimeout(() => {
        clearInterval(textInterval);
        showResult(name, wish);
    }, 3000);
}

/* =================================================================
   3. RESULT & HISTORY
   ================================================================= */
function showResult(name, wish) {
    // ซ่อน Loader
    DOM.loader.style.opacity = '0';
    setTimeout(() => { DOM.loader.style.display = 'none'; }, 500);

    // สุ่มผลลัพธ์
    const result = MOCK_RESULTS[Math.floor(Math.random() * MOCK_RESULTS.length)];

    // สร้าง Card HTML
    const cardHTML = `
        <div class="card">
            <div class="card-header">RESULT</div>
            <div class="card-body">
                <div class="info-main" style="color:var(--gold)">${result.title}</div>
                <div class="info-sub">${result.sub}</div>
                <hr style="width:80%; border-color:#444; margin: 10px auto;">
                <div class="info-sub">คุณ: ${name}</div>
                <div class="info-sub" style="font-style:italic">"${wish}"</div>
            </div>
        </div>
    `;

    DOM.resultGrid.innerHTML = cardHTML;
    
    // แสดงหน้าผลลัพธ์
    DOM.resultScreen.style.display = 'flex';

    // บันทึกลงประวัติ
    saveHistory(name, wish, result.title);
}

function resetApp() {
    // รีเซ็ตหน้าจอเพื่อเริ่มใหม่
    DOM.resultScreen.style.display = 'none';
    DOM.setupBox.style.display = 'block'; // หรือ flex ตามโครงสร้างเดิม
    DOM.inputs.wish.value = ''; // ล้างคำขอ
}

/* =================================================================
   4. HISTORY SYSTEM (LocalStorage)
   ================================================================= */
function saveHistory(name, wish, result) {
    let history = JSON.parse(localStorage.getItem('wishHistory')) || [];
    const timestamp = new Date().toLocaleTimeString('th-TH');
    
    history.unshift({ name, wish, result, timestamp }); // เพิ่มล่าสุดไว้บนสุด
    if(history.length > 50) history.pop(); // เก็บแค่ 50 รายการ

    localStorage.setItem('wishHistory', JSON.stringify(history));
    renderHistory();
}

function toggleHistory() {
    const isHidden = getComputedStyle(DOM.historyModal).display === 'none';
    DOM.historyModal.style.display = isHidden ? 'flex' : 'none';
    if(isHidden) renderHistory();
}

function renderHistory() {
    const history = JSON.parse(localStorage.getItem('wishHistory')) || [];
    DOM.historyList.innerHTML = '';

    if (history.length === 0) {
        DOM.historyList.innerHTML = '<div style="text-align:center; color:#666; padding:20px;">ยังไม่มีประวัติการขอพร</div>';
        return;
    }

    history.forEach(item => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
            <div>
                <div class="h-name">${item.result}</div>
                <div class="h-dept">${item.name} - ${item.timestamp}</div>
            </div>
            <div style="font-size:12px; color:#aaa; max-width: 100px; text-align:right; overflow:hidden; white-space:nowrap; text-overflow:ellipsis;">
                ${item.wish}
            </div>
        `;
        DOM.historyList.appendChild(div);
    });
}

function clearHistory() {
    if(confirm('ลบประวัติทั้งหมด?')) {
        localStorage.removeItem('wishHistory');
        renderHistory();
    }
}

/* =================================================================
   INITIALIZATION
   ================================================================= */
document.addEventListener('DOMContentLoaded', () => {
    initStars();
    startMeteorShower();

    // Event Listeners
    document.querySelector('.start-btn').addEventListener('click', startWish);
    document.querySelector('.btn-next').addEventListener('click', resetApp);
    
    // History Events
    document.querySelector('.btn-history-toggle').addEventListener('click', toggleHistory);
    document.querySelector('.close-btn').addEventListener('click', toggleHistory);
    
    // Tab Switching (Logic พื้นฐาน)
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            tabs.forEach(t => t.classList.remove('active'));
            e.currentTarget.classList.add('active');
            // ตรงนี้คุณสามารถเพิ่ม Logic การ Filter ประวัติได้ถ้าต้องการ
        });
    });
});