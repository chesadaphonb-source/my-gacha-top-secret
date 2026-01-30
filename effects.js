/* effects.js - Meteor Shower Version (ฝนดาวตก มีหัวมีหางฟุ้งๆ) */

const canvas = document.getElementById('starCanvas');
const ctx = canvas.getContext('2d');

let width, height;
let stars = [];
let starSpeed = 2;
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
        this.x = (Math.random() - 0.5) * width * 2;
        this.y = (Math.random() - 0.5) * height * 2;
        this.z = initial ? Math.random() * width : width;
        this.pz = this.z;
        // ขนาดดาว (หัวดาว)
        this.size = Math.random() * 1.5 + 0.5; 
    }

    update() {
        this.z -= starSpeed;

        if (this.z < 1) {
            this.reset();
            this.z = width;
            this.pz = this.z;
        }
    }

    draw() {
        let sx = (this.x / this.z) * width + width / 2;
        let sy = (this.y / this.z) * height + height / 2;
        let px = (this.x / this.pz) * width + width / 2;
        let py = (this.y / this.pz) * height + height / 2;

        this.pz = this.z;

        let opacity = (1 - this.z / width);
        if(isWarping) opacity = 1; 

        // --- ส่วนที่แก้ไข: วาดแบบดาวตก ---

        // 1. วาด "หัวดาว" (วงกลมสว่างๆ)
        ctx.beginPath();
        // หัวดาวสีขาวสว่าง
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`; 
        // ขนาดหัวดาว ถ้า warp ให้ใหญ่ขึ้นนิดนึง
        let headSize = isWarping ? this.size * 1.2 : this.size;
        ctx.arc(sx, sy, headSize, 0, Math.PI * 2);
        ctx.fill();

        // 2. วาด "หางดาว" (เส้นตามหลัง)
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(sx, sy);
        
        if (isWarping) {
            // ตอน Warp: หางสีฟ้าอ่อนๆ จางกว่าหัวดาว (opacity * 0.5)
            ctx.strokeStyle = `rgba(200, 240, 255, ${opacity * 0.5})`;
            // ความหนาหาง ไม่หนามาก และปลายมน
            ctx.lineWidth = this.size + 0.5; 
            ctx.lineCap = 'round'; 
        } else {
            // ปกติ: หางจางๆ สั้นๆ
            ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.3})`;
            ctx.lineWidth = this.size * 0.5;
        }
        
        ctx.stroke();
    }
}

// สร้างดาว 600 ดวง
for (let i = 0; i < 600; i++) {
    stars.push(new Star());
}

function animate() {
    // 🔥 เคล็ดลับความฟุ้ง: ตอน Warp ให้ถมสีดำทับแบบจางมากๆ (0.1)
    // ทำให้ภาพเก่าค้างอยู่นานขึ้น เกิดเป็นหางยาวๆ ฟุ้งๆ
    ctx.fillStyle = isWarping ? "rgba(10, 10, 14, 0.1)" : "rgba(10, 10, 14, 0.5)";
    ctx.fillRect(0, 0, width, height);

    // Lerp ความเร็ว
    starSpeed += (targetSpeed - starSpeed) * 0.1;

    stars.forEach(star => {
        star.update();
        star.draw();
    });

    requestAnimationFrame(animate);
}
animate();

/* ================= ฟังก์ชันสั่งงาน ================= */

window.startMeteorShower = function() { 
    isWarping = true;
    targetSpeed = 80; // ความเร็วตอนพุ่ง
    
    // เอฟเฟกต์ UI (ถ้ามี)
    const container = document.querySelector('.container');
    if(container) {
        container.style.transition = "opacity 0.5s, transform 0.5s";
        container.style.opacity = "0";
        container.style.transform = "scale(1.5)";
    }
    document.querySelectorAll('.bg-planet').forEach(el => el.classList.add('planet-warp'));
}

window.stopMeteorShower = function() {
    isWarping = false;
    targetSpeed = 2;
    document.querySelectorAll('.bg-planet').forEach(el => el.classList.remove('planet-warp'));
}

window.initStars = function() { };
