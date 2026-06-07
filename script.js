// ==========================================
// 1. ตรวจสอบสิทธิ์ & ตั้งค่าตัวแปร Global
// ==========================================
const currentUserData = JSON.parse(sessionStorage.getItem('currentUser'));

if (!currentUserData) {
    window.location.href = 'login.html';
    throw new Error("Redirecting to login...");
}

const currentUsername = currentUserData.username;
let currentSelectedCell = null;
let currentKey = null;
let currentDate = new Date();

// ตัวแปรเก็บข้อมูล
let userTemplates = []; 
let scheduleData = {}; 

// 🔥 ตัวแปรเก็บท่าออกกำลังกาย (โหลดจาก Cloud)
let muscleData = {}; 
let isAdminUser = false; // ตัวแปรเช็คว่าเป็นแอดมินไหม

// 🏆 ข้อมูลเริ่มต้น (Backup ไว้เผื่อ Cloud ว่างเปล่า)
const defaultMuscleData = {
    chest: { title: "เลือกท่าอก (Chest)", exercises: [{ name: "Chest Fly", img: "Chest Fly.jpg" }, { name: "Incline Chest Press", img: "Incline Chest Press.jpg" }, { name: "Chest Press", img: "Chest press.jpg" }]},
    triceps: { title: "เลือกท่าหลังแขน (Triceps)", exercises: [{ name: "Rope Triceps Pushdown", img: "Rope pushdown.jpg" }]},
    shoulder: { title: "เลือกท่าไหล่ (Shoulder)", exercises: [{ name: "Shoulder Press", img: "Shoulder Press.jpg" }]},
    abs: { title: "เลือกท่าท้อง (Abs)", exercises: [{ name: "Abdominal curl", img: "abdominal curl.jpg" }, { name: "Side abdominal", img: "side abdominal .jpg" }]},
    back: { title: "เลือกท่าหลัง (Back)", exercises: [{ name: "Lat Pulldown", img: "Lat Pulldown.jpg" }, { name: "Chest Support Row", img: "Chest support row.jpg" }]},
    biceps: { title: "เลือกท่าหน้าแขน (Biceps)", exercises: [{ name: "Dumbell Curl", img: "dumbell curl.jpg" }, { name: "Hammer Curl", img: "Hammer Curl.jpg" }, { name: "Pressure Curl", img: "pressure curl.jpg" }]},
    legs: { title: "เลือกท่าขา (Legs)", exercises: [{ name: "Leg Press", img: "Leg Press.jpg" }, { name: "Hip Abduction", img: "Inner Thigh Adductor.jpg" }, { name: "Hip Adduction", img: "leg adduction.jpg" }, { name: "Leg Curl", img: "leg curl.jpg" }, { name: "Leg Extension", img: "leg extension.jpg" }]},
    calves: { title: "เลือกท่าน่อง (Calves)", exercises: [{ name: "Calf Raise", img: "Calf raise.jpg" }, { name: "Seated Calf Raise", img: "Seated Calf Raise.jpg" }]},
    cardio: { title: "เลือกคาร์ดิโอ (Cardio)", exercises: [{ name: "Stair Master", img: "Stair Master.jpg" }, { name: "Cycling", img: "Cycling.jpg" }, { name: "Elliptical", img: "Elliptical.jpg" }, { name: "Walking (treadmill)", img: "Walking .jpg" }, { name: "Seated Cycling", img: "Seated Cycling.jpg" }]}
};

const presetTemplates = [
    { id: 'preset_chest', name: 'วันเล่นอก (พื้นฐาน)', exercises: [{ name: 'Bench Press', details: '12reps 4sets', completed: false }, { name: 'Dumbbell Press', details: '12reps 3sets', completed: false }, { name: 'Chest Fly', details: '15reps 3sets', completed: false }] },
    { id: 'preset_leg', name: 'วันเล่นขา (พื้นฐาน)', exercises: [{ name: 'Squat', details: '10reps 4sets', completed: false }, { name: 'Leg Press', details: '12reps 3sets', completed: false }, { name: 'Calf Raise', details: '15reps 3sets', completed: false }] },
    { id: 'preset_shoulder', name: 'วันเล่นไหล่ (พื้นฐาน)', exercises: [{ name: 'Overhead Press', details: '10reps 4sets', completed: false }, { name: 'Lateral Raise', details: '15reps 3sets', completed: false }] },
    { id: 'preset_back', name: 'วันเล่นหลัง (พื้นฐาน)', exercises: [{ name: 'Lat Pulldown', details: '12reps 3sets', completed: false }, { name: 'Seated Row', details: '12reps 3sets', completed: false }] },
    { id: 'preset_cardio', name: 'วันคาร์ดิโอ (พื้นฐาน)', exercises: [{ name: 'Treadmill', details: '45 นาที', completed: false }, { name: 'Cycling', details: '30 นาที', completed: false }] }
];

let tempExercises = [];
let editingTemplateId = null;
const monthNames = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const allExercisesDB = ["Bench Press", "Squat", "Deadlift", "Pull Up", "Push Up", "Plank", "Crunch", "Treadmill (Running)"]; 

// ==========================================
// 2. เริ่มทำงาน & 🔥 เชื่อมต่อ Firebase Realtime 🔥
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    checkLoginStatus();
    setupExerciseSearch(); 
    setupDateConstraints();
    checkAdminMode(); // 👑 เช็คว่าเป็นแอดมินไหม

    // 1. ดึงข้อมูลตารางส่วนตัว
    db.ref('users/' + currentUsername + '/schedule').on('value', (snapshot) => {
        scheduleData = snapshot.val() || {}; 
        renderCalendar();
        if(currentKey && scheduleData[currentKey]) { renderModalList(); }
    });

    db.ref('users/' + currentUsername + '/templates').on('value', (snapshot) => {
        userTemplates = snapshot.val() || [];
        renderTemplateList(); 
    });

    // 👑 2. ดึงข้อมูล "ท่าออกกำลังกายกลาง (System)" จาก Firebase
    db.ref('system/exercises').on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            muscleData = data; // ถ้ามีข้อมูลบน Cloud ให้ใช้เลย
        } else {
            // ถ้า Cloud ว่างเปล่า (เพิ่งเริ่มระบบ) ให้ดันข้อมูล Default ขึ้นไป
            muscleData = defaultMuscleData;
            db.ref('system/exercises').set(defaultMuscleData);
            console.log("Initialize Default Exercises to Cloud");
        }
    });

    const mobileBtn = document.querySelector('.mobile-toggle');
    const mobileNav = document.querySelector('.header-nav');
    if (mobileBtn && mobileNav) { mobileBtn.addEventListener('click', () => { mobileNav.classList.toggle('active'); }); }
});

// ==========================================
// 👑 Admin Functions (เพิ่มท่าใหม่)
// ==========================================
function checkAdminMode() {
    // ⚠️ ชื่อ Admin ของคุณ
    const ADMIN_USERNAME = "admin007"; 
    
    if (currentUsername.toLowerCase() === ADMIN_USERNAME.toLowerCase()) {
        isAdminUser = true; // ✅ จำไว้ว่าเป็นแอดมิน
        // document.getElementById('btn-admin-floating').style.display = 'flex'; // ❌ ลบบรรทัดนี้ทิ้งเพราะไม่มีปุ่มแล้ว
        console.log("Welcome Admin 007!");
    }
}

function openAdminModal() {
    document.getElementById('adminModal').style.display = 'flex';
}

function openAdminModalWithContext() {
    // ฟังก์ชันนี้จะถูกเรียกจากปุ่มใน Modal
    closeModal('universalModal'); // ปิดหน้าต่างเลือกท่าก่อน
    
    // เลือกหมวดหมู่ใน Dropdown ให้อัตโนมัติ
    if(currentMuscleGroupKey) {
        document.getElementById('admin-ex-group').value = currentMuscleGroupKey;
    }
    
    openAdminModal(); // เปิดหน้าต่างเพิ่มท่า
}

function saveNewSystemExercise() {
    const name = document.getElementById('admin-ex-name').value.trim();
    const group = document.getElementById('admin-ex-group').value;
    const fileInput = document.getElementById('admin-ex-img');
    
    if (!name) { alert("กรุณาใส่ชื่อท่า"); return; }
    if (fileInput.files.length === 0) { alert("กรุณาเลือกรูปภาพ"); return; }

    const file = fileInput.files[0];
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const imgBase64 = e.target.result;
        const newEx = { name: name, img: imgBase64 };
        const updatedGroupData = muscleData[group] || { title: group, exercises: [] };
        if(!updatedGroupData.exercises) updatedGroupData.exercises = [];
        updatedGroupData.exercises.push(newEx);

        db.ref('system/exercises/' + group).set(updatedGroupData)
            .then(() => {
                alert("✅ เพิ่มท่าใหม่สำเร็จ!");
                closeModal('adminModal');
                document.getElementById('admin-ex-name').value = "";
                document.getElementById('admin-ex-img').value = "";
            })
            .catch((err) => {
                alert("เกิดข้อผิดพลาด: " + err.message);
            });
    };
    reader.readAsDataURL(file); 
}


// --- 🔥 ฟังก์ชันช่วยบันทึก ---
function saveDataToFirebase() { db.ref('users/' + currentUsername + '/schedule').set(scheduleData); }
function saveTemplatesToFirebase() { db.ref('users/' + currentUsername + '/templates').set(userTemplates); }

// ... (ฟังก์ชัน UI เดิม) ...
function setupDateConstraints() {
    const startInput = document.getElementById('start-date-input');
    const endInput = document.getElementById('end-date-input');
    if (!startInput || !endInput) return;
    const tzOffset = new Date().getTimezoneOffset() * 60000; 
    const localISOTime = (new Date(Date.now() - tzOffset)).toISOString().slice(0, 10);
    startInput.setAttribute('min', localISOTime);
    endInput.setAttribute('min', localISOTime);
    startInput.addEventListener('change', function() {
        const startDateVal = this.value;
        endInput.setAttribute('min', startDateVal);
        if (endInput.value && endInput.value < startDateVal) { endInput.value = ""; }
    });
}
function setupExerciseSearch() {
    const datalist = document.getElementById('exercise-list');
    if (!datalist) return;
    allExercisesDB.sort();
    let optionsHtml = '';
    allExercisesDB.forEach(ex => { optionsHtml += `<option value="${ex}">`; });
    datalist.innerHTML = optionsHtml;
}
function checkLoginStatus() {
    const authBtn = document.getElementById('nav-auth-btn');
    if(!authBtn) return;
    if (currentUserData) {
        authBtn.innerHTML = `<i class="fas fa-sign-out-alt"></i> ออกจากระบบ (${currentUserData.fullname || currentUsername})`;
        authBtn.href = "#";
        authBtn.classList.add('logged-in');
        authBtn.onclick = (e) => {
            e.preventDefault();
            if(confirm("ต้องการออกจากระบบใช่หรือไม่?")) {
                sessionStorage.removeItem('currentUser');
                window.location.href = 'login.html';
            }
        };
    }
}
function switchTab(tabName) {
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.content-view').forEach(v => v.classList.remove('active')); 
    if(tabName === 'calendar') {
        document.querySelectorAll('.tab-item')[0].classList.add('active');
        document.getElementById('calendar-view').classList.add('active');
        renderCalendar(); 
    } else {
        document.querySelectorAll('.tab-item')[1].classList.add('active');
        document.getElementById('list-view').classList.add('active');
        renderTemplateList();
    }
}
function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const realToday = new Date();
    document.getElementById('current-month-year').innerText = `${monthNames[month]} ${year + 543}`;
    const firstDayIndex = new Date(year, month, 1).getDay();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const calendarBody = document.getElementById('calendar-body');
    calendarBody.innerHTML = "";
    for(let i = 0; i < firstDayIndex; i++) { calendarBody.innerHTML += `<div class="day-box empty" style="border:none; cursor:default;"></div>`; }
    for(let i = 1; i <= lastDay; i++) {
        const dateKey = `${year}-${String(month+1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
        const hasSchedule = scheduleData[dateKey];
        const isToday = (i === realToday.getDate() && month === realToday.getMonth() && year === realToday.getFullYear());
        const todayClass = isToday ? 'today' : '';
        let innerContent = ''; 
        if(hasSchedule) {
            const totalEx = hasSchedule.exercises.length;
            const doneEx = hasSchedule.exercises.filter(e => e.completed).length;
            let percent = 0;
            if(totalEx > 0) percent = Math.round((doneEx / totalEx) * 100);
            const badgeClass = (percent === 100) ? 'percent-badge full' : 'percent-badge';
            innerContent += `<div class="${badgeClass}">${percent}%</div>`;
            innerContent += `<div class="schedule-label">${hasSchedule.name}</div>`;
            if (hasSchedule.isFinished === true) { innerContent += `<i class="fas fa-check-circle status-mark completed"></i>`; } 
            else { innerContent += `<i class="fas fa-pencil-alt status-mark pending"></i>`; }
        }
        calendarBody.innerHTML += `<div class="day-box ${todayClass}" onclick="openDate(this, '${dateKey}', ${i})"><span>${i}</span>${innerContent}</div>`;
    }
}
function changeMonth(step) { currentDate.setMonth(currentDate.getMonth() + step); renderCalendar(); }
function openDate(el, dateKey, day) {
    currentSelectedCell = el; currentKey = dateKey;     
    const yearBE = currentDate.getFullYear() + 543;
    const monthName = monthNames[currentDate.getMonth()];
    document.getElementById('modal-date-title').innerText = `วันที่ ${day} ${monthName} ${yearBE}`;
    document.getElementById('exercise-modal').style.display = 'flex';
    if (scheduleData[dateKey]) { showWorkoutView(); } else { showSelectionView(); }
}
function showSelectionView() {
    document.getElementById('modal-select-view').style.display = 'block';
    document.getElementById('modal-workout-view').style.display = 'none';
    document.querySelector('.modal-footer').style.display = 'none';
    const container = document.getElementById('select-list-container');
    container.innerHTML = '';
    if(presetTemplates.length > 0) {
        container.innerHTML += `<div style="grid-column:1/-1; color:#e96b04; font-weight:bold; margin-top:5px; border-bottom:1px solid #eee;">แบบมาตรฐาน (เลือกได้เลย)</div>`;
        presetTemplates.forEach(temp => { container.innerHTML += `<div class="btn-select-template" onclick="chooseTemplate('${temp.id}')"><i class="fas fa-dumbbell"></i><span>${temp.name}</span></div>`; });
    }
    if(userTemplates.length > 0) {
        container.innerHTML += `<div style="grid-column:1/-1; color:#333; font-weight:bold; margin-top:15px; border-bottom:1px solid #eee;">แบบของคุณ (Saved)</div>`;
        userTemplates.forEach(temp => { container.innerHTML += `<div class="btn-select-template" onclick="chooseTemplate('${temp.id}')"><i class="fas fa-user-edit"></i><span>${temp.name}</span></div>`; });
    } else {
        container.innerHTML += `<div style="grid-column:1/-1; text-align:center; color:#999; margin-top:10px; font-size:0.9rem;">(ยังไม่มีตารางของคุณเอง ไปสร้างที่หน้า "จัดตาราง" ได้เลย)</div>`;
    }
}
function chooseTemplate(tempId) {
    let template = userTemplates.find(t => t.id === tempId);
    let isPreset = false;
    if (!template) { template = presetTemplates.find(t => t.id === tempId); isPreset = true; }
    if(template) {
        scheduleData[currentKey] = JSON.parse(JSON.stringify(template));
        scheduleData[currentKey].isFinished = false; 
        saveDataToFirebase();
        if (isPreset) {
            const alreadyExists = userTemplates.some(t => t.name === template.name);
            if (!alreadyExists) {
                const newCustom = JSON.parse(JSON.stringify(template));
                newCustom.id = 'custom_' + new Date().getTime();
                userTemplates.push(newCustom);
                saveTemplatesToFirebase();
            }
        }
        renderCalendar(); showWorkoutView();
    }
}
function showWorkoutView() {
    document.getElementById('modal-select-view').style.display = 'none';
    document.getElementById('modal-workout-view').style.display = 'block';
    document.querySelector('.modal-footer').style.display = 'block';
    renderModalList();
}
function renderModalList() {
    const data = scheduleData[currentKey];
    if(!data) return; 
    document.getElementById('modal-workout-name').innerText = data.name;
    const list = document.getElementById('modal-exercise-list');
    list.innerHTML = '';
    data.exercises.forEach((ex, idx) => {
        list.innerHTML += `<div class="ex-row" style="align-items:center; border-bottom:1px solid #eee; padding:5px 0;"><div><div>${ex.name} <a href="https://www.youtube.com/results?search_query=วิธีเล่น+${ex.name}" target="_blank" style="color:red; margin-left:5px; text-decoration:none;"><i class="fab fa-youtube"></i></a></div><small style="color:#888;">${ex.details}</small></div><div style="display:flex; align-items:center; gap:15px;"><div onclick="startRestTimer(60)" style="cursor:pointer; color:#f39c12; font-size:1.2rem;" title="กดเพื่อจับเวลาพัก"><i class="fas fa-stopwatch"></i></div><div class="check-circle ${ex.completed ? 'checked' : ''}" onclick="toggleCheck(${idx})">${ex.completed ? '<i class="fas fa-check"></i>' : ''}</div></div></div>`;
    });
}
function toggleCheck(idx) {
    if(scheduleData[currentKey] && scheduleData[currentKey].exercises[idx]) {
        scheduleData[currentKey].exercises[idx].completed = !scheduleData[currentKey].exercises[idx].completed;
        saveDataToFirebase();
        renderModalList();
    }
}
function saveProgress(isFinished) {
    if (scheduleData[currentKey]) {
        scheduleData[currentKey].isFinished = isFinished;
        saveDataToFirebase();
        const doneCount = scheduleData[currentKey].exercises.filter(e => e.completed).length;
        if(isFinished) alert(`เก่งมาก! คุณออกกำลังกายเสร็จสิ้นแล้ว (${doneCount} รายการ)`);
        else alert(`บันทึกความคืบหน้าเรียบร้อยแล้ว (${doneCount} รายการ)`);
        renderCalendar(); closeModal('exercise-modal');
    }
}
function deleteSchedule() {
    if (confirm("คุณแน่ใจไหมว่าจะลบตารางฝึกของวันนี้?")) {
        if (currentKey && scheduleData[currentKey]) {
            delete scheduleData[currentKey];
            saveDataToFirebase();
        }
        renderCalendar(); alert("ลบตารางเรียบร้อย!"); closeModal('exercise-modal');
    }
}
function renderTemplateList() {
    const container = document.getElementById('template-list');
    if(!container) return;
    container.innerHTML = '';
    if (userTemplates.length === 0) {
        container.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; padding: 40px 20px; color: #aaa;"><i class="fas fa-clipboard-list" style="font-size: 48px; margin-bottom: 15px; opacity: 0.3;"></i><p style="font-size: 1.1rem; margin: 0;">ยังไม่มีตารางที่คุณสร้างเอง</p><p style="font-size: 0.9rem; margin-top: 5px;">กดปุ่ม <span style="background:#e96b04; color:white; width:24px; height:24px; display:inline-flex; align-items:center; justify-content:center; border-radius:50%; font-size:0.8rem;"><i class="fas fa-plus"></i></span> ด้านบนเพื่อเริ่มสร้างได้เลยครับ</p></div>`;
        return;
    }
    userTemplates.forEach(temp => {
        let exerciseRows = temp.exercises.map(ex => `<div class="ex-row"><span><i class="fas fa-circle" style="font-size:6px; color:#f38020; margin-right:5px; vertical-align:middle;"></i> ${ex.name}</span><span>${ex.details}</span></div>`).join('');
        container.innerHTML += `<div class="workout-card"><div class="card-actions"><button class="action-btn btn-edit" onclick="editTemplate('${temp.id}')"><i class="fas fa-edit"></i> แก้ไข</button><button class="action-btn btn-del" onclick="deleteTemplate('${temp.id}')"><i class="fas fa-trash"></i> ลบ</button></div><div class="card-title"><i class="far fa-calendar-check"></i> ${temp.name}</div><div>${exerciseRows}</div></div>`;
    });
}
function deleteTemplate(id) {
    if(confirm("ยืนยันการลบตารางนี้ออกจากระบบ?")) {
        userTemplates = userTemplates.filter(t => t.id !== id);
        saveTemplatesToFirebase();
        renderTemplateList();
    }
}
function addNewTemplate() {
    editingTemplateId = null; tempExercises = [];
    document.getElementById('schedule-name').value = "";
    document.querySelector('.sub-header-text').innerText = "เพิ่มตารางออกกำลังกาย";
    document.querySelector('.btn-save-schedule').innerText = "บันทึกตาราง";
    showCreateView(); renderTempTable();
}
function editTemplate(id) {
    const template = userTemplates.find(t => t.id === id); 
    if (!template) return;
    editingTemplateId = id;
    document.getElementById('schedule-name').value = template.name;
    tempExercises = [];
    template.exercises.forEach(ex => {
        if (ex.details.includes('นาที')) {
            const timeMatch = ex.details.match(/(\d+) นาที/);
            const time = timeMatch ? parseInt(timeMatch[1]) : 30;
            tempExercises.push({ name: ex.name, type: 'cardio', time: time });
        } else {
            let rep=0, set=0, kg=0;
            const repMatch = ex.details.match(/(\d+)reps/); const setMatch = ex.details.match(/(\d+)sets/); const kgMatch = ex.details.match(/(\d+)kg/);
            if(repMatch) rep = parseInt(repMatch[1]); if(setMatch) set = parseInt(setMatch[1]); if(kgMatch) kg = parseInt(kgMatch[1]);
            tempExercises.push({ name: ex.name, type: 'weight', set: set, rep: rep, kg: kg });
        }
    });
    document.querySelector('.sub-header-text').innerText = "แก้ไขตารางออกกำลังกาย";
    document.querySelector('.btn-save-schedule').innerText = "บันทึกการแก้ไข";
    showCreateView(); renderTempTable();
}
function showCreateView() {
    document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
    document.getElementById('create-view').classList.add('active');
}
function saveNewSchedule() {
    const scheduleName = document.getElementById('schedule-name').value;
    const repeatDay = document.getElementById('repeat-day').value;
    const startDateVal = document.getElementById('start-date-input').value;
    const endDateVal = document.getElementById('end-date-input').value;
    if(scheduleName.trim() === "") { alert("กรุณาตั้งชื่อตาราง"); return; }
    if(tempExercises.length === 0) { alert("กรุณาเพิ่มท่าออกกำลังกาย"); return; }
    const formattedExercises = tempExercises.map(e => {
        let details = "";
        if (e.type === 'cardio') { details = `${e.time} นาที`; } else { details = `${e.rep}reps ${e.set}sets ${e.kg}kg`; }
        return { name: e.name, details: details, completed: false };
    });
    let templateToSave = null;
    if (editingTemplateId) {
        const index = userTemplates.findIndex(t => t.id === editingTemplateId);
        if(index !== -1) {
            userTemplates[index].name = scheduleName; userTemplates[index].exercises = formattedExercises;
            templateToSave = userTemplates[index];
        }
    } else {
        templateToSave = { id: 'custom_' + new Date().getTime(), name: scheduleName, exercises: formattedExercises };
        userTemplates.push(templateToSave);
    }
    saveTemplatesToFirebase();
    if (repeatDay !== "" && startDateVal && endDateVal) { addScheduleRange(repeatDay, startDateVal, endDateVal, templateToSave); }
    else if (repeatDay !== "") { alert("กรุณาระบุ 'วันเริ่มต้น' และ 'วันสิ้นสุด' ด้วยครับ"); return; }
    alert("บันทึกข้อมูลเรียบร้อย!"); editingTemplateId = null; switchTab('list'); 
}
function addScheduleRange(targetDayIndex, startStr, endStr, template) {
    let currentLoop = new Date(startStr);
    const endLoop = new Date(endStr);
    targetDayIndex = parseInt(targetDayIndex);
    let countAdded = 0;
    while (currentLoop <= endLoop) {
        if (currentLoop.getDay() === targetDayIndex) {
            const y = currentLoop.getFullYear(); const m = String(currentLoop.getMonth() + 1).padStart(2, '0'); const d = String(currentLoop.getDate()).padStart(2, '0');
            const dateKey = `${y}-${m}-${d}`;
            scheduleData[dateKey] = JSON.parse(JSON.stringify(template));
            scheduleData[dateKey].isFinished = false;
            countAdded++;
        }
        currentLoop.setDate(currentLoop.getDate() + 1);
    }
    saveDataToFirebase();
}
function addManualExercise() {
    const name = document.getElementById('input-ex-name').value.trim();
    const set = document.getElementById('input-ex-set').value;
    const rep = document.getElementById('input-ex-rep').value;
    const kg = document.getElementById('input-ex-kg').value;
    if (name === "" || set === "" || rep === "") { alert("กรอกข้อมูลไม่ครบ"); return; }
    const isCardio = allExercisesDB.includes(name) && ["Treadmill (Running)", "Treadmill (Walking)", "Cycling", "Elliptical", "Stair Master", "Rowing Machine"].some(c => name.includes(c));
    if (isCardio) { const timeVal = set || 30; tempExercises.push({ name: name, type: 'cardio', time: parseInt(timeVal) }); } 
    else { tempExercises.push({ name: name, type: 'weight', set: parseInt(set), rep: parseInt(rep), kg: kg ? parseInt(kg) : 0 }); }
    document.getElementById('input-ex-name').value = ""; document.getElementById('input-ex-set').value = ""; document.getElementById('input-ex-rep').value = ""; document.getElementById('input-ex-kg').value = "";
    renderTempTable();
}
function renderTempTable() {
    const tbody = document.getElementById('added-exercise-list'); tbody.innerHTML = "";
    tempExercises.forEach((item, index) => {
        let detailsHtml = "";
        if (item.type === 'cardio') { detailsHtml = `<td colspan="3" style="color:#f38020; font-weight:bold;">${item.time} นาที</td>`; } 
        else { detailsHtml = `<td>${item.set}</td><td>${item.rep}</td><td>${item.kg}kg</td>`; }
        tbody.innerHTML += `<tr><td><i class="fas fa-times btn-del-row" onclick="removeTempExercise(${index})"></i> ${item.name}</td>${detailsHtml}</tr>`;
    });
}
function removeTempExercise(index) { tempExercises.splice(index, 1); renderTempTable(); }

// ==========================================
// 8. Universal Modal & Data (Slider - โหลดจาก Firebase)
// ==========================================
let currentMuscleList = []; 
let currentSlideIndex = 0; 
let currentMuscleGroupKey = ''; // เก็บหมวดหมู่ปัจจุบัน (เพื่อส่งต่อให้ Admin)

function openMuscleModal(muscleKey) {
    const data = muscleData[muscleKey];
    if (!data) { alert("ยังไม่มีข้อมูลท่าฝึกในหมวดนี้"); return; }

    currentMuscleGroupKey = muscleKey; // ✅ จำหมวดหมู่ที่เปิดอยู่

    document.getElementById('muscle-modal-title').innerText = data.title;
    currentMuscleList = data.exercises || [];
    currentSlideIndex = 0; 
    
    // 🔥 เช็คว่าเป็น Admin ไหม -> ถ้าใช่ ให้โชว์ปุ่มเพิ่มท่าใน Modal
    if(isAdminUser) {
        document.getElementById('btn-admin-in-modal').style.display = 'block';
    } else {
        document.getElementById('btn-admin-in-modal').style.display = 'none';
    }

    const btns = document.querySelectorAll('.nav-btn');
    if (currentMuscleList.length <= 1) { btns.forEach(b => b.classList.add('hidden')); } 
    else { btns.forEach(b => b.classList.remove('hidden')); }

    renderCurrentSlide(muscleKey);
    document.getElementById('universalModal').style.display = 'flex';
}
function moveSlide(direction) {
    currentSlideIndex += direction;
    if (currentSlideIndex >= currentMuscleList.length) { currentSlideIndex = 0; } 
    else if (currentSlideIndex < 0) { currentSlideIndex = currentMuscleList.length - 1; }
    const title = document.getElementById('muscle-modal-title').innerText;
    const isCardio = title.includes("Cardio") || title.includes("คาร์ดิโอ");
    renderCurrentSlide(isCardio ? 'cardio' : 'weight');
}
function renderCurrentSlide(typeCheck) {
    const slider = document.getElementById('universalSlider');
    const counter = document.getElementById('slide-counter'); 
    if(counter) { counter.innerText = `${currentSlideIndex + 1}/${currentMuscleList.length}`; }
    const ex = currentMuscleList[currentSlideIndex];
    if(!ex) return; 

    const imgSrc = ex.img;
    let inputsHtml = "";
    const isCardio = (typeCheck === 'cardio');
    if (isCardio) { inputsHtml = `<div class="input-row"><input type="number" class="input-time" placeholder="นาที (mins)" style="width: 100px;"></div>`; } 
    else { inputsHtml = `<div class="input-row"><input type="number" class="input-set" placeholder="Set"><input type="number" class="input-rep" placeholder="Rep"><input type="number" class="input-kg" placeholder="Kg"></div>`; }
    
    slider.innerHTML = `<div class="exercise-card" data-type="${isCardio ? 'cardio' : 'weight'}"><img src="${imgSrc}" alt="${ex.name}" onerror="this.src='https://placehold.co/400x300?text=No+Image'"><h3>${ex.name}</h3>${inputsHtml}<button class="add-btn" onclick="addFromCard(this)">เพิ่ม</button></div>`;
}
function closeModal(modalId) {
    if(modalId) { document.getElementById(modalId).style.display = 'none'; } 
    else { document.getElementById('exercise-modal').style.display = 'none'; }
}
function addFromCard(btn) {
    const card = btn.closest('.exercise-card');
    const name = card.querySelector('h3').innerText;
    const type = card.getAttribute('data-type'); 
    if (type === 'cardio') {
        const timeVal = card.querySelector('.input-time').value;
        if(timeVal === '') { alert("กรุณาระบุเวลา (นาที)"); return; }
        tempExercises.push({ name: name, type: 'cardio', time: parseInt(timeVal) });
    } else {
        const setVal = card.querySelector('.input-set').value;
        const repVal = card.querySelector('.input-rep').value;
        const kgVal = card.querySelector('.input-kg').value;
        if(setVal === '' || repVal === '') { alert("กรุณากรอก Set และ Rep"); return; }
        tempExercises.push({ name: name, type: 'weight', set: parseInt(setVal), rep: parseInt(repVal), kg: kgVal ? parseInt(kgVal) : 0 });
    }
    renderTempTable(); closeModal('universalModal');
}
function openSummaryModal() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    let totalExercises = 0;
    let completedExercises = 0;
    for (const [dateKey, data] of Object.entries(scheduleData)) {
        const [dYear, dMonth, dDay] = dateKey.split('-').map(Number);
        if (dYear === year && (dMonth - 1) === month) {
            if (data.isFinished === true && data.exercises && Array.isArray(data.exercises)) {
                totalExercises += data.exercises.length;
                const done = data.exercises.filter(ex => ex.completed).length;
                completedExercises += done;
            }
        }
    }
    let percentage = 0;
    if (totalExercises > 0) { percentage = Math.round((completedExercises / totalExercises) * 100); }
    const circle = document.getElementById('summary-progress-circle');
    const text = document.getElementById('summary-percent-text');
    if (circle && text) {
        circle.style.background = `conic-gradient(#e96b04 ${percentage * 3.6}deg, #eee 0deg)`;
        text.innerText = `${percentage}%`;
    }
    const countText = document.getElementById('summary-text-count');
    if (countText) { countText.innerHTML = `คุณทำสำเร็จ <b style="color:#e96b04;">${completedExercises}</b> ท่า จากทั้งหมด <b>${totalExercises}</b> ท่า`; }
    document.getElementById('summaryModal').style.display = 'flex';
}
function openHistoryModal() {
    const historyContainer = document.getElementById('history-list-container');
    if (!historyContainer) return;
    historyContainer.innerHTML = "";
    const sortedKeys = Object.keys(scheduleData).sort((a, b) => new Date(b) - new Date(a)); 
    if (sortedKeys.length === 0) {
        historyContainer.innerHTML = "<p style='text-align:center; color:#888; margin-top:20px;'>ยังไม่มีประวัติการฝึก</p>";
        document.getElementById('historyModal').style.display = 'flex';
        return;
    }
    let currentGroup = "";
    sortedKeys.forEach(key => {
        const data = scheduleData[key];
        const dateObj = new Date(key);
        const monthName = monthNames[dateObj.getMonth()];
        const yearBE = dateObj.getFullYear() + 543;
        const groupLabel = `${monthName} ${yearBE}`;
        if (groupLabel !== currentGroup) {
            historyContainer.innerHTML += `<div class="history-month-title">${groupLabel}</div>`;
            currentGroup = groupLabel;
        }
        const day = dateObj.getDate();
        const isDone = data.isFinished === true;
        const statusClass = isDone ? 'status-done' : 'status-pending';
        const statusText = isDone ? 'เสร็จสิ้น' : 'รอดำเนินการ';
        historyContainer.innerHTML += `<div class="history-item"><div><div class="history-date">วันที่ ${day}</div><div class="history-name">${data.name}</div></div><span class="history-status ${statusClass}">${statusText}</span></div>`;
    });
    document.getElementById('historyModal').style.display = 'flex';
}
function exportData() {
    const backupData = { schedule: scheduleData, templates: userTemplates };
    const dataStr = JSON.stringify(backupData, null, 2); 
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url; a.download = `Gym_Backup_${currentUsername}_${dateStr}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}
function importData(inputElement) {
    const file = inputElement.files[0];
    if (!file) return;
    if (!confirm("⚠️ คำเตือน: การกู้คืนข้อมูลจะทับข้อมูลปัจจุบันบน Cloud ทั้งหมด\nคุณแน่ใจหรือไม่?")) { inputElement.value = ''; return; }
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data.schedule) scheduleData = data.schedule;
            if (data.templates) userTemplates = data.templates;
            saveDataToFirebase(); saveTemplatesToFirebase();
            alert("✅ กู้คืนข้อมูลสำเร็จ! ระบบจะรีเฟรชหน้าเว็บ"); window.location.reload(); 
        } catch (error) { alert("❌ ไฟล์ไม่ถูกต้อง หรือเกิดข้อผิดพลาด"); console.error(error); }
    };
    reader.readAsText(file);
}
function exportToPDF() {
    const content = document.createElement('div');
    
    // 🔥 1. บังคับความกว้างให้พอดี A4 (ประมาณ 800px) และรีเซ็ตพื้นหลัง
    content.style.width = '100%px';
    content.style.padding = '20px';
    content.style.backgroundColor = '#ffffff'; 
    content.style.fontFamily = 'Sarabun, sans-serif';

    // 🔥 2. จัดระเบียบ HTML: ใช้ style แบบ inline เพื่อบังคับระยะห่างให้เป๊ะที่สุด
    let html = `
        <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color:#e96b04; margin: 0 0 5px 0; padding: 0; line-height: 1;">ตารางออกกำลังกาย</h1>
            <h3 style="color:#333; margin: 0 0 5px 0; padding: 0;">ของ: ${currentUsername}</h3>
            <p style="color:#666; margin: 0; font-size: 0.9rem;">พิมพ์เมื่อ: ${new Date().toLocaleDateString('th-TH')}</p>
        </div>
        <hr style="border: 0; border-top: 1px solid #ddd; margin-bottom: 20px;">
    `;

    userTemplates.forEach((temp, index) => {
        html += `<div style="margin-bottom: 20px; border: 1px solid #eee; border-radius: 8px; padding: 15px; background: #fff; page-break-inside: avoid;">
            <h3 style="margin: 0 0 10px 0; color: #e96b04; font-size: 1.1rem;">${index + 1}. ${temp.name}</h3>
            <table style="width:100%; border-collapse: collapse; font-size: 0.9rem;">
                <tr style="background:#f9f9f9; text-align:left;">
                    <th style="padding:8px; border-bottom:1px solid #ddd; width: 40%;">ท่าฝึก</th>
                    <th style="padding:8px; border-bottom:1px solid #ddd;">รายละเอียด</th>
                </tr>`;
        
        temp.exercises.forEach(ex => { 
            html += `<tr>
                <td style="padding:8px; border-bottom:1px solid #eee;">${ex.name}</td>
                <td style="padding:8px; border-bottom:1px solid #eee;">${ex.details}</td>
            </tr>`; 
        });
        
        html += `</table></div>`;
    });

    content.innerHTML = html;

    // 🔥 3. การตั้งค่าสำคัญ (Config)
    const opt = { 
        margin: [10, 10, 10, 10], // ขอบกระดาษ (บน, ซ้าย, ล่าง, ขวา) หน่วย mm
        filename: `Fitness_Plan_${currentUsername}.pdf`, 
        image: { type: 'jpeg', quality: 0.98 }, 
        html2canvas: { 
            scale: 2, 
            useCORS: true, 
            scrollY: 0  // 👈 พระเอกขี่ม้าขาว! สั่งให้เริ่มจับภาพที่จุดบนสุดเสมอ (แก้ปัญหาหัวกระดาษว่าง)
        }, 
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } 
    };

    // สร้าง PDF
    html2pdf().set(opt).from(content).save().then(() => { 
        alert("ดาวน์โหลด PDF เรียบร้อยครับ! 📄"); 
    });
}
let timerInterval = null; let timeLeft = 60; 
function startRestTimer(duration) {
    timeLeft = duration; updateTimerDisplay(); document.getElementById('timerModal').style.display = 'flex';
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => { timeLeft--; updateTimerDisplay(); if (timeLeft <= 0) { clearInterval(timerInterval); playBeep(); } }, 1000);
}
function stopTimer() { if (timerInterval) clearInterval(timerInterval); document.getElementById('timerModal').style.display = 'none'; }
function adjustTimer(seconds) { timeLeft += seconds; if (timeLeft < 0) timeLeft = 0; updateTimerDisplay(); }
function updateTimerDisplay() {
    const mins = Math.floor(timeLeft / 60); const secs = timeLeft % 60;
    const display = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    const el = document.getElementById('timer-display'); if(el) el.innerText = display;
}
function playBeep() {
    const AudioContext = window.AudioContext || window.webkitAudioContext; if (!AudioContext) return;
    const ctx = new AudioContext(); const osc = ctx.createOscillator(); const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination); osc.type = "sine"; osc.frequency.value = 880; gain.gain.value = 0.1;
    osc.start(); setTimeout(() => osc.stop(), 500); 
}
function clearAllData() {
    if(confirm("⚠️ อันตราย! ข้อมูลตารางฝึกและประวัติทั้งหมดจะหายไป\nคุณต้องการเริ่มใหม่ทั้งหมดใช่หรือไม่?")) {
        db.ref('users/' + currentUsername + '/schedule').remove();
        db.ref('users/' + currentUsername + '/templates').remove();
        alert("ล้างข้อมูลเรียบร้อย!"); window.location.reload();
    }
}

// ==========================================
// 9. 🔥 ส่วนเสริม: ปุ่มล้างข้อมูล (Add-on) 🔥
// ==========================================

// ฟังก์ชันสำหรับสร้างปุ่ม "ล้างข้อมูล" แทรกเข้าไปในหน้าจออัตโนมัติ
function setupClearButtonUI() {
    // หาปุ่ม "ประวัติย้อนหลัง" เพื่อจะเอาปุ่มล้างข้อมูลไปวางข้างๆ
    const historyBtn = document.querySelector('.btn-history');

    // ถ้าเจอปุ่มประวัติ และยังไม่มีปุ่มล้างข้อมูล ให้สร้างใหม่
    if (historyBtn && historyBtn.parentNode && !document.querySelector('.btn-clear-data')) {
        
        const clearBtn = document.createElement('button');
        clearBtn.innerHTML = '<i class="fas fa-trash-alt"></i> ล้างข้อมูล';
        clearBtn.className = 'btn-clear-data'; // ตั้งชื่อ class
        
        // 🎨 ตกแต่งปุ่มด้วย JavaScript (จะได้ไม่ต้องแก้ CSS)
        Object.assign(clearBtn.style, {
            backgroundColor: '#ff4d4d', // สีแดง
            color: 'white',
            border: 'none',
            padding: '10px 15px',
            borderRadius: '30px',
            cursor: 'pointer',
            marginLeft: '10px',
            fontWeight: 'bold',
            fontSize: '14px',
            boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
            transition: 'all 0.3s ease'
        });

        // Effect ตอนเอาเมาส์ชี้
        clearBtn.onmouseover = () => { clearBtn.style.backgroundColor = '#cc0000'; };
        clearBtn.onmouseout = () => { clearBtn.style.backgroundColor = '#ff4d4d'; };

        // ผูกฟังก์ชันเมื่อกดปุ่ม
        clearBtn.onclick = clearAllData;

        // แทรกปุ่มเข้าไปต่อจากปุ่มประวัติ
        historyBtn.parentNode.insertBefore(clearBtn, historyBtn.nextSibling);
    }
}

// สั่งให้สร้างปุ่มเมื่อโหลดหน้าเว็บเสร็จ
document.addEventListener('DOMContentLoaded', () => {
    setupClearButtonUI();
});

// 🗑️ ฟังก์ชันล้างข้อมูล (อัปเกรดจากของเดิม)
// - ถามยืนยัน 2 รอบ
// - ลบข้อมูลทั้ง Schedule และ Templates (หรือเลือกได้)
function clearAllData() {
    // ถามรอบที่ 1
    if(!confirm("⚠️ คำเตือน!\n\nคุณต้องการล้างข้อมูล 'ตารางฝึก' และ 'ประวัติ' ทั้งหมดหรือไม่?\n(ข้อมูลจะหายไปถาวรและกู้คืนไม่ได้)")) {
        return;
    }

    // ถามรอบที่ 2 (เพื่อความชัวร์)
    if(!confirm("⛔️ ยืนยันครั้งสุดท้าย?\n\nกด 'ตกลง' เพื่อลบข้อมูลทั้งหมดเดี๋ยวนี้")) {
        return;
    }

    // เริ่มลบข้อมูลใน Firebase
    // 1. ลบตารางฝึกและประวัติ (Schedule)
    db.ref('users/' + currentUsername + '/schedule').remove()
    .then(() => {
        // 2. ลบตารางที่บันทึกไว้ (Templates) - ถ้าไม่อยากลบ Template ให้ใส่ // หน้าบรรทัดด้านล่างนี้ครับ
        return db.ref('users/' + currentUsername + '/templates').remove();
    })
    .then(() => {
        alert("✅ ล้างข้อมูลเรียบร้อยแล้วครับ ระบบจะรีเฟรชใหม่");
        window.location.reload(); // รีเฟรชหน้าจอ
    })
    .catch((error) => {
        alert("❌ เกิดข้อผิดพลาด: " + error.message);
    });
}