import { database, ref, push, remove, onValue } from './firebase-config.js';

let selectedMember = 'joao';
const memberBtns = document.querySelectorAll('.member-btn');
const daySelect = document.getElementById('day-select');
const titleInput = document.getElementById('event-title');
const timeStart = document.getElementById('time-start');
const timeEnd = document.getElementById('time-end');
const descInput = document.getElementById('event-desc');
const btnSend = document.getElementById('btn-send');
const btnClear = document.getElementById('btn-clear');
const listInput = document.getElementById('list-input');
const btnAddList = document.getElementById('btn-add-list');

const diasMap = { 
    "1": "segunda", 
    "2": "terça", 
    "3": "quarta", 
    "4": "quinta", 
    "5": "sexta", 
    "6": "sábado", 
    "0": "domingo" 
};

// 1. OUVIR O CLIMA DA BOX (TV Status)
onValue(ref(database, 'hub/weather'), (snap) => {
    const data = snap.val();
    if (data) {
        document.getElementById('aw-temp').textContent = data.temp;
        document.getElementById('aw-desc').textContent = data.desc;
        // Icon code do OpenWeather enviado pela BOX
        document.getElementById('aw-icon').innerHTML = `<img src="https://openweathermap.org/img/wn/${data.icon}.png" width="30" style="vertical-align:middle;">`;
    }
});

// Setup Initial Day
const dHoje = new Date().getDay().toString();
daySelect.value = dHoje;

// Seletor de Membros
memberBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        memberBtns.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedMember = btn.getAttribute('data-val');
    });
});

// ISO Parser Bridge p/ Grelha da TV
function getDateForDay(targetDayJS) {
    const today = new Date();
    const currentDay = today.getDay(); 
    let diff = targetDayJS - currentDay;
    if (currentDay === 0 && targetDayJS !== 0) { diff -= 7; } 
    if (targetDayJS === 0 && currentDay !== 0) { diff += 7; }
    
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + diff);
    return targetDate.toISOString().split('T')[0];
}

// 2. ENVIAR PARA O CALENDÁRIO GRELHA
btnSend.addEventListener('click', async () => {
    const rawTitle = titleInput.value.trim();
    if (!rawTitle || !timeStart.value) {
        alert("⚠️ Escreva um Título e a Hora de início!");
        return;
    }

    const dayValue = daySelect.value;
    const dayNome = diasMap[dayValue];
    const targetDateIso = getDateForDay(parseInt(dayValue));

    let timeString = timeStart.value;
    if (timeEnd.value) timeString += ` - ${timeEnd.value}`;
    const combinedTitle = `${timeString} ${rawTitle}`;

    // Payload Mestre p/ a BOX (Conforme Prompt e Compatibilidade UI)
    const payload = {
        user: selectedMember,   
        member: selectedMember, // Ponte com o UI Render Box
        day: dayNome,
        date: targetDateIso,    // Ponte absoluta do dia na grelha 
        title: combinedTitle,   
        time: timeString,       
        desc: descInput.value.trim(),
        timestamp: Date.now() 
    };

    try {
        const tasksRef = ref(database, 'hub/tasks');
        await push(tasksRef, payload);
        
        const originalText = btnSend.textContent;
        btnSend.textContent = "✅ Na Agenda!";
        btnSend.classList.add('success');
        
        titleInput.value = '';
        descInput.value = '';
        timeStart.value = '';
        timeEnd.value = '';
        
        setTimeout(() => {
            btnSend.textContent = originalText;
            btnSend.classList.remove('success');
        }, 2000);
        
    } catch (err) {
        console.error("Erro a comunicar com Firebase:", err);
        alert("Falha de rede (Firebase).");
    }
});

// 3. ENVIAR PARA LISTA COMPRAS/TAREFAS
btnAddList.addEventListener('click', async () => {
    const text = listInput.value.trim();
    if (!text) return;
    
    try {
        const listsRef = ref(database, 'hub/lists');
        await push(listsRef, {
            text: text,
            title: text,
            timestamp: Date.now()
        });
        
        listInput.value = '';
        const oi = btnAddList.textContent;
        btnAddList.textContent = '✔️';
        btnAddList.classList.add('success');
        
        setTimeout(() => {
            btnAddList.textContent = oi;
            btnAddList.classList.remove('success');
        }, 1500);
    } catch (err) {
        alert("Falha ao partilhar na Lista!");
    }
});

// 4. LIMPAR A GRELHA (Admin Danger Zone)
btnClear.addEventListener('click', async () => {
    if (confirm("🚨 TEM A CERTEZA? Isto apaga todos os cartões da Box Xiaomi.")) {
        try {
            await remove(ref(database, 'hub/tasks'));
            alert("🧹 Carregado! A Mi Box apagou tudo na retaguarda.");
        } catch (err) {
            console.error(err);
        }
    }
});
