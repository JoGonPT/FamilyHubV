import { database, ref, onValue, remove, set } from './firebase-config.js';
import { initDB, stores, saveAllToStore, getAllFromStore, cleanOldData } from './db.js';

// ===============================================
// SPA - Renderização Separada de Módulos
// Hub / Xiaomi Box App
// ===============================================

const members = ['joao', 'paula', 'alice', 'noel'];
let currentWeekOffset = 0; 

// ---- SECÇÃO: Layout TV / Widgets ----
function updateClockDate() {
    const now = new Date();
    document.getElementById('clock-digital').textContent = now.toLocaleTimeString('pt-PT', {hour:'2-digit', minute:'2-digit'});
    document.getElementById('date-display').textContent = now.toLocaleDateString('pt-PT', {weekday: 'long', day:'numeric', month:'long'});
    
    // Auto Night Mode (Ultra-Clean)
    if (now.getHours() >= 23 || now.getHours() < 7) {
        document.body.classList.add('night-mode');
    } else {
        document.body.classList.remove('night-mode');
    }
}
setInterval(updateClockDate, 20000); 
updateClockDate();

// Weather Fetcher & Relayer
const WEATHER_API_KEY = "38ad7d8f80a3cb8e1478dc8f198d1bd8";
const CITY = "Maia,PT";

async function fetchWeather() {
    try {
        const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${CITY}&appid=${WEATHER_API_KEY}&units=metric&lang=pt`);
        const data = await response.json();
        
        if (data.main) {
            const tempStr = `${Math.round(data.main.temp)}°C`;
            const iconCode = data.weather[0].icon;
            
            document.getElementById('temperature').textContent = tempStr;
            document.getElementById('weather-icon').innerHTML = `<img src="https://openweathermap.org/img/wn/${iconCode}.png" alt="*">`;
            
            set(ref(database, 'hub/weather'), {
                temp: tempStr,
                icon: iconCode,
                desc: data.weather[0].description,
                timestamp: Date.now()
            }).catch(e => false);
        }
    } catch (e) {}
}
fetchWeather();
setInterval(fetchWeather, 1800000); 

// SPA Navegação
const navBtns = document.querySelectorAll('.nav-btn');
const views = document.querySelectorAll('.spa-view');

navBtns.forEach(btn => {
    btn.setAttribute('tabindex', '0'); 
    btn.addEventListener('click', () => {
        navBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        const targetId = btn.getAttribute('data-target');
        views.forEach(v => v.classList.remove('active'));
        document.getElementById(targetId).classList.add('active');
    });
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const activeElem = document.activeElement;
        if (activeElem && (activeElem.classList.contains('nav-btn') || activeElem.classList.contains('event-card') || activeElem.classList.contains('interactive-list-elem'))) {
            activeElem.click();
        }
    }
});

// Fundo Sólido (Sem Slideshow de Imagens)


// ===============================================
// RENDERIZAÇÕES ISOLADAS PARA CADA NÓ
// ===============================================

// ---- 1. CALENDÁRIO (Render na Grelha) ----
function renderGridSkeleton() {
    const gridBody = document.getElementById('calendar-grid');
    gridBody.innerHTML = '';
    
    const today = new Date();
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
    const startOfWeek = new Date(d.setDate(diff));
    
    startOfWeek.setDate(startOfWeek.getDate() + (currentWeekOffset * 7));
    
    const weekLabel = document.getElementById('week-label');
    if (currentWeekOffset === 0) weekLabel.textContent = "Esta Semana";
    else if (currentWeekOffset === -1) weekLabel.textContent = "Semana Passada";
    else if (currentWeekOffset === 1) weekLabel.textContent = "Próxima Semana";
    else weekLabel.textContent = `A partir de ${startOfWeek.getDate()}`;

    const daysShort = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

    for (let i = 0; i < 7; i++) {
        const currentDate = new Date(startOfWeek);
        currentDate.setDate(currentDate.getDate() + i);
        const isoDate = currentDate.toISOString().split('T')[0];
        
        const row = document.createElement('div'); row.className = 'grid-row';
        const dayDiv = document.createElement('div'); dayDiv.className = 'day-label';
        
        if ((currentDate.toDateString() === today.toDateString()) && currentWeekOffset === 0) {
            dayDiv.style.opacity = '1';
            dayDiv.style.color = 'var(--text-primary)';
        } else {
            dayDiv.style.opacity = '0.7';
        }

        dayDiv.innerHTML = `<span class="day-name">${daysShort[i]}</span><span class="day-number">${currentDate.getDate()}</span>`;
        row.appendChild(dayDiv);
        
        members.forEach(m => {
            const cell = document.createElement('div'); 
            cell.className = 'grid-cell'; 
            cell.id = `cell-${m}-${isoDate}`;
            row.appendChild(cell);
        });
        
        gridBody.appendChild(row);
    }
}
document.getElementById('prev-week').addEventListener('click', () => { currentWeekOffset--; renderGridSkeleton(); renderCalendar(); });
document.getElementById('next-week').addEventListener('click', () => { currentWeekOffset++; renderGridSkeleton(); renderCalendar(); });

async function renderCalendar() {
    const events = await getAllFromStore(stores.CALENDAR); // node: hub/calendar
    
    document.querySelectorAll('.grid-cell').forEach(c => c.innerHTML = '');
    
    events.forEach(ev => {
        const alvo = ev.member || ev.user || 'joao';
        // Se a data que vem do firebase for YYYY-MM-DD
        const cellId = `cell-${alvo}-${ev.date}`;
        const cell = document.getElementById(cellId);
        
        if (cell) {
            const card = document.createElement('div');
            card.className = `event-card card-${alvo}`;
            card.setAttribute('tabindex', '0'); 
            
            card.innerHTML = `<span class="ev-title">${ev.title || "Agendado"}</span>`;
            if (ev.time) card.innerHTML += `<span class="ev-desc">${ev.time}</span>`;
            
            cell.appendChild(card);
        }
    });
}

// ---- 2. TAREFAS (Tasks Gerais) ----
async function renderTasks() {
    const tasks = await getAllFromStore(stores.TASKS); // node: hub/tasks
    const list = document.getElementById('tasks-list');
    if(!list) return;
    list.innerHTML = '';

    if (tasks.length === 0) return list.innerHTML = '<li style="color:var(--text-secondary); border:none;">Nenhuma tarefa pendente!</li>';

    tasks.forEach(t => {
        const li = document.createElement('li');
        li.className = 'interactive-list-elem';
        li.setAttribute('tabindex', '0');
        
        const urgencyColor = t.urgency === 'alta' ? '#ff3b30' : (t.urgency === 'baixa' ? '#34c759' : 'var(--text-primary)');
        const mark = t.urgency === 'alta' ? '🔴' : (t.urgency === 'baixa' ? '🟢' : '⚪');

        li.innerHTML = `<span><span style="opacity:0.8; margin-right:15px; font-size: 0.9rem;" title="${t.urgency}">${mark}</span> ${t.title}</span> 
                        <span style="font-size:1.5rem; opacity:0.1; transition:0.3s;" class="chkbox">○</span>`;

        // Click p/ Concluir = Apaga do DB
        li.addEventListener('click', async () => {
             li.classList.add('striked');
             li.querySelector('.chkbox').innerHTML = '✓';
             li.querySelector('.chkbox').style.opacity = '1';
             try { await remove(ref(database, `hub/tasks/${t.id}`)); } catch(e) {}
        });
        
        list.appendChild(li);
    });
}

// ---- 3. REFEIÇÕES (Meals) ----
async function renderMeals() {
    const meals = await getAllFromStore(stores.MEALS); // node: hub/meals
    const list = document.getElementById('meals-list'); 
    if(!list) return;
    list.innerHTML = '';
    
    if (meals.length === 0) return list.innerHTML = '<li style="color:var(--text-secondary); border:none;">O Menu está vazio.</li>';
    
    meals.forEach(m => {
        const li = document.createElement('li'); 
        li.className = 'interactive-list-elem'; // Fornece CSS de Hover Touch
        li.setAttribute('tabindex', '0');
        li.style.flexDirection = 'column';
        li.style.alignItems = 'flex-start';
        li.style.gap = '5px';

        const hasRecipe = m.notes && m.notes.trim() !== '';

        const badgetDia = `<div style="color:var(--color-joao); font-size:0.8rem; text-transform:uppercase; letter-spacing:1px;">${m.day}</div>`;
        
        const header = `<div style="width:100%; display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-size: 1.5rem; letter-spacing: -0.5px;">${m.name}</span>
                            <div style="display:flex; align-items:center; gap: 15px;">
                                <span style="font-size: 0.85rem; background:rgba(255,255,255,0.05); padding: 5px 10px; border-radius:8px;">${m.type}</span>
                                ${hasRecipe ? `<span class="arrow-icon" style="font-size: 1.2rem; transition: transform 0.3s ease; opacity:0.5;">▼</span>` : `<span style="width: 1.2rem;"></span>`}
                            </div>
                        </div>`;
                        
        const detailsContainer = document.createElement('div');
        detailsContainer.style.width = '100%';
        detailsContainer.style.maxHeight = '0px';
        detailsContainer.style.overflow = 'hidden';
        detailsContainer.style.transition = 'max-height 0.4s ease, opacity 0.4s ease';
        detailsContainer.style.opacity = '0';
        
        if (hasRecipe) {
            detailsContainer.innerHTML = `<div style="background: rgba(255,255,255,0.03); padding: 20px; border-radius: 12px; font-size:1.1rem; line-height: 1.6; font-weight:300; margin-top: 15px; border-left: 3px solid var(--color-joao);">
                                              <span style="display:block; font-size:0.8rem; text-transform:uppercase; color:var(--text-secondary); margin-bottom:10px; font-weight:500;">Modo de Preparo / Notas:</span>
                                              ${m.notes.replace(/\n/g, '<br>')}
                                          </div>`;
            
            let isExpanded = false;
            li.addEventListener('click', () => {
                isExpanded = !isExpanded;
                const arr = li.querySelector('.arrow-icon');
                if (isExpanded) {
                    detailsContainer.style.maxHeight = '800px'; 
                    detailsContainer.style.opacity = '1';
                    if(arr) arr.style.transform = 'rotate(180deg)';
                } else {
                    detailsContainer.style.maxHeight = '0px';
                    detailsContainer.style.opacity = '0';
                    if(arr) arr.style.transform = 'rotate(0deg)';
                }
            });
        }
        
        li.innerHTML = badgetDia + header;
        li.appendChild(detailsContainer);
        list.appendChild(li);
    });
}

// ---- 4. LISTAS (ShoppingList) ----
async function renderLists() {
    const items = await getAllFromStore(stores.LISTS); // node: hub/shoppingList
    const sList = document.getElementById('shopping-list'); 
    if(!sList) return;
    sList.innerHTML = '';
    
    if (items.length === 0) return sList.innerHTML = '<li style="color:var(--text-secondary); border:none;">O carrinho está limpo!</li>';
    
    items.forEach(it => {
        const li = document.createElement('li');
        li.className = 'interactive-list-elem';
        li.setAttribute('tabindex', '0'); 
        
        li.innerHTML = `<span><span style="opacity:0.5; margin-right:15px;">•</span> ${it.text}</span> 
                        <span style="font-size:1.5rem; opacity:0.1; transition:0.3s;" class="chkbox">○</span>`;
        
        li.addEventListener('click', async () => {
            li.classList.add('striked');
            li.querySelector('.chkbox').innerHTML = '✓';
            li.querySelector('.chkbox').style.opacity = '1';
            
            try { await remove(ref(database, `hub/shoppingList/${it.id}`)); } catch(e) {}
        });
        
        sList.appendChild(li);
    });
}


// ============================================
// ---- ENGINE BOOT HÍBRIDO ----
// ============================================
async function engineBoot() {
    renderGridSkeleton(); 
    
    try {
        await initDB(); 
        
        // Fase 1: Leitura Rápida Local (Offline First)
        renderCalendar();
        renderTasks();
        renderMeals();
        renderLists();
        
        // Fase 2: Purgar Dados Antigos das 4 Tabelas
        cleanOldData(); 
        
        // Fase 3: Ouvir cada Nó Independentemente na Nuvem
        onValue(ref(database, 'hub/calendar'), async (snap) => {
            await saveAllToStore(stores.CALENDAR, snap.val());
            renderCalendar();            
        });
        onValue(ref(database, 'hub/tasks'), async (snap) => {
            await saveAllToStore(stores.TASKS, snap.val());
            renderTasks();            
        });
        onValue(ref(database, 'hub/meals'), async (snap) => {
            await saveAllToStore(stores.MEALS, snap.val());
            renderMeals();            
        });
        onValue(ref(database, 'hub/shoppingList'), async (snap) => {
            await saveAllToStore(stores.LISTS, snap.val());
            renderLists();            
        });
        
    } catch (err) { }
}

engineBoot();
