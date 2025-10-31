const GAME_CONFIG = {
    startMoney: 2500,
    startParts: { battery: 2, motherboard: 1, cpu: 1, gpu: 0, case: 1, ram: 2 },
    partCost: { battery: 30, motherboard: 140, cpu: 180, gpu: 400, case: 90, ram: 120 },
    partDemandMultiplier: { battery: 1.1, motherboard: 1.2, cpu: 1.25, gpu: 1.35, case: 1.1, ram: 1.2 },
    upgradeCost: 300,
    supplyUpgradeCost: 18000,
    supplyInterval: 40000,
    supplyAmount: { battery: 1, motherboard: 1, cpu: 1, gpu: 0, case: 1, ram: 1 },
    employeeSpeedIncrease: 0.4,
    orderInterval: 6000,
    employeeSpeedIncrementEvery: 10,
    maxOrders: 4,
    orderIncreaseCost: 10000,
    employeeMaxSpeed: 7,
    EMPLOYEE_AVATARS: ['👨‍🔧','👩‍🔧','👨‍🔬','👩‍🔬','🧑‍💻','👨‍🏭'],
    comboDecayTime: 7000,
    prestigeCost: 200000,
    salaryInterval: 10800000,
    baseSalary: 60,
    failurePenalty: 0.2,
    marketVolatility: 0.35
};

const PART_ICONS = { 
    battery:'🔋', motherboard:'💻', cpu:'🖥️', gpu:'🎮', case:'🖱️', ram:'💿' 
};

let gameState = {
    money: GAME_CONFIG.startMoney,
    parts: {...GAME_CONFIG.startParts},
    employees: [],
    orders: [],
    lastOrderTime: Date.now(),
    orderCount: 0,
    totalOrdersCompleted: 0,
    totalOrdersFailed: 0,
    rareOrdersCompleted: 0, 
    currentShopTab: 'parts',
    supplyActive: false,
    supplyIntervalId: null,
    combo: 0,
    comboTimer: null,
    prestige: 0,
    achievements: [],
    activeEvents: [],
    lastPartNotificationTime: {},
    maxOrderLimit: GAME_CONFIG.maxOrders,
    gameLoopRequestId: null, 
    saveIntervalId: null,
    eventIntervalId: null,
    eventBadgeIntervalId: null,
    salaryIntervalId: null,
    priceUpdateIntervalId: null,
    lastSalaryTime: Date.now(),
    partPrices: {...GAME_CONFIG.partCost},
    totalSpent: 0,
    totalEarned: 0,
    failedOrderPenalty: 0,
    supplyBoost: 0
};

const ORDER_TEMPLATES = [
    { type: 'Phone', minCompleted: 0, baseParts: { battery:1, cpu:1, ram:1 }, baseTime: 150, baseReward: 80 },
    { type: 'Laptop', minCompleted: 8, baseParts: { battery:2, cpu:1, ram:2, motherboard:1 }, baseTime: 220, baseReward: 200 },
    { type: 'PC', minCompleted: 20, baseParts: { cpu:1, gpu:1, ram:2, motherboard:1, case:1 }, baseTime: 300, baseReward: 350 },
    { type: 'Server', minCompleted: 40, baseParts: { cpu:2, ram:4, motherboard:2, case:1, gpu:1 }, baseTime: 450, baseReward: 800 },
    { type: 'Supercomputer', minCompleted: 60, baseParts: { cpu:4, ram:8, motherboard:2, case:2, gpu:4, battery:4 }, baseTime: 700, baseReward: 2500, rare: true },
    { type: 'Tablet', minCompleted: 12, baseParts: { battery:2, ram:2, cpu:1 }, baseTime: 170, baseReward: 120 },
    { type: 'Gaming Console', minCompleted: 25, baseParts: { cpu:1, gpu:2, ram:2, case:1 }, baseTime: 280, baseReward: 280 },
    { type: 'Workstation', minCompleted: 35, baseParts: { cpu:2, gpu:2, ram:4, motherboard:1, case:1 }, baseTime: 380, baseReward: 550, rare: true },
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
        desc: 'High part saving',
        costMultiplier: 1.4,
        salaryMultiplier: 1.3,
        perks: { savePartChance: 0.35, speedBonus: 0 }
    },
    {
        id: 'courier',
        name: 'Courier',
        desc: 'Speed & rewards',
        costMultiplier: 1.5,
        salaryMultiplier: 1.4,
        perks: { speedBonus: 0.25, bonusReward: 0.20 }
    },
    {
        id: 'qa',
        name: 'QA Engineer',
        desc: 'No breaks, exp boost',
        costMultiplier: 1.6,
        salaryMultiplier: 1.5,
        perks: { breakPartChance: 0, expBoost: 0.25, savePartChance: 0.15 }
    }
];

const CLIENT_NOTES = [
    "Fell into water...",
    "Confused with nutcracker 🎃",
    "Took apart for SMS",
    "Burned playing Snake 🔥",
    "Microwave charge fail 🤷",
    "Cat litter box 🐈",
    "Sandwich inside 🥪",
    "Sat on it, crunchy",
    "Dark Souls trauma",
    "Tea kettle plug ☕",
    "Power supply heater",
    "Vacuum ate GPU 🌀"
];

const ACHIEVEMENTS = [
    { id: 'first_order', name: 'First Order', desc: 'Complete first order', icon: '🎯', check: s => s.totalOrdersCompleted >= 1, reward: 250 },
    { id: 'ten_orders', name: 'Experienced', desc: 'Complete 10 orders', icon: '⚡', check: s => s.totalOrdersCompleted >= 10, reward: 1000 },
    { id: 'fifty_orders', name: 'Professional', desc: 'Complete 50 orders', icon: '🏆', check: s => s.totalOrdersCompleted >= 50, reward: 4000 },
    { id: 'hundred_orders', name: 'Legend', desc: 'Complete 100 orders', icon: '👑', check: s => s.totalOrdersCompleted >= 100, reward: 10000 },
    { id: 'rich', name: 'Wealthy', desc: 'Have 100k money', icon: '💰', check: s => s.money >= 100000, reward: 3000 },
    { id: 'team', name: 'Teamwork', desc: 'Hire 5 employees', icon: '👥', check: s => s.employees.length >= 5, reward: 3500 },
    { id: 'combo_master', name: 'Combo Master', desc: 'Get x10 combo', icon: '🔥', check: s => s.combo >= 10, reward: 2000 },
    { id: 'rare_order', name: 'Rare Client', desc: 'Complete rare order', icon: '⭐', check: s => s.rareOrdersCompleted >= 1, reward: 2500 },
    { id: 'survivor', name: 'Survivor', desc: 'Fail 10 orders', icon: '💀', check: s => s.totalOrdersFailed >= 10, reward: 800 },
    { id: 'profitable', name: 'Profitable', desc: 'Earn 50k profit', icon: '📈', check: s => (s.totalEarned - s.totalSpent) >= 50000, reward: 5000 },
];

const ROLE_PREFERENCES = {
    courier: order => order.initialTime >= 220, 
    warehouse: order => Object.keys(order.partsRequired).length >= 3, 
    qa: order => order.rare, 
    technician: () => true 
};

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
        name: 'Rush Hour',
        type: 'positive',
        duration: 25000,
        icon: '⚡',
        desc: 'Rewards +60%!',
        apply: () => {
            gameState.rewardMultiplier = (gameState.rewardMultiplier || 1) * 1.6;
        },
        revert: () => {
            gameState.rewardMultiplier = (gameState.rewardMultiplier || 1) / 1.6;
        }
    },
    {
        name: 'Supplier Sale',
        type: 'positive',
        duration: 30000,
        icon: '💸',
        desc: 'Parts -50%!',
        apply: () => {
            gameState.costMultiplier = (gameState.costMultiplier || 1) * 0.5;
            updatePartPrices();
        },
        revert: () => {
            gameState.costMultiplier = (gameState.costMultiplier || 1) / 0.5;
            updatePartPrices();
        }
    },
    {
        name: 'Parts Loss',
        type: 'negative',
        duration: 0,
        icon: '💥',
        desc: 'Lost parts!',
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
        name: 'Bonus',
        type: 'positive',
        duration: 0,
        icon: '🎁',
        desc: 'Money bonus!',
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
        name: 'Strike',
        type: 'negative',
        duration: 20000,
        icon: '🚫',
        desc: 'Speed -70%!',
        apply: () => {
            gameState.speedMultiplier = (gameState.speedMultiplier || 1) * 0.3;
        },
        revert: () => {
            gameState.speedMultiplier = (gameState.speedMultiplier || 1) / 0.3;
        }
    },
    {
        name: 'Price Surge',
        type: 'negative',
        duration: 35000,
        icon: '📉',
        desc: 'Parts +100%!',
        apply: () => {
            gameState.costMultiplier = (gameState.costMultiplier || 1) * 2;
            updatePartPrices();
        },
        revert: () => {
            gameState.costMultiplier = (gameState.costMultiplier || 1) / 2;
            updatePartPrices();
        }
    },
    {
        name: 'Ad Campaign',
        type: 'positive',
        duration: 0,
        icon: '📢',
        desc: 'New orders!',
        apply: () => {
            for (let i = 0; i < 3; i++) {
                createOrder();
            }
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
    const costMult = gameState.costMultiplier || 1;
    Object.keys(GAME_CONFIG.partCost).forEach(part => {
        const basePrice = GAME_CONFIG.partCost[part];
        const demandMult = GAME_CONFIG.partDemandMultiplier[part] || 1;
        const volatility = 1 + (Math.random() - 0.5) * GAME_CONFIG.marketVolatility;
        gameState.partPrices[part] = Math.max(10, Math.floor(basePrice * demandMult * costMult * volatility));
    });
    if (gameState.currentShopTab === 'parts') {
        renderShop();
    }
}

function saveGame() {
    try {
        const saveData = {
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
        localStorage.setItem('wsdServiceSave', JSON.stringify(saveData));
    } catch (e) {
        console.error('Save error:', e);
    }
}

function loadGame() {

    if (sessionStorage.getItem('isResetting') === 'true') {
        sessionStorage.removeItem('isResetting');
        return false;
    }

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
                lastPartNotificationTime: {},
                maxOrderLimit: GAME_CONFIG.maxOrders,
                lastSalaryTime: Date.now(),
                partPrices: {...GAME_CONFIG.partCost},
                totalSpent: 0,
                totalEarned: 0,
                totalOrdersFailed: 0,
                failedOrderPenalty: 0,
                supplyBoost: 0
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

function calculateBasePartsCost(partsRequired) {
    let totalCost = 0;
    for (const [part, qty] of Object.entries(partsRequired)) {
        totalCost += (gameState.partPrices[part] || GAME_CONFIG.partCost[part] || 0) * qty;
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
    let baseReward = (basePartsCost * 1.6) + (baseTime * 2.2);
    let reward = baseReward * (0.8 + Math.random() * 0.4); 
    reward *= getPrestigeBonus(); 
    if (tpl.rare) reward *= 3; 
    if (gameState.rewardMultiplier) reward *= gameState.rewardMultiplier;
    
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
    renderOrders();
}

function renderEmployees() {
    const list = document.getElementById("employeeList");
    if (!list) return;
    const existingCards = new Map();
    Array.from(list.children).forEach(card => {
        if (card.dataset.empid) {
            existingCards.set(card.dataset.empid, card);
        } else {
            card.remove();
        }
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
}

function getOrderProgress(order) {
    if (!order.initialTime || order.initialTime === 0) return 0;
    return Math.max(0, Math.min(100, 100 - (order.timeRemaining / order.initialTime) * 100));
}

function renderOrders() {
    const list = document.getElementById('orderList');
    if (!list) return;
    
    if (gameState.orders.length === 0) {
        list.innerHTML = '<div style="text-align:center;padding:20px;opacity:0.6;grid-column:1/-1;">Awaiting orders...</div>';
        return;
    }
    
    const fragment = document.createDocumentFragment();
    const existingCards = new Map();
    
    Array.from(list.children).forEach(card => {
        if (card.dataset.orderId) {
            existingCards.set(Number(card.dataset.orderId), card);
        } else {
            card.remove();
        }
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
        const timeProgress = Math.min(100, (Math.min(order.timeRemaining, order.maxTime) / order.maxTime) * 100);
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
                statusDiv.innerHTML = `🛠 ${assignedEmployee.avatar} work`;
            } else {
                statusDiv.innerHTML = `<button class="auto-assign-btn" onclick="autoAssignOrder(${order.id})">🤖 Auto</button>`;
            }
        }
    });

    existingCards.forEach(card => card.remove());

    if (list.children.length === 0 || existingCards.size > 0 || fragment.children.length > 0) {
        list.replaceChildren(...Array.from(list.children).filter(c => c.dataset.orderId).concat(Array.from(fragment.children)));
    }
}

function autoAssignOrder(orderId) {
    const order = gameState.orders.find(o => o.id === Number(orderId));
    if (!order || order.employeeId) return;

    const bestEmployee = findBestEmployeeForOrder(order);
    if (bestEmployee) {
        assignEmployeeToOrder(bestEmployee.id, order.id);
        showNotification(`${bestEmployee.name} → ${order.type}`, 'info');
    } else {
        showNotification('No employee', 'error');
    }
}

function assignEmployeeToOrder(empId, orderId) {
    const emp = gameState.employees.find(e => e.id === empId);
    const order = gameState.orders.find(o => o.id === orderId);

    if (!emp || !order) return;
    if (emp.isBusy) {
        showNotification('Busy!', 'error');
        return;
    }
    if (order.employeeId) {
        showNotification('Already taken!', 'error');
        return;
    }

    for (const [part, qty] of Object.entries(order.partsRequired)) {
        if ((gameState.parts[part] || 0) < qty) {
            const currentTime = Date.now();
            const lastTime = gameState.lastPartNotificationTime[part] || 0;
            if (currentTime - lastTime > 60000) {
                showNotification(`Need: ${PART_ICONS[part]}`, 'error');
                gameState.lastPartNotificationTime[part] = currentTime;
            }
            return;
        }
    }

    for (const [part, qty] of Object.entries(order.partsRequired)) {
        let actualQty = qty;

        const saveChance = emp.perks.savePartChance || 0;
        const breakChance = emp.perks.breakPartChance || 0;

        if (saveChance && Math.random() < saveChance) {
            actualQty = Math.max(0, Math.ceil(qty * 0.4));
            createParticle('✨', 300, 300);
            showNotification('Parts saved!', 'info');
        } else if (breakChance && Math.random() < breakChance) {
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
        order.timeRemaining = Math.max(10, Math.floor(order.timeRemaining * 0.65));
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
    if (moneyEl) moneyEl.textContent = Math.floor(gameState.money);
    
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

function renderShop() {
    const content = document.getElementById('shopContent');
    if (!content) return;
    content.innerHTML = '';

    if (gameState.currentShopTab === 'parts') {
        const grid = document.createElement('div');
        grid.className = 'shop-grid';
        
        Object.keys(GAME_CONFIG.partCost).forEach(part => {
            const unitPrice = gameState.partPrices[part] || GAME_CONFIG.partCost[part];
            const stock = gameState.parts[part] || 0;
            
            [1, 5, 10].forEach(amount => {
                const cost = Math.floor(unitPrice * amount);
                const card = document.createElement('div');
                card.className = 'shop-card shop-part';
                card.innerHTML = `
                    <div class="shop-hero">${PART_ICONS[part]}</div>
                    <div class="shop-body">
                        <div class="shop-title">${part} x${amount}</div>
                        <div class="shop-desc">Stock: ${stock} | Unit: 💰${unitPrice}</div>
                    </div>
                    <div class="shop-actions">
                        <div class="shop-price">💰 ${cost}</div>
                        <button ${gameState.money < cost ? 'disabled' : ''}>Buy</button>
                    </div>
                `;
                const btn = card.querySelector('button');
                btn.onclick = () => buyPart(part, amount, cost);
                grid.appendChild(card);
            });
        });
        content.appendChild(grid);
    }
    else if (gameState.currentShopTab === 'employees') {
        const grid = document.createElement('div');
        grid.className = 'shop-grid';
        PROFESSIONS.forEach(p => {
            const baseCost = 600;
            const scalingFactor = Math.pow(1.35, gameState.employees.length);
            const cost = Math.floor(baseCost * (p.costMultiplier || 1) * scalingFactor);
            const salary = Math.floor(GAME_CONFIG.baseSalary * (p.salaryMultiplier || 1));
            const card = document.createElement('div');
            card.className = 'shop-card shop-employee';
            card.innerHTML = `
                <div class="shop-hero">👤</div>
                <div class="shop-body">
                    <div class="shop-title">${p.name}</div>
                    <div class="shop-desc">${p.desc}</div>
                    <div class="shop-desc" style="font-size:0.8em;margin-top:3px;">💼 Salary: 💰${salary}/3h</div>
                    <div class="shop-perks" style="font-size:0.75em;margin-top:4px;">${
                        Object.entries(p.perks || {}).map(([k,v]) => {
                            const sign = v >= 0 ? '+' : '';
                            return `${k.replace('Bonus','').replace('Chance','')}: ${sign}${Math.round(v*100)}%`;
                        }).join(' • ')
                    }</div>
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
        const upgrades = [
            { 
                name: '⚡ Speed Boost All', 
                cost: GAME_CONFIG.upgradeCost, 
                action: upgradeEmployees,
                desc: `+${GAME_CONFIG.employeeSpeedIncrease} speed each`,
                disabled: gameState.employees.length === 0
            },
            { 
                name: '📦 Auto Supply', 
                cost: GAME_CONFIG.supplyUpgradeCost, 
                action: buySupply, 
                disabled: gameState.supplyActive,
                desc: 'Parts delivery every 40s'
            },
            { 
                name: '📋 More Orders', 
                cost: GAME_CONFIG.orderIncreaseCost, 
                action: expandOrders,
                desc: `+2 slots (now: ${gameState.maxOrderLimit})`
            },
            { 
                name: '🤖 Automation', 
                cost: 10000, 
                action: buyAutomation,
                desc: 'Employee auto-takes orders',
                disabled: !gameState.employees.find(e => !e.autoWork)
            },
            { 
                name: '👑 PRESTIGE', 
                cost: GAME_CONFIG.prestigeCost, 
                action: doPrestige,
                desc: `Reset for +20% bonus (now: ${gameState.prestige}x)`
            },
            { 
                name: '🔄 RESET', 
                cost: 0, 
                action: resetGame,
                desc: 'Full game reset'
            }
        ];
        
        upgrades.forEach(upg => {
            const item = document.createElement('div');
            item.className = 'shop-item';
            const canAfford = upg.cost === 0 || gameState.money >= upg.cost;
            const isDisabled = upg.disabled || !canAfford;
            item.innerHTML = `
                <div class="shop-item-info">
                    <div class="shop-item-name">${upg.name}</div>
                    <div class="shop-item-desc">${upg.desc}</div>
                    ${upg.cost > 0 ? `<div class="shop-item-desc">💰 ${upg.cost}</div>` : ''}
                </div>
                <button ${isDisabled ? 'disabled' : ''}>${upg.cost > 0 ? 'Buy' : 'Reset'}</button>
            `;
            const btn = item.querySelector('button');
            btn.onclick = upg.action;
            content.appendChild(item);
        });
    }
    else if (gameState.currentShopTab === 'achievements') {
        ACHIEVEMENTS.forEach(ach => {
            const unlocked = gameState.achievements.includes(ach.id);
            const item = document.createElement('div');
            item.className = `achievement-item ${unlocked ? 'unlocked' : ''}`;
            item.innerHTML = `
                <div class="achievement-icon">${unlocked ? ach.icon : '🔒'}</div>
                <div class="achievement-info">
                    <div class="achievement-name">${ach.name}</div>
                    <div class="achievement-desc">${ach.desc}</div>
                    <div class="achievement-reward">💰 ${ach.reward}</div>
                </div>
            `;
            content.appendChild(item);
        });
    }
}

function buyPart(part, amount, cost) {
    if (gameState.money >= cost) {
        gameState.money -= cost;
        gameState.totalSpent += cost;
        gameState.parts[part] = (gameState.parts[part] || 0) + amount;
        updateUI();
        renderShop();
        showNotification(`Bought: ${PART_ICONS[part]} x${amount}`, 'success');
        createParticle(PART_ICONS[part], 800, 300);
    }
}

function hireEmployee(professionId = null) {
    const prof = PROFESSIONS.find(p => p.id === professionId) || PROFESSIONS[0];
    const baseCost = 600;
    const scalingFactor = Math.pow(1.35, gameState.employees.length);
    const cost = Math.floor(baseCost * (prof.costMultiplier || 1) * scalingFactor);

    if (gameState.money < cost) {
        showNotification('Not enough money!', 'error');
        return;
    }

    gameState.money -= cost;
    gameState.totalSpent += cost;

    const avatar = GAME_CONFIG.EMPLOYEE_AVATARS[Math.floor(Math.random() * GAME_CONFIG.EMPLOYEE_AVATARS.length)];
    const names = ['Alex', 'Maria', 'Ivan', 'Anna', 'Peter', 'Helen', 'Dmitry', 'Olga', 'Boris', 'Kate', 'Max', 'Sophia'];
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
    }

    gameState.employees = gameState.employees.filter(e => e.id !== empId);
    
    showNotification(`${emp.name} fired (-${severance} 💰)`, 'info');
    
    renderEmployees(); 
    updateUI();
    renderShop();
}

function upgradeEmployees() {
    const cost = GAME_CONFIG.upgradeCost;
    if (gameState.money < cost) {
        showNotification('Not enough money!', 'error');
        return;
    }
    
    if (gameState.employees.length === 0) {
        showNotification('No employees!', 'error');
        return;
    }
    
    gameState.money -= cost;
    gameState.totalSpent += cost;
    gameState.employees.forEach(e => {
        e.speed = Math.min(GAME_CONFIG.employeeMaxSpeed, e.speed + GAME_CONFIG.employeeSpeedIncrease);
    });
    
    showNotification('All upgraded!', 'success');
    renderEmployees(); 
    updateUI();
    renderShop();
}

function buySupply() {
    const cost = GAME_CONFIG.supplyUpgradeCost;
    if (gameState.money < cost) {
        showNotification('Not enough money!', 'error');
        return;
    }
    if (gameState.supplyActive) {
        showNotification('Already active!', 'warning');
        return;
    }
    
    gameState.money -= cost;
    gameState.totalSpent += cost;
    gameState.supplyActive = true;
    
    if (gameState.supplyIntervalId) clearInterval(gameState.supplyIntervalId);
    gameState.supplyIntervalId = setInterval(() => {
        if (gameState.supplyActive) {
            for (const part in GAME_CONFIG.supplyAmount) {
                const boost = (gameState.supplyBoost || 0);
                gameState.parts[part] = (gameState.parts[part] || 0) + GAME_CONFIG.supplyAmount[part] + boost;
            }
            showNotification('📦 Supply arrived!', 'success');
            updateUI();
        }
    }, GAME_CONFIG.supplyInterval);
    
    showNotification('Auto supply active!', 'success');
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
        supplyBoost: 0
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
    if (gameState.gameLoopRequestId) cancelAnimationFrame(gameState.gameLoopRequestId);
    if (gameState.saveIntervalId) clearInterval(gameState.saveIntervalId);
    if (gameState.eventIntervalId) clearInterval(gameState.eventIntervalId);
    if (gameState.eventBadgeIntervalId) clearInterval(gameState.eventBadgeIntervalId);
    if (gameState.salaryIntervalId) clearInterval(gameState.salaryIntervalId);
    if (gameState.priceUpdateIntervalId) clearInterval(gameState.priceUpdateIntervalId);
    if (gameState.comboTimer) clearTimeout(gameState.comboTimer);
}

function paySalaries() {
    if (gameState.employees.length === 0) return;
    
    let totalSalary = 0;
    gameState.employees.forEach(emp => {
        const salary = Math.floor(GAME_CONFIG.baseSalary * (emp.salaryMultiplier || 1) * (1 + emp.speed * 0.1));
        totalSalary += salary;
    });
    
    if (gameState.money < totalSalary) {
        const deficit = totalSalary - gameState.money;
        gameState.money = 0;
        gameState.failedOrderPenalty = (gameState.failedOrderPenalty || 0) + deficit;
        showNotification(`⚠️ Salary deficit: ${deficit} 💰`, 'error');
        createParticle('💸', window.innerWidth / 2, window.innerHeight / 2);
    } else {
        gameState.money -= totalSalary;
        gameState.totalSpent += totalSalary;
        showNotification(`💼 Salaries: -${totalSalary} 💰`, 'info');
    }
    
    gameState.lastSalaryTime = Date.now();
    updateUI();
}

function incrementCombo() {
    gameState.combo++;
    
    if (gameState.comboTimer) {
        clearTimeout(gameState.comboTimer);
    }
    
    gameState.comboTimer = setTimeout(() => {
        gameState.combo = 0;
        updateUI();
    }, GAME_CONFIG.comboDecayTime);
    
    checkAchievements();
    updateUI();
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
            const eventData = {
                name: event.name,
                endTime: Date.now() + event.duration
            };
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
    } else {
        setTimeout(() => {
            badge.style.opacity = '0';
            setTimeout(() => badge.remove(), 500);
        }, 3000);
    }
}

function renderEventBadges() {
    const banner = document.getElementById('eventsBanner');
    if (!banner) return;
    
    gameState.activeEvents.forEach(evt => {
        const remaining = Math.max(0, Math.ceil((evt.endTime - Date.now()) / 1000));
        
        let badge = document.querySelector(`.event-badge[data-event-name="${evt.name}"]`);
        
        if (remaining > 0) {
            if (!badge) {
                badge = document.createElement('div');
                badge.className = `event-badge positive`;
                badge.dataset.eventName = evt.name;
                banner.appendChild(badge);
            }
            badge.textContent = `${evt.name} (${remaining}s)`;
        } else if (badge) {
            badge.remove();
        }
    });

    Array.from(banner.children).forEach(badge => {
        if (!gameState.activeEvents.some(e => e.name === badge.dataset.eventName)) {
            badge.remove();
        }
    });
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    const container = document.getElementById('notificationContainer');
    if (container) container.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(400px)';
        setTimeout(() => notification.remove(), 500);
    }, 3000);
}

function createParticle(emoji, x, y) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.textContent = emoji;
    particle.style.left = x + 'px';
    particle.style.top = y + 'px';
    
    const container = document.getElementById('particleContainer');
    if (container) container.appendChild(particle);
    
    setTimeout(() => particle.remove(), 1500);
}

let lastTimestamp = 0;
const ORDER_PROCESSING_INTERVAL = 100;

function findBestEmployeeForOrder(order) {
    const availableEmployees = gameState.employees.filter(emp => !emp.isBusy);
    if (!availableEmployees.length) return null;
    
    for (const [part, qty] of Object.entries(order.partsRequired)) {
        if ((gameState.parts[part] || 0) < qty) return null;
    }

    const scoredEmployees = availableEmployees.map(emp => {
        let score = 0;
        
        if (ROLE_PREFERENCES[emp.role]?.(order)) score += 50;
        if (emp.role === 'courier' && order.initialTime >= 220) score += 30;
        if (emp.role === 'qa' && order.rare) score += 40;
        if (emp.role === 'warehouse' && Object.keys(order.partsRequired).length >= 3) score += 25;
        
        score += emp.speed * 10;
        score += (emp.perks.speedBonus || 0) * 100;
        score += (emp.perks.savePartChance || 0) * 80;
        score -= (emp.perks.breakPartChance || 0) * 50;
        
        return { employee: emp, score };
    });

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
    
    let ordersChanged = false;

    gameState.employees.forEach(emp => {
        if (emp.autoWork && !emp.isBusy) {
            const availableOrders = gameState.orders.filter(o => !o.employeeId && !o.failed);
            const bestOrder = availableOrders.find(order => 
                ROLE_PREFERENCES[emp.role]?.(order) && 
                Object.entries(order.partsRequired)
                    .every(([part, qty]) => (gameState.parts[part] || 0) >= qty)
            );
            
            if (bestOrder) {
                assignEmployeeToOrder(emp.id, bestOrder.id);
            }
        }
    });
    
    gameState.orders.forEach(order => {
        if (!order.failed) {
            if (order.employeeId) {
                const emp = gameState.employees.find(e => e.id === order.employeeId);
                if (emp) {
                    const speedWithPerks = emp.speed * (1 + (emp.perks?.speedBonus || 0));
                    const speedMultiplier = gameState.speedMultiplier || 1;
                    order.timeRemaining -= speedWithPerks * speedMultiplier * (ORDER_PROCESSING_INTERVAL / 100); 
                    
                    if (order.timeRemaining <= 0 && !order.completed) {
                        let reward = order.reward;
                        
                        if (emp.perks?.bonusReward) {
                            reward = Math.round(reward * (1 + emp.perks.bonusReward));
                        }
                        
                        const comboBonus = 1 + (gameState.combo * 0.05);
                        reward = Math.round(reward * comboBonus);
                        
                        gameState.money += reward;
                        gameState.totalEarned += reward;
                        gameState.totalOrdersCompleted++;
                        ordersChanged = true;
                        
                        if (order.rare) {
                            gameState.rareOrdersCompleted = (gameState.rareOrdersCompleted || 0) + 1;
                        }
                        
                        emp.isBusy = false;
                        emp.ordersCompleted++;
                        
                        if (emp.ordersCompleted % GAME_CONFIG.employeeSpeedIncrementEvery === 0 &&
                            emp.speed < GAME_CONFIG.employeeMaxSpeed) {
                            const expBoost = emp.perks?.expBoost || 0;
                            const speedGain = 0.5 * (1 + expBoost);
                            emp.speed = Math.min(GAME_CONFIG.employeeMaxSpeed, emp.speed + speedGain);
                            showNotification(`${emp.name} leveled up! ${emp.speed.toFixed(1)}`, 'success');
                            renderEmployees(); 
                        }
                        
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
            } else {
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
        }
    });
    
    const initialOrderCount = gameState.orders.length;
    gameState.orders = gameState.orders.filter(o => !o.completed && !o.failed);
    const finalOrderCount = gameState.orders.length;

    if (ordersChanged || initialOrderCount !== finalOrderCount) {
        renderOrders();
        renderEmployees();
    }
    
    updateUI();
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

function initIntervals() {
    clearAllIntervals();

    gameState.gameLoopRequestId = requestAnimationFrame(gameTick);
    gameState.saveIntervalId = setInterval(saveGame, 15000);
    gameState.eventIntervalId = setInterval(triggerRandomEvent, 120000);
    gameState.eventBadgeIntervalId = setInterval(renderEventBadges, 1000);
    
    gameState.salaryIntervalId = setInterval(() => {
        paySalaries();
    }, GAME_CONFIG.salaryInterval);
    
    gameState.priceUpdateIntervalId = setInterval(() => {
        updatePartPrices();
    }, 60000);

    if (gameState.supplyActive) {
        gameState.supplyIntervalId = setInterval(() => {
            for (const part in GAME_CONFIG.supplyAmount) {
                const boost = (gameState.supplyBoost || 0);
                gameState.parts[part] = (gameState.parts[part] || 0) + GAME_CONFIG.supplyAmount[part] + boost;
            }
            showNotification('📦 Supply!', 'success');
            updateUI();
        }, GAME_CONFIG.supplyInterval);
    }
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

window.addEventListener('load', init);
window.addEventListener('beforeunload');

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        saveGame();
    }
});
