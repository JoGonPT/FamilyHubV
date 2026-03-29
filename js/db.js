// ==========================================
// Módulo IndexedDB - Múltiplos Nós e Clean-up Global
// ==========================================

const DB_NAME = 'FamilyHubDB';
const DB_VERSION = 4; // Upgrading to support new multiple stores accurately

// Tabelas alinhadas com os Nós do Firebase do "Admin.html"
export const stores = {
    CALENDAR: 'calendar',
    TASKS: 'tasks',
    MEALS: 'meals',
    LISTS: 'shoppingList'
};

let dbInstance = null;

export function initDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            
            Object.values(stores).forEach(storeName => {
                if (!db.objectStoreNames.contains(storeName)) {
                    const s = db.createObjectStore(storeName, { keyPath: 'id' });
                    // Adicionamos o indíce timestamp para permitir o cleanOldData() rápido
                    s.createIndex('createdAt', 'createdAt', { unique: false });
                    
                    // Colunas que precisam de ser pesquisadas pelo app
                    if (storeName === stores.CALENDAR) {
                        s.createIndex('date', 'date', { unique: false });
                    }
                }
            });
        };
        
        req.onsuccess = (e) => {
            dbInstance = e.target.result;
            resolve(dbInstance);
        };
        
        req.onerror = (e) => reject(e.target.error);
    });
}

// Guarda o Payload da Nuvem na Base de dados local
export function saveAllToStore(storeName, dataObj) {
    return new Promise((resolve) => {
        if (!dbInstance) return resolve();
        
        const tx = dbInstance.transaction([storeName], 'readwrite');
        const store = tx.objectStore(storeName);
        store.clear(); 
        
        if (dataObj) {
            Object.keys(dataObj).forEach(key => {
                const item = dataObj[key];
                const safeItem = typeof item === 'object' ? {...item} : { value: item };
                safeItem.id = key; 
                store.put(safeItem);
            });
        }
        tx.oncomplete = () => resolve();
    });
}

// Get global
export function getAllFromStore(storeName) {
    return new Promise((resolve) => {
        if (!dbInstance) return resolve([]);
        const tx = dbInstance.transaction([storeName], 'readonly');
        const req = tx.objectStore(storeName).getAll();
        
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve([]);
    });
}

// Garbage Collector: Percorre todas as tabelas e limpa os itens velhos (>60d)
export function cleanOldData() {
    if (!dbInstance) return;
    
    // 60 Dias em Milisegundos
    const limiteMs = Date.now() - (60 * 24 * 60 * 60 * 1000);
    
    Object.values(stores).forEach(storeName => {
        try {
            const tx = dbInstance.transaction([storeName], 'readwrite');
            const store = tx.objectStore(storeName);
            
            if (store.indexNames.contains('createdAt')) {
                const index = store.index('createdAt');
                // Pega tudo que seja MAIS VELHO que o "limiteMs"
                const range = IDBKeyRange.upperBound(limiteMs);
                const req = index.openCursor(range);
                
                req.onsuccess = (e) => {
                    const cursor = e.target.result;
                    if (cursor) {
                        // Apagar da memória da Box
                        store.delete(cursor.primaryKey);
                        cursor.continue();
                    }
                };
            }
        } catch(e) { console.error(`Falha a limpar rotinas de ${storeName}:`, e) }
    });
}
