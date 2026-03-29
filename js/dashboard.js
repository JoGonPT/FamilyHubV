import { database, ref, onValue } from './firebase-config.js';

// --- Relógio e Data ---
function updateClock() {
    const now = new Date();
    const optionsTime = { hour: '2-digit', minute: '2-digit' };
    document.getElementById('time').textContent = now.toLocaleTimeString('pt-PT', optionsTime);
    const optionsDate = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('date').textContent = now.toLocaleDateString('pt-PT', optionsDate);
}
setInterval(updateClock, 1000);
updateClock();

// --- OpenWeather API ---
const WEATHER_API_KEY = "38ad7d8f80a3cb8e1478dc8f198d1bd8";
const CITY = "Maia,PT";

async function fetchWeather() {
    try {
        const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${CITY}&appid=${WEATHER_API_KEY}&units=metric&lang=pt`);
        const data = await response.json();
        
        if (data.main) {
            document.getElementById('temperature').textContent = `${Math.round(data.main.temp)}°C`;
            document.getElementById('weather-desc').textContent = data.weather[0].description;
            const iconCode = data.weather[0].icon;
            document.getElementById('weather-icon').innerHTML = `<img src="https://openweathermap.org/img/wn/${iconCode}@2x.png" alt="Clima">`;
        }
    } catch (error) {
        console.error("Erro a obter clima:", error);
        document.getElementById('weather-desc').textContent = "Erro ao carregar";
    }
}
fetchWeather();
setInterval(fetchWeather, 600000);

// --- Google Calendar API ---
const CALENDAR_API_KEY = "AIzaSyBjJBj8Uu4IjTI-SqHieBoc5pdLaLFN30A";
const CALENDAR_ID = "urgenpc@gmail.com";

async function fetchEvents() {
    const listElement = document.getElementById('events-list');
    try {
        const timeMin = new Date().toISOString();
        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events?key=${CALENDAR_API_KEY}&timeMin=${timeMin}&maxResults=10&singleEvents=true&orderBy=startTime`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        listElement.innerHTML = '';
        
        if (data.items && data.items.length > 0) {
            data.items.forEach(event => {
                const start = event.start.dateTime || event.start.date;
                const startDate = new Date(start);
                
                let timeString = '';
                if (event.start.dateTime) {
                    timeString = startDate.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
                } else {
                    timeString = "Dia todo";
                }
                
                const dateString = startDate.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });

                const li = document.createElement('li');
                li.className = 'event-item';
                li.innerHTML = `
                    <div class="event-time">
                        <div>${timeString}</div>
                        <div style="font-size: 0.9rem; font-weight: 400; opacity: 0.8">${dateString}</div>
                    </div>
                    <div class="event-details">
                        <div class="event-title">${event.summary}</div>
                    </div>
                `;
                listElement.appendChild(li);
            });
        } else {
            listElement.innerHTML = '<li class="event-item">Sem eventos agendados.</li>';
        }
    } catch (error) {
        console.error("Erro ao obter eventos do calendário:", error);
        listElement.innerHTML = '<li class="event-item">Erro ao carregar agenda. O calendário deve ser público.</li>';
    }
}
fetchEvents();
setInterval(fetchEvents, 300000);

// --- Firebase Realtime Database ---
const tasksRef = ref(database, 'hub/tasks');

onValue(tasksRef, (snapshot) => {
    const data = snapshot.val();
    const tasksList = document.getElementById('tasks-list');
    tasksList.innerHTML = '';
    
    if (data) {
        Object.values(data).forEach(task => {
            if (task.text) {
                const li = document.createElement('li');
                li.className = 'task-item';
                li.textContent = task.text;
                tasksList.appendChild(li);
            }
        });
    } else {
        tasksList.innerHTML = '<li class="task-item" style="background: transparent; color: var(--text-muted); border: none;">Sem tarefas pendentes.</li>';
    }
});

// --- Slideshow de Fundo ---
const backgrounds = [
    "https://images.unsplash.com/photo-1506744626753-1fa44df31c78?q=80&w=1920&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?q=80&w=1920&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?q=80&w=1920&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1518098268026-4e89f1a2cd8e?q=80&w=1920&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?q=80&w=1920&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=1920&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1433086966358-54859d0ed716?q=80&w=1920&auto=format&fit=crop"
];

let bgIndex = 0;
function changeBackground() {
    const bgElement = document.getElementById('background-slideshow');
    bgElement.style.backgroundImage = `url('${backgrounds[bgIndex]}')`;
    bgIndex = (bgIndex + 1) % backgrounds.length;
}

changeBackground();
setInterval(changeBackground, 30000);
