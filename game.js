const CLOUD_SAVE_URL = 'https://api.jsonstorage.net/v1/json/'; 

let CLOUD_SAVE_KEY = null;   
let CLOUD_API_KEY = null;   

const GAME_CONFIG = {
    startMoney: 1500, 
    startParts: { battery: 2, motherboard: 1, cpu: 1, gpu: 0, case: 1, ram: 2 },
    partCost: { battery: 30, motherboard: 140, cpu: 180, gpu: 400, case: 90, ram: 120 },
    partDemandMultiplier: { battery: 1.1, motherboard: 1.2, cpu: 1.25, gpu: 1.35, case: 1.1, ram: 1.2 },
    upgradeCost: 500, 
    supplyUpgradeCost: 18000,
    baseSupplyInterval: 40000, 
    supplyAmount: { battery: 1, motherboard: 1, cpu: 1, gpu: 0, case: 1, ram: 1 },
    employeeSpeedIncrease: 0.4,
    orderInterval: 6000,
    maxOrders: 4,
    orderIncreaseCost: 10000,
    employeeMaxSpeed: 7,
    EMPLOYEE_AVATARS: ['👨‍🔧','👩‍🔧','👨‍🔬','👩‍🔬','🧑‍💻','👨‍🏭'],
    comboDecayTime: 7000,
    prestigeCost: 300000, 
    salaryInterval: 10800000,
    baseSalary: 60,
    failurePenalty: 0.2,
    marketVolatility: 0.35,
    inventoryPressureDecay: 0.05,
    inventoryPressureEffect: 0.02 
};

const PART_ICONS = { 
    battery:'🔋', motherboard:'💻', cpu:'🖥️', gpu:'🎮', case:'🖱️', ram:'💿' 
};

const ORDER_PROCESSING_INTERVAL = 200; 
let lastTimestamp = 0;
let needsEmployeeRender = false;
let needsOrderRender = false;

let gameState = {
    money: GAME_CONFIG.startMoney,
    parts: {...GAME_CONFIG.startParts},
    orderCount: 0,
    employees: [],
    orders: [],
    totalOrdersCompleted: 0,
    totalOrdersFailed: 0,
    totalSpent: 0,
    totalEarned: 0,
    supplyActive: false,
    supplyIntervalId: null,
    gameLoopRequestId: null,
    saveIntervalId: null,
    eventIntervalId: null,
    eventBadgeIntervalId: null,
    salaryIntervalId: null,
    priceUpdateIntervalId: null,
    currentShopTab: 'parts',
    rewardMultiplier: 1,
    costMultiplier: 1,
    combo: 0,
    comboTimer: null,
    achievements: [],
    prestige: 0,
    activeEvents: [],
    rareOrdersCompleted: 0,
    maxOrderLimit: GAME_CONFIG.maxOrders,
    lastSalaryTime: Date.now(),
    lastOrderTime: Date.now(),
    partPrices: {...GAME_CONFIG.partCost},
    failedOrderPenalty: 0,
    supplyBoost: 0,
    speedMultiplier: 1,
    inventoryPressure: Object.fromEntries(Object.keys(GAME_CONFIG.partCost).map(key => [key, 0])) 
};

const ORDER_TEMPLATES = [
    { type: 'Phone', minCompleted: 0, baseParts: { battery:1, cpu:1, ram:1 }, baseTime: 220, baseReward: 80 },
    { type: 'Laptop', minCompleted: 8, baseParts: { battery:2, cpu:1, ram:2, motherboard:1 }, baseTime: 320, baseReward: 200 },
    { type: 'PC', minCompleted: 20, baseParts: { cpu:1, gpu:1, ram:2, motherboard:1, case:1 }, baseTime: 400, baseReward: 350 },
    { type: 'Server', minCompleted: 40, baseParts: { cpu:2, ram:4, motherboard:2, case:1, gpu:1 }, baseTime: 550, baseReward: 800 },
    { type: 'Supercomputer', minCompleted: 60, baseParts: { cpu:4, ram:8, motherboard:2, case:2, gpu:4, battery:4 }, baseTime: 700, baseReward: 2500, rare: true },
    { type: 'Tablet', minCompleted: 12, baseParts: { battery:2, ram:2, cpu:1 }, baseTime: 270, baseReward: 120 },
    { type: 'Gaming Console', minCompleted: 25, baseParts: { cpu:1, gpu:2, ram:2, case:1 }, baseTime: 380, baseReward: 280 },
    { type: 'Workstation', minCompleted: 35, baseParts: { cpu:2, gpu:2, ram:4, motherboard:1, case:1 }, baseTime: 480, baseReward: 550, rare: true },
];

const PROFESSIONS = [
    {
        id: 'technician',
        name: 'Technician',
        desc: 'Balanced worker',
        costMultiplier: 1,
        salaryMultiplier: 1,
        perks: { speedBonus: 0.10, savePartChance: 0.10 }
    },
    {
        id: 'warehouse',
        name: 'Warehouse Manager',
        desc: 'High part saving, improves supply',
        costMultiplier: 1.4,
        salaryMultiplier: 1.3,
        perks: { savePartChance: 0.35, speedBonus: 0 }
    },
    {
        id: 'courier',
        name: 'Courier',
        desc: 'Speed & rewards, quick delivery',
        costMultiplier: 1.5,
        salaryMultiplier: 1.4,
        perks: { speedBonus: 0.25, bonusReward: 0.20 }
    },
    {
        id: 'qa',
        name: 'QA Engineer',
        desc: 'No breaks, exp boost, better rare handling',
        costMultiplier: 1.6,
        salaryMultiplier: 1.5,
        perks: { breakPartChance: 0, expBoost: 0.25, savePartChance: 0.15 }
    }
];

const CLIENT_NOTES = [
    "Fell into water...", "Confused with nutcracker 🎃", "Took apart for SMS", "Burned playing Snake 🔥",
    "Microwave charge fail 🤷", "Cat litter box 🐈", "Sandwich inside 🥪", "Sat on it, crunchy",
    "Dark Souls trauma", "Tea kettle plug ☕", "Power supply heater", "Vacuum ate GPU 🌀"
];

const ACHIEVEMENTS = [
    { id: 'first_order', name: 'First Blood', icon: '⭐', desc: 'Complete 1 order.', reward: 500, check: (g) => g.totalOrdersCompleted >= 1 },
    { id: 'rookie_orders', name: 'Rookie Fixer', icon: '🛠️', desc: 'Complete 10 orders.', reward: 2500, check: (g) => g.totalOrdersCompleted >= 10 },
    { id: 'pro_orders', name: 'Pro Service', icon: '🥇', desc: 'Complete 50 orders.', reward: 10000, check: (g) => g.totalOrdersCompleted >= 50 },
    { id: 'master_orders', name: 'Master Workshop', icon: '🏆', desc: 'Complete 100 orders.', reward: 50000, check: (g) => g.totalOrdersCompleted >= 100 },
    { id: 'rich', name: 'Millionaire', icon: '💸', desc: 'Have 100,000 money at once.', reward: 20000, check: (g) => g.money >= 100000 },
    { id: 'team', name: 'Team Builder', icon: '🧑‍🤝‍🧑', desc: 'Hire 5 employees.', reward: 15000, check: (g) => g.employees.length >= 5 },
    { id: 'combo_master', name: 'Combo Master', icon: '⚡', desc: 'Reach 10x Combo.', reward: 10000, check: (g) => g.combo >= 10 },
    { id: 'survivor', name: 'The Unsinkable', icon: '⚓', desc: 'Fail 10 orders.', reward: 5000, check: (g) => g.totalOrdersFailed >= 10 },
    { id: 'profitable', name: 'Highly Profitable', icon: '📈', desc: 'Net profit of 50,000.', reward: 10000, check: (g) => (g.totalEarned - g.totalSpent) >= 50000 },
    { id: 'rare_order', name: 'Rare Client', icon: '💎', desc: 'Complete a Rare order.', reward: 10000, check: (g) => g.rareOrdersCompleted >= 1 }
];

const PERK_TOOLTIPS = {
    speedBonus: '⚡ Work speed',
    savePartChance: '🔧 Save parts',
    breakPartChance: '💥 Break risk',
    bonusReward: '💰 Reward bonus',
    expBoost: '📚 Skill growth'
};

const ROLE_ICONS = {
    courier: '🚚', warehouse: '📦', qa: '🔍', technician: '🔧'
};

const RANDOM_EVENTS = [
    {
        name: 'Rush Hour', type: 'positive', duration: 25000, icon: '⚡', desc: 'Rewards +60%!',
        apply: () => { gameState.rewardMultiplier *= 1.6; },
        revert: () => { gameState.rewardMultiplier /= 1.6; }
    },
    {
        name: 'Supplier Sale', type: 'positive', duration: 30000, icon: '💸', desc: 'Parts -50%!',
        apply: () => { gameState.costMultiplier *= 0.5; updatePartPrices(); },
        revert: () => { gameState.costMultiplier /= 0.5; updatePartPrices(); }
    },
    {
        name: 'Parts Loss', type: 'negative', duration: 0, icon: '💥', desc: 'Lost parts!',
        apply: () => {
            const parts = Object.keys(gameState.parts).filter(p => gameState.parts[p] > 0);
            if (parts.length) {
                const randomPart = parts[Math.floor(Math.random() * parts.length)];
                const loss = Math.min(Math.ceil(gameState.parts[randomPart] * 0.4), gameState.parts[randomPart]);
                gameState.parts[randomPart] = Math.max(0, gameState.parts[randomPart] - loss);
                showNotification(`Lost: ${PART_ICONS[randomPart]} x${loss}`, 'error');
                updateUI();
            }
        },
        revert: () => {}
    },
    {
        name: 'Bonus', type: 'positive', duration: 0, icon: '🎁', desc: 'Money bonus!',
        apply: () => {
            const bonus = 1000 + Math.floor(Math.random() * 2000);
            gameState.money += bonus;
            gameState.totalEarned += bonus;
            showNotification(`Bonus: 💰 ${bonus}`, 'success');
            createParticle('💰', window.innerWidth / 2, window.innerHeight / 2);
            updateUI();
        },
        revert: () => {}
    },
    {
        name: 'Strike', type: 'negative', duration: 20000, icon: '🚫', desc: 'Speed -70%!',
        apply: () => { gameState.speedMultiplier *= 0.3; },
        revert: () => { gameState.speedMultiplier /= 0.3; }
    },
    {
        name: 'Price Surge', type: 'negative', duration: 35000, icon: '📉', desc: 'Parts +100%!',
        apply: () => { gameState.costMultiplier *= 2; updatePartPrices(); },
        revert: () => { gameState.costMultiplier /= 2; updatePartPrices(); }
    },
    {
        name: 'Ad Campaign', type: 'positive', duration: 0, icon: '📢', desc: 'New orders!',
        apply: () => {
            for (let i = 0; i < 3; i++) createOrder();
            showNotification('Got 3 new orders!', 'success');
        },
        revert: () => {}
    }
];

function getRandomNote() {
    return CLIENT_NOTES[Math.floor(Math.random() * CLIENT_NOTES.length)];
}

function getPrestigeBonus() {
    return 1 + (gameState.prestige * 0.2);
}

function updatePartPrices() {
    const costMult = gameState.costMultiplier;
    Object.keys(GAME_CONFIG.partCost).forEach(part => {
        const basePrice = GAME_CONFIG.partCost[part];
        const demandMult = GAME_CONFIG.partDemandMultiplier[part];
        const volatility = 1 + (Math.random() - 0.5) * GAME_CONFIG.marketVolatility;
        
        let pressure = gameState.inventoryPressure[part];
        pressure = Math.max(0, pressure - GAME_CONFIG.inventoryPressureDecay); 
        gameState.inventoryPressure[part] = pressure; 
        
        const pressureEffect = 1 + (pressure * GAME_CONFIG.inventoryPressureEffect); 
        gameState.partPrices[part] = Math.max(10, Math.floor(basePrice * demandMult * costMult * volatility * pressureEffect));
    });
    
    if (gameState.currentShopTab === 'parts') renderShop();
}

function getSaveDataForCloud() {
    return {
        ...gameState,
        supplyIntervalId: null,
        gameLoopRequestId: null, 
        saveIntervalId: null,
        eventIntervalId: null,
        eventBadgeIntervalId: null,
        salaryIntervalId: null,
        priceUpdateIntervalId: null,
        comboTimer: null
    };
}

async function uploadSaveToCloud() {
    if (!CLOUD_SAVE_KEY || !CLOUD_API_KEY) {
        showNotification('Enter Cloud Key AND API Key first!', 'error');
        return;
    }

    const saveData = getSaveDataForCloud();
    try {
        const response = await fetch(CLOUD_SAVE_URL + CLOUD_SAVE_KEY, {
            method: 'POST', 
            headers: {
                'Content-Type': 'application/json',
                'X-Api-Key': CLOUD_API_KEY
            },
            body: JSON.stringify(saveData),
        });

        if (response.ok) {
            showNotification('Cloud Save Successful! 💾', 'success');
        } else {
            showNotification('Cloud Save Failed! (Check Keys/API Status)', 'error');
        }
    } catch (e) {
        showNotification('Network Error: Could not connect to Cloud.', 'error');
    }
}

async function downloadSaveFromCloud() {
    if (!CLOUD_SAVE_KEY) {
        showNotification('Enter Cloud Key first!', 'error');
        return;
    }

    try {
        const headers = CLOUD_API_KEY ? { 'X-Api-Key': CLOUD_API_KEY } : {};
        const response = await fetch(CLOUD_SAVE_URL + CLOUD_SAVE_KEY, {
            method: 'GET',
            headers
        });

        if (response.ok) {
            const data = await response.json();
            if (data?.money !== undefined && data?.orders !== undefined) { 
                if (confirm('Load cloud data? Current progress will be overwritten.')) {
                    localStorage.setItem('wsdServiceSave', JSON.stringify(data));
                    showNotification('Cloud Data Loaded! Restarting...', 'success');
                    window.location.reload(); 
                    return true;
                }
            } else {
                showNotification('No valid data found in Cloud for this key.', 'warning');
            }
        } else if (response.status === 404) {
             showNotification('Cloud Key not found. Use SAVE to create it.', 'warning');
        } else {
            showNotification('Cloud Load Failed! (Check API Key)', 'error');
        }
    } catch (e) {
        showNotification('Network Error: Could not connect to Cloud.', 'error');
    }
    return false;
}

function saveGame() {
    try {
        const saveData = getSaveDataForCloud(); 
        localStorage.setItem('wsdServiceSave', JSON.stringify(saveData));
        if (CLOUD_SAVE_KEY && CLOUD_API_KEY) uploadSaveToCloud();
    } catch (e) {
        console.error('Save error:', e);
    }
}

function loadGame() {
    if (sessionStorage.getItem('isResetting') === 'true') {
        sessionStorage.removeItem('isResetting');
        return false;
    }

    const storedSaveKey = localStorage.getItem('wsdServiceCloudKey');
    const storedApiKey = localStorage.getItem('wsdServiceCloudApiKey');
    if (storedSaveKey) CLOUD_SAVE_KEY = storedSaveKey;
    if (storedApiKey) CLOUD_API_KEY = storedApiKey;
    
    try {
        const saved = localStorage.getItem('wsdServiceSave');
        if (saved) {
            const loaded = JSON.parse(saved);
            Object.assign(gameState, {
                achievements: [],
                prestige: 0,
                combo: 0,
                activeEvents: [],
                rareOrdersCompleted: 0,
                maxOrderLimit: GAME_CONFIG.maxOrders,
                lastSalaryTime: Date.now(),
                lastOrderTime: Date.now(),
                partPrices: {...GAME_CONFIG.partCost},
                totalSpent: 0,
                totalEarned: 0,
                totalOrdersFailed: 0,
                failedOrderPenalty: 0,
                supplyBoost: 0,
                speedMultiplier: 1,
                inventoryPressure: Object.fromEntries(Object.keys(GAME_CONFIG.partCost).map(key => [key, 0])) 
            }, loaded);
            
            if (!gameState.parts) gameState.parts = {...GAME_CONFIG.startParts};
            if (!gameState.employees) gameState.employees = [];
            if (!gameState.orders) gameState.orders = [];
            if (!gameState.partPrices) gameState.partPrices = {...GAME_CONFIG.partCost};
            
            gameState.orders = gameState.orders.filter(o => !o.completed && !o.failed);
            return true;
        }
    } catch (e) {
        console.error('Load error:', e);
    }
    return false;
}

function setCloudKeys() {
    const saveInput = document.getElementById('cloudSaveKeyInput');
    const apiKeyInput = document.getElementById('cloudApiKeyInput');
    
    const newSaveKey = saveInput.value.trim();
    const newApiKey = apiKeyInput.value.trim();

    if (newSaveKey.length < 5) {
        showNotification('Save ID must be at least 5 characters!', 'error');
        return;
    }
    if (newApiKey.length < 10) {
        showNotification('API Key seems too short. Check your service documentation!', 'warning');
    }
    
    CLOUD_SAVE_KEY = newSaveKey;
    CLOUD_API_KEY = newApiKey;
    
    localStorage.setItem('wsdServiceCloudKey', newSaveKey);
    localStorage.setItem('wsdServiceCloudApiKey', newApiKey);
    
    showNotification('Cloud Keys set. Ready to sync!', 'success');
    renderShop(); 
}

function calculateBasePartsCost(partsRequired) {
    let totalCost = 0;
    for (const [part, qty] of Object.entries(partsRequired)) {
        totalCost += (gameState.partPrices[part] || GAME_CONFIG.partCost[part]) * qty;
    }
    return totalCost;
}

function createOrder() {
    if (gameState.orders.length >= gameState.maxOrderLimit) return; 
    
    const available = ORDER_TEMPLATES.filter(o => gameState.totalOrdersCompleted >= o.minCompleted);
    if (!available.length) return;
    
    const rareOrders = available.filter(o => o.rare);
    const normalOrders = available.filter(o => !o.rare);
    
    let tpl = (rareOrders.length && Math.random() < 0.07)
        ? rareOrders[Math.floor(Math.random() * rareOrders.length)]
        : normalOrders[Math.floor(Math.random() * normalOrders.length)];
    
    if (!tpl) return;
    
    const partsRequired = {};
    for (const [part, qty] of Object.entries(tpl.baseParts)) {
        partsRequired[part] = Math.max(1, Math.round(qty * (0.6 + Math.random() * 0.8)));
    }
    
    const basePartsCost = calculateBasePartsCost(partsRequired);
    const baseTime = tpl.baseTime;
    let baseReward = (basePartsCost * 1.2) + (baseTime * 1.4);
    let reward = baseReward * (0.8 + Math.random() * 0.4); 
    reward *= getPrestigeBonus(); 
    if (tpl.rare) reward *= 3; 
    reward *= gameState.rewardMultiplier;
    reward = Math.round(reward);

    const order = {
        id: gameState.orderCount++,
        type: tpl.type,
        partsRequired,
        initialTime: tpl.baseTime,
        timeRemaining: tpl.baseTime,
        maxTime: tpl.baseTime * 3,
        reward,
        note: getRandomNote(),
        employeeId: null,
        completed: false,
        failed: false,
        rare: tpl.rare || false
    };
    
    gameState.orders.push(order);
    needsOrderRender = true;
}

function getOrderProgress(order) {
    if (!order.initialTime || order.initialTime === 0) return 0;
    return Math.max(0, Math.min(100, 100 - (order.timeRemaining / order.initialTime) * 100));
}

function renderEmployees() {
    const list = document.getElementById("employeeList");
    if (!list) return;
    
    const existingCards = new Map();
    Array.from(list.children).forEach(card => {
        if (card.dataset.empid) existingCards.set(card.dataset.empid, card);
        else card.remove();
    });

    const fireBtnStyle = `position:absolute;top:5px;right:10px;font-size:1.5em;font-weight:bold;cursor:pointer;transition:transform 0.2s;line-height:1;padding:2px 5px;color:rgba(255,255,255,0.7);`;
    const fragment = document.createDocumentFragment();
    let hasEmployees = false;

    gameState.employees.forEach(emp => {
        hasEmployees = true;
        let card = existingCards.get(emp.id);

        let perksHTML = '';
        if (emp.perks.speedBonus !== undefined && emp.perks.speedBonus !== 0) {
            const sign = emp.perks.speedBonus >= 0 ? '+' : '';
            perksHTML += `<div class="perk-item" title="${PERK_TOOLTIPS.speedBonus}">⚡ ${sign}${Math.round(emp.perks.speedBonus*100)}%</div>`;
        }
        if (emp.perks.savePartChance) perksHTML += `<div class="perk-item" title="${PERK_TOOLTIPS.savePartChance}">🔧 ${Math.round(emp.perks.savePartChance*100)}%</div>`;
        if (emp.perks.breakPartChance) perksHTML += `<div class="perk-item" title="${PERK_TOOLTIPS.breakPartChance}">💥 ${Math.round(emp.perks.breakPartChance*100)}%</div>`;
        if (emp.perks.bonusReward) perksHTML += `<div class="perk-item" title="${PERK_TOOLTIPS.bonusReward}">💰 +${Math.round(emp.perks.bonusReward*100)}%</div>`;
        if (emp.perks.expBoost) perksHTML += `<div class="perk-item" title="${PERK_TOOLTIPS.expBoost}">📚 +${Math.round(emp.perks.expBoost*100)}%</div>`;
        
        const salary = Math.floor(GAME_CONFIG.baseSalary * (emp.salaryMultiplier || 1) * (1 + emp.speed * 0.1));

        if (!card) {
            card = document.createElement("div");
            card.className = `employee-card`;
            card.dataset.empid = emp.id;
            card.draggable = true; 

            const fireButtonHTML = emp.id !== 'emp-starter' ? 
                `<div class="fire-employee-btn" data-empid="${emp.id}" style="${fireBtnStyle}" 
                    onmouseover="this.style.transform='scale(1.2)';this.style.color='rgba(255,100,100,1)';" 
                    onmouseout="this.style.transform='scale(1)';this.style.color='rgba(255,255,255,0.7)';">&times;</div>` : '';

            card.innerHTML = `
                ${fireButtonHTML}
                <div class="employee-avatar">${emp.avatar}</div>
                <div class="employee-stats">
                    <div><strong>${emp.name||'Employee'}</strong>
                    <span class="role-badge" title="${emp.roleName}">${ROLE_ICONS[emp.role]} ${emp.roleName}</span></div>
                    <div data-stat="speed">Speed: ${emp.speed.toFixed(1)}</div>
                    <div data-stat="done">Done: ${emp.ordersCompleted}</div>
                    <div style="margin-top:2px;font-size:0.9em;opacity:0.8;" data-stat="salary">💰${salary}/3h</div>
                    <div style="margin-top:5px;" data-stat="status">${emp.isBusy ? '🛠 Working' : '✅ Free'}</div>
                </div>
                ${perksHTML ? `<div class="perk-list">${perksHTML}</div>` : ''}
            `;
            
            card.addEventListener('dragstart', e => {
                if (!emp.isBusy) {
                    e.dataTransfer.setData('text/plain', emp.id);
                    card.style.opacity = '0.5';
                }
            });

            card.addEventListener('dragend', () => {
                card.style.opacity = '1';
            });

            fragment.appendChild(card);
        } else {
            existingCards.delete(emp.id);
            
            card.classList.toggle('busy', emp.isBusy);
            card.draggable = !emp.isBusy;
            
            card.querySelector('[data-stat="speed"]').textContent = `Speed: ${emp.speed.toFixed(1)}`;
            card.querySelector('[data-stat="done"]').textContent = `Done: ${emp.ordersCompleted}`;
            card.querySelector('[data-stat="salary"]').textContent = `💰${salary}/3h`;
            card.querySelector('[data-stat="status"]').textContent = emp.isBusy ? '🛠 Working' : '✅ Free';

            fragment.appendChild(card); 
        }
    });

    existingCards.forEach(card => card.remove());

    if (fragment.children.length > 0) {
        list.replaceChildren(...Array.from(fragment.children));
    } else if (!hasEmployees) {
        list.innerHTML = '<div style="text-align:center;padding:20px;opacity:0.6;">Hire in shop!</div>';
    }
    
    needsEmployeeRender = false;
}

function renderOrders() {
    const list = document.getElementById('orderList');
    if (!list) return;
    
    if (gameState.orders.length === 0) {
        list.innerHTML = '<div style="text-align:center;padding:20px;opacity:0.6;grid-column:1/-1;">Awaiting orders...</div>';
        needsOrderRender = false;
        return;
    }
    
    const fragment = document.createDocumentFragment();
    const existingCards = new Map();
    
    Array.from(list.children).forEach(card => {
        if (card.dataset.orderId) existingCards.set(Number(card.dataset.orderId), card);
        else card.remove();
    });
    
    gameState.orders.forEach(order => {
        let card = existingCards.get(order.id);
        const assignedEmployee = order.employeeId 
            ? gameState.employees.find(e => e.id === order.employeeId)
            : null;

        let partsText = Object.entries(order.partsRequired)
            .map(([p, qty]) => `${PART_ICONS[p]} x${qty}`).join(' ');

        if (!card) {
            card = document.createElement('div');
            card.className = `order-card ${order.rare ? 'rare' : ''}`;
            card.dataset.orderId = order.id;
            
            card.innerHTML = `
                <div class="order-type">${order.rare ? '⭐ ' : ''}${order.type} #${order.id}</div>
                <div class="order-note">"${order.note}"</div>
                <div class="order-reward">💰 ${order.reward}</div>
                <div class="order-parts">${partsText}</div>
                <div class="progress-bar"><div class="progress-fill" data-stat="progress-fill"></div></div>
                <div style="margin-top:5px;font-size:0.85em;opacity:0.7;">Time: <span data-stat="time-remaining"></span></div>
                <div class="order-status" data-stat="status"></div>
            `;
            
            card.addEventListener('dragenter', e => { e.preventDefault(); card.classList.add('drag-over'); });
            card.addEventListener('dragover', e => { e.preventDefault(); });
            card.addEventListener('dragleave', () => { card.classList.remove('drag-over'); });
            card.addEventListener('drop', e => {
                e.preventDefault();
                card.classList.remove('drag-over');
                const empId = e.dataTransfer.getData('text/plain');
                assignEmployeeToOrder(empId, order.id);
            });
            
            fragment.appendChild(card);
        } else {
            existingCards.delete(order.id);
            card.classList.remove('drag-over');
            fragment.appendChild(card); 
        }
        
        const progress = getOrderProgress(order);
        const timeRemainingText = Math.ceil(order.timeRemaining / 10) + 's';
        
        const timeProgress = Math.min(100, (order.timeRemaining / order.maxTime) * 100); 
        const timeColor = timeProgress > 50 ? '#10b981' : timeProgress > 25 ? '#f59e0b' : '#ef4444'; 
        
        const fill = card.querySelector('[data-stat="progress-fill"]');
        if (fill) fill.style.width = `${progress}%`;
        
        const timeSpan = card.querySelector('[data-stat="time-remaining"]');
        if (timeSpan) {
            timeSpan.textContent = timeRemainingText;
            timeSpan.style.color = timeColor;
        }
        
        const statusDiv = card.querySelector('[data-stat="status"]');
        if (statusDiv) {
            if (assignedEmployee) {
                statusDiv.innerHTML = `🛠 ${assignedEmployee.avatar} ${assignedEmployee.name}`;
            } else {
                statusDiv.innerHTML = `Waiting for assignment...`; 
            }
        }
    });
    
    list.replaceChildren(...Array.from(fragment.children), ...Array.from(existingCards.values()).filter(c => c.dataset.orderId));
    
    needsOrderRender = false;
}

function assignEmployeeToOrder(empId, orderId) {
    const emp = gameState.employees.find(e => e.id === empId);
    const order = gameState.orders.find(o => o.id === orderId);

    if (!emp || !order || emp.isBusy) {
        if (emp.isBusy) showNotification(`${emp.name} is busy!`, 'error');
        return;
    }
    
    for (const [part, qty] of Object.entries(order.partsRequired)) {
        if ((gameState.parts[part] || 0) < qty) {
            showNotification(`Need ${PART_ICONS[part]} x${qty}!`, 'error');
            return;
        }
    }

    const saveChance = (emp.perks.savePartChance || 0);
    const breakChance = (emp.perks.breakPartChance || 0) + GAME_CONFIG.failurePenalty; // Added base failure chance
    
    for (const [part, qty] of Object.entries(order.partsRequired)) {
        let actualQty = qty;
        
        if (Math.random() < saveChance) {
            actualQty = 0;
            createParticle('🔧', 520, 320);
            showNotification(`Saved ${PART_ICONS[part]} x${qty}!`, 'success');
        } else if (Math.random() < breakChance) {
            actualQty = Math.ceil(qty * 2.5); 
            createParticle('💥', 300, 300);
            showNotification('Parts broken!', 'warning');
        }
        
        gameState.parts[part] = Math.max(0, (gameState.parts[part] || 0) - actualQty);
    }
    
    emp.isBusy = true;
    order.employeeId = emp.id;
    order.timeRemaining = order.initialTime;

    if (emp.role === 'courier') {
        order.timeRemaining = Math.max(10, Math.floor(order.timeRemaining * 0.65)); // 35% time reduction
        order.reward = Math.round(order.reward * (1 + (emp.perks.bonusReward || 0)));
        createParticle('🚚', 540, 360);
    } 
    
    createParticle('🔧', 500, 400);
    renderEmployees();
    renderOrders();
    updateUI();
}

function updateUI() {
    const moneyEl = document.getElementById('money');
    if (moneyEl) moneyEl.textContent = Math.floor(gameState.money).toLocaleString('en-US'); // Use en-US for code output consistency

    const partsEl = document.getElementById('parts');
    if (partsEl) partsEl.textContent = Object.entries(gameState.parts)
        .map(([key, val]) => `${PART_ICONS[key]}${val}`).join(' ');

    const completedEl = document.getElementById('completed');
    if (completedEl) completedEl.textContent = gameState.totalOrdersCompleted;

    const comboEl = document.getElementById('combo');
    if (comboEl) comboEl.textContent = gameState.combo + 'x';
    
    const prestigeEl = document.getElementById('prestige');
    if (prestigeEl) prestigeEl.textContent = gameState.prestige;

    const nextSalaryEl = document.getElementById('next-salary');
    if (nextSalaryEl) {
        const nextSalary = Math.max(0, Math.floor((GAME_CONFIG.salaryInterval - (Date.now() - gameState.lastSalaryTime)) / 1000));
        const hours = Math.floor(nextSalary / 3600);
        const mins = Math.floor((nextSalary % 3600) / 60);
        const secs = nextSalary % 60;
        nextSalaryEl.textContent = `${hours}h ${mins}m ${secs}s`;
    }
}

function buyPart(part) {
    const cost = gameState.partPrices[part];
    const qty = 1;
    
    if (gameState.money < cost) {
        showNotification('Not enough money!', 'error');
        return;
    }
    
    gameState.money -= cost;
    gameState.totalSpent += cost;
    gameState.parts[part] = (gameState.parts[part] || 0) + qty;
    
    gameState.inventoryPressure[part] = Math.min(200, (gameState.inventoryPressure[part] || 0) + 1 * qty);
    
    updateUI();
    renderShop();
    showNotification(`Bought: ${PART_ICONS[part]} x${qty}`, 'success');
}

function renderShop() {
    const content = document.getElementById('shopContent');
    if (!content) return;
    content.innerHTML = '';
    
    if (gameState.currentShopTab === 'parts') {
        content.innerHTML = '<div class="shop-content-grid"></div>';
        const grid = content.querySelector('.shop-content-grid');
        Object.keys(GAME_CONFIG.partCost).forEach(part => {
            const price = gameState.partPrices[part];
            const hasEnoughMoney = gameState.money >= price;
            const card = document.createElement('div');
            card.className = 'shop-item';
            card.innerHTML = `
                <div class="shop-item-info">
                    <div class="shop-item-name">${PART_ICONS[part]} ${part.charAt(0).toUpperCase() + part.slice(1)}</div>
                    <div class="shop-item-desc">Current inventory: ${gameState.parts[part] || 0}</div>
                </div>
                <div class="shop-actions">
                    <div class="shop-price">💰 ${price}</div>
                    <button data-part="${part}" ${hasEnoughMoney ? '' : 'disabled'}>Buy 1</button>
                </div>
            `;
            const btn = card.querySelector('button');
            btn.onclick = () => buyPart(part, 1);
            grid.appendChild(card);
        });
        content.appendChild(grid);
    } 
    else if (gameState.currentShopTab === 'employees') {
        content.innerHTML = '<div class="shop-content-grid"></div>';
        const grid = content.querySelector('.shop-content-grid');
        PROFESSIONS.forEach(p => {
            const cost = Math.floor(1000 + 500 * (gameState.employees.length + 1) * p.costMultiplier);
            const perksList = Object.entries(p.perks).map(([key, val]) => {
                if (val === 0) return '';
                const sign = key !== 'breakPartChance' ? '+' : ''; 
                return `• ${PERK_TOOLTIPS[key]}: ${key === 'breakPartChance' ? val * 100 : sign + Math.round(val * 100)}%`; 
            }).filter(Boolean).join('<br>');

            const card = document.createElement('div');
            card.className = 'shop-item';
            card.innerHTML = `
                <div class="shop-item-info">
                    <div class="shop-item-name">${ROLE_ICONS[p.id]} ${p.name}</div>
                    <div class="shop-item-desc">${p.desc}</div>
                    <div class="shop-item-desc perks-list">${perksList.split('•').join('• ')}</div>
                </div>
                <div class="shop-actions">
                    <div class="shop-price">💰 ${cost}</div>
                    <button ${gameState.money < cost ? 'disabled' : ''}>Hire</button>
                </div>
            `;
            const btn = card.querySelector('button');
            btn.onclick = () => hireEmployee(p.id);
            grid.appendChild(card);
        });
        content.appendChild(grid);
    } 
    else if (gameState.currentShopTab === 'upgrades') {
        content.innerHTML = '<div class="shop-content-grid"></div>';
        const grid = content.querySelector('.shop-content-grid');
        const currentSupplyInterval = getSupplyInterval();
        const upgrades = [
            { name: '⚡ Speed Boost All', cost: GAME_CONFIG.upgradeCost, action: upgradeEmployees, desc: `+${GAME_CONFIG.employeeSpeedIncrease} speed each`, disabled: gameState.employees.length === 0 },
            { name: '📦 Auto Supply', cost: GAME_CONFIG.supplyUpgradeCost, action: buySupply, disabled: gameState.supplyActive, desc: `Parts auto-supply every ${Math.round(currentSupplyInterval/1000)}s` },
            { name: '📋 Max Orders', cost: GAME_CONFIG.orderIncreaseCost, action: expandOrders, desc: `Increase max order limit by 2. Current: ${gameState.maxOrderLimit}` },
            { name: '🤖 Employee Automation', cost: 10000, action: buyAutomation, desc: 'Randomly automates one non-automated employee (auto-assigns best order)', disabled: !gameState.employees.some(e => !e.autoWork) }
        ];

        const cloudControls = document.createElement('div');
        cloudControls.className = 'shop-item cloud-item full-width';
        cloudControls.style = 'grid-column: 1 / -1; background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px; margin-bottom: 20px; border: 2px solid rgba(255, 255, 255, 0.1);';
        cloudControls.innerHTML = `
            <div class="shop-item-name" style="margin-bottom: 5px;">☁️ Cloud Sync Setup</div>
            <div style="font-size: 0.8em; opacity: 0.8; margin-bottom: 10px;">
                Enter your unique Save ID and the API Key from your cloud service (e.g., jsonstorage.net).
            </div>
            
            <label for="cloudSaveKeyInput" style="display: block; margin-top: 5px; font-weight: bold;">Save ID (Unique Key):</label>
            <input type="text" id="cloudSaveKeyInput" placeholder="Your unique save ID" value="${CLOUD_SAVE_KEY || ''}" 
                   style="width: 100%; padding: 8px; margin-bottom: 8px; border-radius: 4px; border: 1px solid #333; background: #222; color: #fff;">
                   
            <label for="cloudApiKeyInput" style="display: block; margin-top: 5px; font-weight: bold;">API Key:</label>
            <input type="password" id="cloudApiKeyInput" placeholder="API Key for writing data" value="${CLOUD_API_KEY || ''}" 
                   style="width: 100%; padding: 8px; margin-bottom: 10px; border-radius: 4px; border: 1px solid #333; background: #222; color: #fff;">

            <button onclick="setCloudKeys()" style="margin-right: 5px; padding: 10px; background: #3b82f6;">SET KEYS</button>
            <button onclick="downloadSaveFromCloud()" style="margin-right: 5px; padding: 10px; background: #f97316;">⬇️ LOAD</button>
            <button onclick="uploadSaveToCloud()" style="padding: 10px; background: #4ade80;">⬆️ SAVE</button>
            
            <div style="margin-top: 10px; font-size: 0.9em; opacity: 0.7;">
                Status: Key: ${CLOUD_SAVE_KEY ? '✅' : '❌'}, API: ${CLOUD_API_KEY ? '✅' : '❌'}
            </div>
        `;
        grid.appendChild(cloudControls);

        upgrades.forEach(upg => {
            const card = document.createElement('div');
            card.className = 'shop-item';
            card.innerHTML = `
                <div class="shop-item-info">
                    <div class="shop-item-name">${upg.name}</div>
                    <div class="shop-item-desc">${upg.desc}</div>
                </div>
                <div class="shop-actions">
                    <div class="shop-price">💰 ${upg.cost.toLocaleString('en-US')}</div>
                    <button ${gameState.money < upg.cost || upg.disabled ? 'disabled' : ''}>Buy</button>
                </div>
            `;
            const btn = card.querySelector('button');
            if (!upg.disabled) btn.onclick = upg.action;
            grid.appendChild(card);
        });

        const prestigeCard = document.createElement('div');
        prestigeCard.className = 'shop-item prestige-item';
        const prestigeCost = GAME_CONFIG.prestigeCost * (1 + gameState.prestige * 0.5);
        prestigeCard.innerHTML = `
            <div class="shop-item-info">
                <div class="shop-item-name">🏆 Prestige (Lvl ${gameState.prestige + 1})</div>
                <div class="shop-item-desc">Reset progress for a permanent +20% order reward bonus (Current: +${gameState.prestige * 20}%)</div>
            </div>
            <div class="shop-actions">
                <div class="shop-price prestige-price">💰 ${prestigeCost.toLocaleString('en-US')}</div>
                <button onclick="doPrestige()" ${gameState.money < prestigeCost ? 'disabled' : ''}>PRESTIGE!</button>
            </div>
        `;
        grid.appendChild(prestigeCard);

        const resetCard = document.createElement('div');
        resetCard.className = 'shop-item prestige-item';
        resetCard.style = 'background: #550000; border-color: #ff0000;';
        resetCard.innerHTML = `
            <div class="shop-item-info">
                <div class="shop-item-name">💀 Reset Game</div>
                <div class="shop-item-desc">WARNING: Resets ALL progress, including Prestige.</div>
            </div>
            <div class="shop-actions">
                <button onclick="resetGame()" style="background: #ff0000; color: white; padding: 10px;">FULL RESET</button>
            </div>
        `;
        grid.appendChild(resetCard);
        
    }   else if (gameState.currentShopTab === 'achievements') {
        renderAchievements();
    }   
} 
function renderAchievements() {
    const content = document.getElementById('shopContent');
    if (!content) return;
    content.innerHTML = '<div class="achievements-grid"></div>';
    const grid = content.querySelector('.achievements-grid');

    ACHIEVEMENTS.forEach(ach => {
        const isUnlocked = gameState.achievements.includes(ach.id);
        const card = document.createElement('div');
        card.className = `achievement-item ${isUnlocked ? 'unlocked' : 'locked'}`;

        let statusText = '';
        let progressValue = 0;
        let targetValue = 0;
        let canClaim = false;

        if (ach.id.includes('orders')) {
            progressValue = gameState.totalOrdersCompleted;
            targetValue = ACHIEVEMENTS.find(a => a.id === ach.id).check.toString().match(/>= (\d+)/);
            targetValue = targetValue ? parseInt(targetValue[1]) : 1;
        } else if (ach.id === 'rich') {
            progressValue = gameState.money;
            targetValue = ACHIEVEMENTS.find(a => a.id === ach.id).check.toString().match(/>= (\d+)/);
            targetValue = targetValue ? parseInt(targetValue[1]) : 100000;
        } else if (ach.id === 'team') {
            progressValue = gameState.employees.length;
            targetValue = ACHIEVEMENTS.find(a => a.id === ach.id).check.toString().match(/>= (\d+)/);
            targetValue = targetValue ? parseInt(targetValue[1]) : 5;
        } else if (ach.id === 'combo_master') {
             progressValue = gameState.combo;
             targetValue = 10;
        } else if (ach.id === 'survivor') {
             progressValue = gameState.totalOrdersFailed;
             targetValue = 10;
        } else if (ach.id === 'profitable') {
             progressValue = gameState.totalEarned - gameState.totalSpent;
             targetValue = 50000;
        } else if (ach.id === 'rare_order') {
             progressValue = gameState.rareOrdersCompleted;
             targetValue = 1;
        }

        if (isUnlocked) {
            statusText = `<div class="achievement-status unlocked-status">✅ Claimed!</div>`;
        } else if (ach.check(gameState)) {
            canClaim = true;
            statusText = `<div class="achievement-status can-claim">🎉 Ready to Claim!</div>`;
            card.classList.add('can-claim-border');
        } else {
            if (targetValue > 1) { 
                 const progressPercent = targetValue > 0 ? Math.min(100, Math.floor((progressValue / targetValue) * 100)) : 0;
                 statusText = `
                    <div class="achievement-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${progressPercent}%;"></div>
                        </div>
                        <div class="progress-text">${Math.min(progressValue, targetValue).toLocaleString('en-US')}/${targetValue.toLocaleString('en-US')}</div>
                    </div>
                 `;
            } else {
                statusText = `<div class="achievement-status locked-status">Locked...</div>`;
            }
        }
        
        card.innerHTML = `
            <div class="achievement-icon">${ach.icon}</div>
            <div class="achievement-info">
                <div class="achievement-name">${ach.name}</div>
                <div class="achievement-desc">${ach.desc}</div>
                ${statusText}
            </div>
            <div class="achievement-reward">
                ${isUnlocked ? `<span>💰 ${ach.reward.toLocaleString('en-US')}</span>` : ''}
                ${canClaim ? `<button data-achid="${ach.id}" onclick="claimAchievement('${ach.id}')">CLAIM 💰 ${ach.reward.toLocaleString('en-US')}</button>` : ''}
            </div>
        `;

        grid.appendChild(card);
    });
}

function claimAchievement(achId) {
    const ach = ACHIEVEMENTS.find(a => a.id === achId);
    if (!ach) return;
    
    if (gameState.achievements.includes(achId)) {
        showNotification('Achievement already claimed!', 'warning');
        return;
    }
    
    if (ach.check(gameState)) {
        gameState.money += ach.reward;
        gameState.totalEarned += ach.reward;
        gameState.achievements.push(achId);
        showNotification(`Achievement unlocked: ${ach.icon} ${ach.name} (+💰 ${ach.reward.toLocaleString('en-US')})`, 'success');
        createParticle('💰', window.innerWidth / 2, window.innerHeight / 2);
        updateUI();
        renderShop();
    } else {
        showNotification('Achievement not yet completed!', 'error');
    }
}


function hireEmployee(professionId) {
    const prof = PROFESSIONS.find(p => p.id === professionId);
    if (!prof) return;
    
    const baseCost = 600 + prof.costMultiplier * 1000;
    const cost = Math.round(baseCost * (1 + gameState.employees.length * 0.2));

    if (gameState.money < cost) {
        showNotification('Not enough money!', 'error');
        return;
    }
    
    gameState.money -= cost;
    gameState.totalSpent += cost;
    
    const names = ['Alice', 'Bob', 'Charlie', 'Dana', 'Ethan', 'Fiona', 'George', 'Hannah', 'Isaac', 'Jenna', 'Kate', 'Max', 'Sophia'];
    const avatar = GAME_CONFIG.EMPLOYEE_AVATARS[Math.floor(Math.random() * GAME_CONFIG.EMPLOYEE_AVATARS.length)];
    const name = names[Math.floor(Math.random() * names.length)];
    
    const perks = { 
        speedBonus: Math.random() < 0.35 ? (0.02 + Math.random() * 0.10) : 0, 
        savePartChance: Math.random() < 0.20 ? (0.03 + Math.random() * 0.12) : 0, 
        breakPartChance: Math.random() < 0.10 ? (0.02 + Math.random() * 0.08) : 0, 
        bonusReward: Math.random() < 0.15 ? (0.02 + Math.random() * 0.15) : 0, 
        expBoost: Math.random() < 0.12 ? (0.02 + Math.random() * 0.18) : 0 
    };
    
    Object.assign(perks, prof.perks || {});
    
    const employee = {
        id: `emp-${Date.now()}-${Math.random()}`,
        avatar,
        name,
        role: prof.id,
        roleName: prof.name,
        speed: 1,
        isBusy: false,
        ordersCompleted: 0,
        autoWork: false,
        perks,
        salaryMultiplier: prof.salaryMultiplier || 1
    };
    
    gameState.employees.push(employee);
    
    if (employee.role === 'warehouse') {
        gameState.supplyBoost = (gameState.supplyBoost || 0) + 1;
        if (gameState.supplyActive) initIntervals(); 
    }
    
    renderEmployees();
    updateUI();
    renderShop();
    showNotification(`Hired: ${name} – ${prof.name}`, 'success');
    checkAchievements();
}

function fireEmployee(empId) {
    const emp = gameState.employees.find(e => e.id === empId);
    if (!emp) return;

    if (emp.isBusy) {
        showNotification('Employee is busy!', 'error');
        return;
    }
    
    if (emp.id === 'emp-starter') {
        showNotification('Cannot fire starter!', 'error');
        return;
    }
    
    const severance = Math.floor(GAME_CONFIG.baseSalary * (emp.salaryMultiplier || 1) * 3);
    
    if (!confirm(`Fire ${emp.name}?\nSeverance: ${severance} 💰`)) {
        return;
    }

    if (gameState.money < severance) {
        showNotification('Cannot afford severance!', 'error');
        return;
    }

    gameState.money -= severance;
    gameState.totalSpent += severance;
    
    if (emp.role === 'warehouse') {
        gameState.supplyBoost = Math.max(0, (gameState.supplyBoost || 0) - 1);
        if (gameState.supplyActive) initIntervals(); 
    }
    
    gameState.employees = gameState.employees.filter(e => e.id !== empId);
    
    renderEmployees();
    updateUI();
    renderShop();
    showNotification(`Fired: ${emp.name}`, 'warning');
}


function upgradeEmployees() {
    const cost = GAME_CONFIG.upgradeCost;
    if (gameState.employees.length === 0) {
        showNotification('No employees to upgrade!', 'error');
        return;
    }
    if (gameState.money < cost) {
        showNotification('Not enough money!', 'error');
        return;
    }
    gameState.money -= cost;
    gameState.totalSpent += cost;
    let upgradedCount = 0;
    gameState.employees.forEach(emp => {
        if (emp.speed < GAME_CONFIG.employeeMaxSpeed) {
            emp.speed = Math.min(GAME_CONFIG.employeeMaxSpeed, emp.speed + GAME_CONFIG.employeeSpeedIncrease);
            upgradedCount++;
        }
    });
    showNotification(`Upgraded ${upgradedCount} employee(s)!`, 'success');
    renderEmployees();
    updateUI();
}

function getSupplyInterval() {
    const boostFactor = 1 - (gameState.supplyBoost * 0.10); 
    const minInterval = 10000; 
    return Math.max(minInterval, GAME_CONFIG.baseSupplyInterval * boostFactor);
}

function buySupply() {
    const cost = GAME_CONFIG.supplyUpgradeCost;
    if (gameState.supplyActive) return;
    if (gameState.money < cost) {
        showNotification('Not enough money!', 'error');
        return;
    }
    gameState.money -= cost;
    gameState.totalSpent += cost;
    gameState.supplyActive = true;
    initIntervals();
    showNotification(`Auto supply activated! (${Math.round(getSupplyInterval()/1000)}s)`, 'success');
    updateUI();
    renderShop();
}

function expandOrders() {
    const cost = GAME_CONFIG.orderIncreaseCost;
    if (gameState.money < cost) {
        showNotification('Not enough money!', 'error');
        return;
    }
    gameState.money -= cost;
    gameState.totalSpent += cost;
    gameState.maxOrderLimit += 2;
    showNotification('Order limit +2!', 'success');
    updateUI();
    renderShop();
}

function buyAutomation() {
    const cost = 10000;
    if (gameState.money < cost) {
        showNotification('Not enough money!', 'error');
        return;
    }
    const emp = gameState.employees.find(e => !e.autoWork);
    if (!emp) {
        showNotification('All automated!', 'warning');
        return;
    }
    gameState.money -= cost;
    gameState.totalSpent += cost;
    emp.autoWork = true;
    showNotification(`${emp.name} automated!`, 'success');
    updateUI();
    renderShop();
}

function doPrestige() {
    if (gameState.money < GAME_CONFIG.prestigeCost) {
        showNotification('Not enough money!', 'error');
        return;
    }
    const newBonus = (gameState.prestige + 1) * 20;
    if (!confirm(`PRESTIGE?\n\nReset all progress for permanent +20% bonus!\n\nCurrent bonus: +${gameState.prestige * 20}%\nNew bonus: +${newBonus}%`)) {
        return;
    }
    clearAllIntervals();
    gameState.prestige++;
    const keepAchievements = [...gameState.achievements];
    Object.assign(gameState, {
        money: GAME_CONFIG.startMoney,
        parts: {...GAME_CONFIG.startParts},
        employees: [],
        orders: [],
        totalOrdersCompleted: 0,
        totalOrdersFailed: 0,
        combo: 0,
        supplyActive: false,
        maxOrderLimit: GAME_CONFIG.maxOrders,
        partPrices: {...GAME_CONFIG.partCost},
        totalSpent: 0,
        totalEarned: 0,
        lastSalaryTime: Date.now(),
        achievements: keepAchievements,
        supplyBoost: 0,
        inventoryPressure: Object.fromEntries(Object.keys(GAME_CONFIG.partCost).map(key => [key, 0])) // Reset pressure on Prestige
    });
    showNotification(`🎉 Prestige ${gameState.prestige}! +${newBonus}% bonus`, 'success');
    renderEmployees();
    renderOrders();
    renderShop();
    updateUI();
    initIntervals();
    const banner = document.getElementById('eventsBanner');
    if (banner) banner.innerHTML = '';
    saveGame();
}

function resetGame() { 
    if (!confirm('Are you sure you want to fully reset the game? All progress will be lost!')) {
        return;
    }
    clearAllIntervals();
    sessionStorage.setItem('isResetting', 'true');
    localStorage.removeItem('wsdServiceSave');
    window.location.reload(); 
}

window.addEventListener('beforeunload', () => {
    if (sessionStorage.getItem('isResetting') === 'true') {
        sessionStorage.removeItem('isResetting');
        return;
    }
    saveGame();
});

function clearAllIntervals() {
    if (gameState.supplyIntervalId) clearInterval(gameState.supplyIntervalId);
    if (gameState.saveIntervalId) clearInterval(gameState.saveIntervalId);
    if (gameState.eventIntervalId) clearInterval(gameState.eventIntervalId);
    if (gameState.eventBadgeIntervalId) clearInterval(gameState.eventBadgeIntervalId);
    if (gameState.salaryIntervalId) clearInterval(gameState.salaryIntervalId);
    if (gameState.priceUpdateIntervalId) clearInterval(gameState.priceUpdateIntervalId);
    if (gameState.comboTimer) clearTimeout(gameState.comboTimer);
    if (gameState.gameLoopRequestId) cancelAnimationFrame(gameState.gameLoopRequestId);
}

function initIntervals() {
    clearAllIntervals(); 

    gameState.gameLoopRequestId = requestAnimationFrame(gameTick); 
    gameState.saveIntervalId = setInterval(saveGame, 10000); 
    gameState.eventIntervalId = setInterval(triggerRandomEvent, 60000);
    gameState.eventBadgeIntervalId = setInterval(renderEventBadges, 1000); 
    gameState.salaryIntervalId = setInterval(paySalary, GAME_CONFIG.salaryInterval);
    gameState.priceUpdateIntervalId = setInterval(updatePartPrices, 15000); 
    if (gameState.supplyActive) {
        gameState.supplyIntervalId = setInterval(doSupply, getSupplyInterval());
    }
}

function doSupply() {
    const totalParts = Object.values(gameState.parts).reduce((a, b) => a + b, 0);
    if (totalParts > 200) {
        showNotification('Warehouse full!', 'warning');
        return;
    }
    let partsAdded = 0;
    Object.entries(GAME_CONFIG.supplyAmount).forEach(([part, amount]) => {
        gameState.parts[part] = (gameState.parts[part] || 0) + amount;
        partsAdded += amount;
        gameState.inventoryPressure[part] = Math.max(0, (gameState.inventoryPressure[part] || 0) - 0.5 * amount); 
    });
    showNotification(`Supplied ${partsAdded} parts!`, 'info');
    updateUI();
    renderShop();
}

function paySalary() {
    let totalSalary = 0;
    gameState.employees.forEach(emp => {
        const salary = Math.floor(GAME_CONFIG.baseSalary * (emp.salaryMultiplier || 1) * (1 + emp.speed * 0.1));
        totalSalary += salary;
    });
    
    if (gameState.money < totalSalary) {
        gameState.money = 0;
        showNotification('Cannot pay salaries! Game over? 💀', 'error');
    } else {
        gameState.money -= totalSalary;
        gameState.totalSpent += totalSalary;
        showNotification(`Paid salaries: 💰 ${totalSalary}`, 'warning');
    }
    
    gameState.lastSalaryTime = Date.now();
    updateUI();
}

function autoAssignOrder(orderId) {
    const order = gameState.orders.find(o => o.id === orderId);
    if (!order || order.employeeId) return;
    
    const bestEmployee = getBestEmployeeForOrder(order);
    
    if (bestEmployee) {
        assignEmployeeToOrder(bestEmployee.id, orderId);
    } else {
        showNotification('No free employee or missing parts!', 'error');
    }
}

function scoreEmployeeForOrder(emp, order) {
    for (const [part, qty] of Object.entries(order.partsRequired)) {
        if ((gameState.parts[part] || 0) < qty) return -1; 
    }
    
    let score = 100 + emp.speed * 20; 
    
    const baseTime = order.initialTime;
    const effectiveSpeed = emp.speed * (1 + (emp.perks.speedBonus || 0)) * (gameState.speedMultiplier || 1);
    let timeReduction = 0;
    
    if (emp.role === 'courier') {
        timeReduction = baseTime * 0.35; 
        score += 50; 
    }
    const orderRewardRate = order.reward / baseTime;
    score += effectiveSpeed * orderRewardRate * 5; 
    
    if (emp.role === 'warehouse' && (emp.perks.savePartChance || 0) > 0) {
        const partsCost = calculateBasePartsCost(order.partsRequired);
        const expectedSaving = partsCost * (emp.perks.savePartChance || 0);
        score += expectedSaving * 0.5; 
    }
    if (emp.role === 'courier' && (emp.perks.bonusReward || 0) > 0) {
        const bonusValue = order.reward * (emp.perks.bonusReward || 0);
        score += bonusValue; 
    }
    if (emp.role === 'qa') {
        if (order.rare) score += 60; 
        if ((emp.perks.breakPartChance || 0) === 0) score += 30; 
    }

    return score;
}

function getBestEmployeeForOrder(order) {
    const availableEmployees = gameState.employees.filter(emp => !emp.isBusy);
    if (!availableEmployees.length) return null; 

    const scoredEmployees = availableEmployees.map(emp => {
        const score = scoreEmployeeForOrder(emp, order);
        return { employee: emp, score };
    }).filter(s => s.score > 0);
    
    if (!scoredEmployees.length) return null;

    scoredEmployees.sort((a, b) => b.score - a.score);
    
    return scoredEmployees[0]?.employee || null; 
}


function gameTick(timestamp) {
    gameState.gameLoopRequestId = requestAnimationFrame(gameTick);
    
    if (timestamp - lastTimestamp < ORDER_PROCESSING_INTERVAL) {
        gameState.orders.forEach(order => {
            if (order.employeeId && !order.failed) {
                const card = document.querySelector(`.order-card[data-order-id="${order.id}"]`);
                if (card) {
                    const progress = getOrderProgress(order);
                    const fill = card.querySelector('.progress-fill');
                    if (fill) fill.style.width = `${progress}%`;
                }
            }
        });
        return;
    }
    
    lastTimestamp = timestamp;

    if (Date.now() - gameState.lastOrderTime > GAME_CONFIG.orderInterval) {
        createOrder();
        gameState.lastOrderTime = Date.now();
    }
    
    gameState.employees.forEach(emp => {
        if (emp.autoWork && !emp.isBusy) {
            const availableOrders = gameState.orders.filter(o => !o.employeeId && !o.completed && !o.failed);
            if (availableOrders.length) {
                let bestOrder = null;
                let highestScore = -Infinity;
                availableOrders.forEach(order => {
                    const score = scoreEmployeeForOrder(emp, order);
                    if (score > highestScore) {
                        highestScore = score;
                        bestOrder = order;
                    }
                });
                
                if (bestOrder && highestScore > 0) {
                    assignEmployeeToOrder(emp.id, bestOrder.id);
                }
            }
        }
    });

    let ordersChanged = false;
    gameState.orders.forEach(order => {
        if (order.employeeId && !order.completed && !order.failed) {
            const emp = gameState.employees.find(e => e.id === order.employeeId);
            if (emp) {
                const speedMultiplier = (gameState.speedMultiplier || 1);
                const employeeSpeed = emp.speed * (1 + (emp.perks.speedBonus || 0)) * speedMultiplier;
                const progressIncrease = employeeSpeed * (ORDER_PROCESSING_INTERVAL / 100);

                order.timeRemaining -= progressIncrease;
                
                if (order.timeRemaining <= 0) {
                    ordersChanged = true;
                    emp.isBusy = false;
                    emp.ordersCompleted++;
                    gameState.totalOrdersCompleted++;
                    
                    if (order.rare) {
                        gameState.rareOrdersCompleted++;
                    }
                    
                    let reward = order.reward;
                    reward = Math.round(reward * (1 + (gameState.combo * 0.05))); 

                    gameState.money += reward;
                    gameState.totalEarned += reward;
                    
                    showNotification(`Completed #${order.id}! +${reward} 💰`, 'success'); 
                    renderEmployees(); 
                    incrementCombo();
                    order.completed = true;
                    createParticle('💰', 600, 300);
                    if (order.rare) {
                        createParticle('⭐', 620, 280);
                        showNotification(`Rare! +${reward} 💰`, 'success');
                    }
                    checkAchievements();
                }
            }
        } else if (!order.employeeId && !order.completed && !order.failed) {
            order.timeRemaining -= (ORDER_PROCESSING_INTERVAL / 100);
            
            if (order.timeRemaining <= 0) {
                order.failed = true;
                ordersChanged = true;
                gameState.totalOrdersFailed++;
                const penalty = Math.floor(order.reward * GAME_CONFIG.failurePenalty);
                gameState.money = Math.max(0, gameState.money - penalty);
                gameState.failedOrderPenalty = (gameState.failedOrderPenalty || 0) + penalty;
                showNotification(`Failed #${order.id}! -${penalty} 💰`, 'error');
                createParticle('❌', 600, 300);
                
                if (gameState.combo > 0) {
                    gameState.combo = Math.max(0, gameState.combo - 3);
                    updateUI();
                }
                checkAchievements();
            }
        }
    });

    if (gameState.combo > 0) {
        if (gameState.comboTimer) clearTimeout(gameState.comboTimer);
        gameState.comboTimer = setTimeout(() => {
            if (gameState.combo > 0) {
                gameState.combo = Math.max(0, gameState.combo - 1);
                updateUI();
                if (gameState.combo > 0) {
                    gameState.comboTimer = setTimeout(decayCombo, GAME_CONFIG.comboDecayTime);
                } else {
                    gameState.comboTimer = null;
                }
            }
        }, GAME_CONFIG.comboDecayTime);
    }
    
    gameState.orders = gameState.orders.filter(o => !o.completed);
    
    updateUI();
    renderOrders();
    renderEmployees();
}

function incrementCombo() {
    gameState.combo++;
    updateUI();
    if (gameState.comboTimer) clearTimeout(gameState.comboTimer);
    gameState.comboTimer = setTimeout(decayCombo, GAME_CONFIG.comboDecayTime);
    checkAchievements();
}

function decayCombo() {
    if (gameState.combo > 0) {
        gameState.combo = Math.max(0, gameState.combo - 1);
        updateUI();
        if (gameState.combo > 0) {
            gameState.comboTimer = setTimeout(decayCombo, GAME_CONFIG.comboDecayTime);
        } else {
            gameState.comboTimer = null;
        }
    }
}

function showNotification(message, type) {
    const popup = document.createElement('div');
    popup.className = `notification ${type}`;
    popup.textContent = message;
    
    const container = document.getElementById('notificationContainer');
    if (container) container.appendChild(popup);
    
    setTimeout(() => {
        popup.style.opacity = '0';
        popup.style.transform = 'translateX(400px)';
        setTimeout(() => popup.remove(), 500);
    }, 5000);
}

function createParticle(icon, x, y) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.textContent = icon;
    particle.style.left = `${x}px`;
    particle.style.top = `${y}px`;
    
    const container = document.getElementById('particleContainer');
    if (container) container.appendChild(particle);
    
    setTimeout(() => particle.remove(), 1500);
}

function checkAchievements() {
    ACHIEVEMENTS.forEach(ach => {
        if (!gameState.achievements.includes(ach.id) && ach.check(gameState)) {
            gameState.achievements.push(ach.id);
            gameState.money += ach.reward;
            gameState.totalEarned += ach.reward;
            showAchievementUnlock(ach);
            createParticle('🏆', window.innerWidth / 2, 100);
        }
    });

    if (gameState.currentShopTab === 'achievements') {
        renderShop();
    }
}

function showAchievementUnlock(ach) {
    const popup = document.createElement('div');
    popup.className = 'notification success';
    popup.style.border = '2px solid gold';
    popup.innerHTML = `
        <div style="font-size:1.5em;margin-bottom:5px;">${ach.icon} Achievement!</div>
        <div style="font-weight:bold;">${ach.name}</div>
        <div style="opacity:0.8;">${ach.desc}</div>
        <div style="color:#fbbf24;margin-top:5px;">+${ach.reward} 💰</div>
    `;
    const container = document.getElementById('notificationContainer');
    if (container) container.appendChild(popup);
    
    setTimeout(() => {
        popup.style.opacity = '0';
        popup.style.transform = 'translateX(400px)';
        setTimeout(() => popup.remove(), 500);
    }, 5000);
}

function triggerRandomEvent() {
    if (Math.random() < 0.20) {
        const event = RANDOM_EVENTS[Math.floor(Math.random() * RANDOM_EVENTS.length)];
        event.apply();
        showEventBadge(event);
        
        if (event.duration > 0) {
            const eventData = { name: event.name, endTime: Date.now() + event.duration };
            gameState.activeEvents.push(eventData);
            setTimeout(() => {
                event.revert();
                gameState.activeEvents = gameState.activeEvents.filter(e => e.name !== event.name);
                renderEventBadges();
                renderShop();
            }, event.duration);
        }
        
        renderEventBadges();
        renderShop();
    }
}

function showEventBadge(event) {
    const badge = document.createElement('div');
    badge.className = `event-badge ${event.type}`;
    badge.textContent = `${event.icon} ${event.name}`;
    
    const banner = document.getElementById('eventsBanner');
    if (banner) banner.appendChild(badge);
    
    if (event.duration > 0) {
        setTimeout(() => {
            badge.style.opacity = '0';
            setTimeout(() => badge.remove(), 500);
        }, event.duration);
    }
}

function renderEventBadges() {
    const banner = document.getElementById('eventsBanner');
    if (!banner) return;
    
    Array.from(banner.children).forEach(child => {
        if (!gameState.activeEvents.some(e => e.name === child.textContent.substring(child.textContent.indexOf(' ')+1))) {
            if (!child.dataset.duration) child.remove(); 
        }
    });

    gameState.activeEvents.forEach(eventData => {
        let badge = Array.from(banner.children).find(b => b.textContent.includes(eventData.name));
        
        if (!badge) {
            const eventTpl = RANDOM_EVENTS.find(e => e.name === eventData.name);
            if (eventTpl) {
                badge = document.createElement('div');
                badge.className = `event-badge ${eventTpl.type}`;
                badge.dataset.duration = 'true';
                banner.appendChild(badge);
            }
        }

        if (badge) {
            const remaining = Math.max(0, Math.floor((eventData.endTime - Date.now()) / 1000));
            badge.textContent = `${RANDOM_EVENTS.find(e => e.name === eventData.name).icon} ${eventData.name} (${remaining}s)`;
        }
    });
}

function setupShopTabs() {
    document.querySelectorAll('.shop-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            gameState.currentShopTab = tab.dataset.tab;
            renderShop();
        });
    });
}

function init() {
    const isGameLoaded = loadGame(); 
    setupShopTabs();

    const employeeList = document.getElementById('employeeList');
    if (employeeList) {
        employeeList.addEventListener('click', e => {
            if (e.target.classList.contains('fire-employee-btn')) {
                e.stopPropagation();
                const empId = e.target.dataset.empid;
                fireEmployee(empId);
            }
        });
    }

    if (gameState.employees.length === 0) {
        const avatar = GAME_CONFIG.EMPLOYEE_AVATARS[0];
        gameState.employees.push({
            id: 'emp-starter',
            avatar,
            name: 'You',
            role: 'technician',
            roleName: 'Technician',
            speed: 1,
            isBusy: false,
            ordersCompleted: 0,
            autoWork: false,
            perks: {},
            salaryMultiplier: 0.3
        });
    }

    renderEmployees();
    renderOrders();
    renderShop();
    updateUI();
    updatePartPrices();

    initIntervals();
    if (isGameLoaded) {
        showNotification('Game loaded! 🔧', 'success');
    } else {
        showNotification('New game started! 🚀', 'success');
    }
}

document.addEventListener('DOMContentLoaded', init);
