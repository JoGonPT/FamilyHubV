const DB_NAME = "FamilyDashboardDB";
const DB_VERSION = 2; // Incremental version

export const stores = {
    CALENDAR: "calendar",
    TASKS: "tasks",
    MEALS: "meals",
    LISTS: "shoppingList"
};

let dbInstance;

export function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            Object.values(stores).forEach(store => {
                if (!db.objectStoreNames.contains(store)) {
                    db.createObjectStore(store, { keyPath: "id" });
                }
            });
        };
        request.onsuccess = (e) => {
            dbInstance = e.target.result;
            resolve(dbInstance);
        };
        request.onerror = (e) => {
            reject("IndexedDB error:", e);
        };
    });
}

function getStore(storeName, mode = "readonly") {
    return dbInstance.transaction(storeName, mode).objectStore(storeName);
}

export function saveAllToStore(storeName, fbData) {
    return new Promise((resolve) => {
        if(!dbInstance) return resolve();
        const store = getStore(storeName, "readwrite");
        store.clear(); 
        if (fbData) {
            Object.keys(fbData).forEach(key => {
                store.add({ id: key, ...fbData[key] });
            });
        }
        resolve();
    });
}

export function getAllFromStore(storeName) {
    return new Promise((resolve) => {
        if(!dbInstance) return resolve([]);
        const store = getStore(storeName);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
    });
}

// LIMPAR DADOS ANTIGOS (> 60 Dias)
export async function cleanOldData() {
    if(!dbInstance) return;
    const now = new Date().getTime();
    const SIXTY_DAYS = 60 * 24 * 60 * 60 * 1000;

    Object.values(stores).forEach(async (storeName) => {
        const items = await getAllFromStore(storeName);
        const store = getStore(storeName, "readwrite");
        
        items.forEach(item => {
            const createdAt = item.createdAt ? new Date(item.createdAt).getTime() : 0;
            const dateRef = item.date ? new Date(item.date).getTime() : 0;
            
            const age = Math.max(createdAt, dateRef);
            if(age > 0 && (now - age > SIXTY_DAYS)) {
                store.delete(item.id);
            }
        });
    });
}
