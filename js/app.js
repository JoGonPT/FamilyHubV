import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, onValue, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { stores, getAllFromStore, saveAllToStore, cleanOldData, initDB } from "./db.js";

const firebaseConfig = {
    apiKey: "AIzaSyDFwECdwELB_wPHR_9rkkY9MRcNBjQSUks",
    authDomain: "viaz-1e406.firebaseapp.com",
    databaseURL: "https://viaz-1e406-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "viaz-1e406",
    storageBucket: "viaz-1e406.firebasestorage.app",
    messagingSenderId: "73407200033",
    appId: "1:73407200033:web:ba4a55ff672252e2645c60"
};
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// ============================================
// 1. RELÓGIO & PROGRESS BAR (TOP & RIGHT)
// ============================================
function updateClock() {
    const now = new Date();
    document.getElementById('clock-digital').innerText = now.toLocaleTimeString('pt-PT', {hour: '2-digit', minute:'2-digit'});
    document.getElementById('date-display').innerText = now.toLocaleDateString('pt-PT', {weekday: 'long', day: 'numeric', month: 'long'});
    
    // Progress Bar Vertical (0h às 24h)
    const minutesPassed = (now.getHours() * 60) + now.getMinutes();
    const percent = (minutesPassed / 1440) * 100;
    document.getElementById('vertical-progress-bar').style.height = `${percent}%`;

    // Modo Noite (Escurecer TV das 23h às 07h para poupar olhos/ecrã)
    if(now.getHours() >= 23 || now.getHours() < 7) document.body.classList.add('night-mode');
    else document.body.classList.remove('night-mode');
}
setInterval(updateClock, 10000); updateClock(); // Começa logo

// ============================================
// 2. SISTEMA DE MI BOX D-PAD (HARDWARE ROTATED)
// ============================================
let focusables = [];
let currentIndex = 0;

function refreshFocusableElements() {
    focusables = Array.from(document.querySelectorAll('.focusable:not([style*="display: none"])'));
    if(focusables.length > 0 && !document.querySelector('.focused')) {
        focusables[currentIndex]?.classList.add('focused');
    }
}

window.addEventListener('keydown', async (e) => {
    /* 
       A TV está deitada fisicamente na parede. Logo as setas do comando Mi Box
       batem de lado. Ajustamos aqui o Mapeamento da Rotação (+90 graus assumidos):
       Se a TV rola 90 graus para a Direita, o cérebro dela julga que:
       - Clicar "Esquerda" no comando, manda ela na verdade ir para Cima
       - Clicar "Direita" no comando, manda ela ir para Baixo
       - Clicar "Acima", manda ir para Esquerda na interface
       - Clicar "Baixo", manda ir para Direita
    */
    
    let action = '';
    // ArrowLeft física do comando = Sobe o Foco na TV Girada
    if(e.code === 'ArrowLeft' || e.keyCode === 37) action = 'UP';      
    // ArrowRight física do comando = Desce o Foco
    else if(e.code === 'ArrowRight' || e.keyCode === 39) action = 'DOWN';
    // ArrowUp física do comando = Entra no Menu Lateral (Esquerda na perspetiva real)
    else if(e.code === 'ArrowUp' || e.keyCode === 38) action = 'LEFT';
    // ArrowDown física do comando = Vai para o Ecrã Principal (Direita)
    else if(e.code === 'ArrowDown' || e.keyCode === 40) action = 'RIGHT';
    // Botão Central do Comando (OK)
    else if(e.code === 'Enter' || e.keyCode === 13) action = 'ENTER';

    if(!action) return;
    refreshFocusableElements();

    if(['UP', 'DOWN', 'LEFT', 'RIGHT'].includes(action)) {
        if(focusables.length === 0) return;
        focusables[currentIndex]?.classList.remove('focused');

        if(action === 'DOWN') currentIndex = (currentIndex + 1) % focusables.length;
        if(action === 'UP') currentIndex = (currentIndex - 1 + focusables.length) % focusables.length;
        
        // Pulos rápidos Esquerda / Direita entre a grelha e a barra lateral
        if(action === 'LEFT') {
            const sideBtn = focusables.findIndex(f => f.classList.contains('nav-btn'));
            if(sideBtn !== -1) currentIndex = sideBtn;
        }
        if(action === 'RIGHT') {
            const mainEl = focusables.findIndex(f => !f.classList.contains('nav-btn'));
            if(mainEl !== -1) currentIndex = mainEl;
        }

        focusables[currentIndex]?.classList.add('focused');
        focusables[currentIndex]?.scrollIntoView({behavior: 'smooth', block: 'center'});
    }

    if(action === 'ENTER') {
        const el = focusables[currentIndex];
        if(!el) return;

        if(el.classList.contains('nav-btn')) {
             document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
             document.querySelectorAll('.spa-view').forEach(v=>v.classList.remove('active'));
             el.classList.add('active');
             document.getElementById(el.getAttribute('data-target')).classList.add('active');
             refreshFocusableElements();
        } 
        else if(el.hasAttribute('data-action')) {
             const act = el.getAttribute('data-action');
             const id = el.getAttribute('data-id');
             if(!id) return;

             el.style.transform = 'scale(0.9)'; // Anima Click
             setTimeout(async () => {
                 let nodeMap = {
                     'delete-task': 'hub/tasks',
                     'delete-meal': 'hub/meals',
                     'delete-list': 'hub/shoppingList',
                     'delete-event': 'hub/calendar'
                 };
                 if(nodeMap[act]) {
                     try { await remove(ref(database, `${nodeMap[act]}/${id}`)); } catch(e){}
                 }
             }, 300);
        }
    }
});

// ============================================
// 3. LOGICA DO CALENDÁRIO COM LIMITE NOEL
// ============================================
const currentDayIndex = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1; // 0=Seg, 6=Dom

async function renderCalendar() {
    const events = await getAllFromStore(stores.CALENDAR);
    const grid = document.getElementById('calendar-grid');
    if(!grid) return;
    grid.innerHTML = '';

    const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];
    
    // Layout Separado (5 dias úteis seguidos) + (FDS em paralelo no fundo)
    const upperContainer = document.createElement('div');
    upperContainer.style.display = 'flex'; upperContainer.style.flexDirection = 'column';
    upperContainer.style.flex = '5'; upperContainer.style.gap = '10px';

    const weekendContainer = document.createElement('div');
    weekendContainer.className = 'weekend-container';

    days.forEach((day, idx) => {
        const isToday = idx === currentDayIndex;
        const shortName = day.substring(0,3);
        const row = document.createElement('div');
        row.className = idx < 5 ? 'grid-row' : 'weekend-row';
        if(isToday) row.classList.add('row-today');

        row.innerHTML = `<div class="day-info">
                            <div class="day-name">${idx < 5 ? day : shortName}</div>
                            <div class="day-number" style="color:${isToday ? 'var(--color-alice)' : ''}">${isToday ? 'Hoje' : ''}</div>
                         </div>
                         <div class="day-events" id="evt-col-${idx}"></div>`;
                         
        if(idx < 5) upperContainer.appendChild(row);
        else weekendContainer.appendChild(row);
    });

    grid.appendChild(upperContainer);
    grid.appendChild(weekendContainer);

    // Injetar Eventos baseados num parse estático do Dia da Semana (0-6)
    // Para efeito de demonstração do logic Noel, usamos 'isNoel' ou match com animal
    events.forEach(ev => {
        const d = new Date(ev.date || ev.createdAt); // Se não tiver Data fixa usa createdAt
        let dayIdx = d.getDay() === 0 ? 6 : d.getDay() - 1;
        
        const col = document.getElementById(`evt-col-${dayIdx}`);
        if(col) {
            const card = document.createElement('div');
            const isNoelTask = ev.isNoel || ev.member === 'noel';
            card.className = `event-card card-${ev.member} focusable`;
            card.setAttribute('data-action', 'delete-event');
            card.setAttribute('data-id', ev.id);
            card.setAttribute('tabindex', '0'); // Safety nativo
            
            card.innerHTML = `<span class="ev-title">${isNoelTask ? '🐾 ' : ''}${ev.title}</span>
                              <span class="ev-desc">${ev.time||'O Dia Todo'}</span>`;
            col.appendChild(card);
        }
    });

    refreshFocusableElements();
}

// Genérico Listas
async function renderSimpleList(storeName, domId, icon, actionType) {
    const items = await getAllFromStore(storeName);
    const list = document.getElementById(domId);
    if(!list) return;
    list.innerHTML = '';
    
    if(items.length === 0) return list.innerHTML = '<li style="opacity:0.3; padding:20px;">Lista Limpa!</li>';

    items.forEach(it => {
        const li = document.createElement('li');
        li.className = 'list-item focusable';
        li.setAttribute('data-action', actionType);
        li.setAttribute('data-id', it.id);
        
        let title = it.title || it.name || it.text;
        li.innerHTML = `${icon} <span style="margin-left:10px;">${title}</span>`;
        if(storeName === stores.MEALS && it.type) li.innerHTML += ` <span style="font-size:0.9rem; opacity:0.5; margin-left:10px;">(${it.type})</span>`;
        
        list.appendChild(li);
    });
    
    // Meter Restaurante/Next meal no Footer
    if(storeName === stores.MEALS && items.length > 0) {
        document.getElementById('next-meal-footer').innerText = items[0].name || items[0].title;
    }

    refreshFocusableElements();
}

// ============================================
// 4. ENGINE BOOT (Cache 60 dias + Live Sync)
// ============================================
async function boot() {
    await initDB(); 
    cleanOldData(); 
    // Render Offline Rápido Mão-De-Ferro
    renderCalendar();
    renderSimpleList(stores.TASKS, 'tasks-list', '✅', 'delete-task');
    renderSimpleList(stores.MEALS, 'meals-list', '🍽️', 'delete-meal');
    renderSimpleList(stores.LISTS, 'shopping-list', '📋', 'delete-list');
    
    // Liga os Reatores ao Firebase Vivo
    onValue(ref(database, 'hub/calendar'), async (snap) => { await saveAllToStore(stores.CALENDAR, snap.val()); renderCalendar(); });
    onValue(ref(database, 'hub/tasks'), async (snap) => { await saveAllToStore(stores.TASKS, snap.val()); renderSimpleList(stores.TASKS, 'tasks-list', '✅', 'delete-task');});
    onValue(ref(database, 'hub/meals'), async (snap) => { await saveAllToStore(stores.MEALS, snap.val()); renderSimpleList(stores.MEALS, 'meals-list', '🍽️', 'delete-meal'); });
    onValue(ref(database, 'hub/shoppingList'), async (snap) => { await saveAllToStore(stores.LISTS, snap.val()); renderSimpleList(stores.LISTS, 'shopping-list', '📋', 'delete-list'); });
}
boot();
