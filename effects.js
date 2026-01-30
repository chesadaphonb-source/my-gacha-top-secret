/* effects.js - Hyperdrive Version */

const canvas = document.getElementById('starCanvas');
const ctx = canvas.getContext('2d');

let width, height;
let stars = [];
let starSpeed = 2; // ความเร็วปกติ
let targetSpeed = 2;
let isWarping = false;

// ตั้งค่าขนาดจอ
function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Class สร้างดาว
class Star {
    constructor() {
        this.reset(true);
    }

    reset(initial = false) {
        // x, y คือตำแหน่งบนหน้าจอ
        // z คือความลึก (ไกล = ค่ามาก, ใกล้ = ค่าน้อย)
        this.x = (Math.random() - 0.5) * width * 2;
        this.y = (Math.random() - 0.5) * height * 2;
        this.z = initial ? Math.random() * width : width;
        this.pz = this.z; // ตำแหน่งก่อนหน้า (เอาไว้วาดหางดาว)
        this.size = Math.random() * 2; // ขนาดดาวสุ่มๆ
    }

    update() {
        // ขยับดาวเข้ามาหาหน้าจอ
        this.z -= starSpeed;

        // ถ้าดาววิ่งเลยหน้าจอ (z < 1) ให้รีเซ็ตไปข้างหลังใหม่
        if (this.z < 1) {
            this.reset();
            this.z = width;
            this.pz = this.z;
        }
    }

    draw() {
        // สูตรแปลง 3D เป็น 2D
        let sx = (this.x / this.z) * width + width / 2;
        let sy = (this.y / this.z) * height + height / 2;

        // สูตรหาตำแหน่งเก่า (เพื่อลากเส้นหาง)
        let px = (this.x / this.pz) * width + width / 2;
        let py = (this.y / this.pz) * height + height / 2;

        this.pz = this.z;

        // คำนวณความสว่าง (ใกล้ = สว่าง)
        let opacity = (1 - this.z / width);
        if(isWarping) opacity = 0.8; // ตอน Warp ให้สว่างขึ้น

        ctx.beginPath();
        ctx.moveTo(px, py); // จุดเก่า
        ctx.lineTo(sx, sy); // จุดใหม่
        
        // ถ้า Warp ให้เป็นเส้นยาวๆ สีขาว/ฟ้า
        if (isWarping) {
            ctx.strokeStyle = `rgba(200, 230, 255, ${opacity})`;
            ctx.lineWidth = this.size * (starSpeed / 10); // ยิ่งเร็วยิ่งเส้นใหญ่
        } else {
            // ถ้าปกติ ให้เป็นจุดๆ หรือเส้นสั้นๆ
            ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
            ctx.lineWidth = this.size;
        }
        
        ctx.stroke();
    }
}

// สร้างดาว 500 ดวง
for (let i = 0; i < 500; i++) {
    stars.push(new Star());
}

// ลูปอนิเมชั่น
function animate() {
    // เคลียร์หน้าจอ (ทำจางๆ เพื่อให้เกิด Motion Blur นิดๆ)
    ctx.fillStyle = "rgba(10, 10, 14, 0.4)"; 
    ctx.fillRect(0, 0, width, height);

    // ปรับความเร็วแบบนุ่มนวล (Lerp)
    starSpeed += (targetSpeed - starSpeed) * 0.1;

    stars.forEach(star => {
        star.update();
        star.draw();
    });

    requestAnimationFrame(animate);
}
animate();

/* ================= ฟังก์ชันสั่งงานจากภายนอก ================= */

// ฟังก์ชันเริ่ม Warp (เรียกจาก script.js ตอนกดสุ่ม)
window.startMeteorShower = function() { // ใช้ชื่อเดิมเพื่อให้เข้ากับ script.js
    isWarping = true;
    targetSpeed = 80; // 🚀 เร่งความเร็วแสง!
    
    // สั่งให้ดาวเคราะห์เบลอ
    document.querySelectorAll('.bg-planet').forEach(el => el.classList.add('planet-warp'));
    
    // ซ่อน UI
    const container = document.querySelector('.container');
    if(container) {
        container.style.transition = "opacity 0.5s, transform 0.5s";
        container.style.opacity = "0";
        container.style.transform = "scale(1.2)"; // ขยาย UI ให้เหมือนเราพุ่งทะลุไป
    }
}

// ฟังก์ชันหยุด Warp (เรียกตอนโชว์ผล)
window.stopMeteorShower = function() {
    isWarping = false;
    targetSpeed = 2; // กลับมาความเร็วปกติ
    
    // คืนค่าดาวเคราะห์
    document.querySelectorAll('.bg-planet').forEach(el => el.classList.remove('planet-warp'));
}

/* ฟังก์ชัน initStars (เผื่อ script.js เรียกใช้ ก็ให้มันว่างๆ ไว้ หรือ return true) */
window.initStars = function() {
    console.log("Stars system ready");
};
