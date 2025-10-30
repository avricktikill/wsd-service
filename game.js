const GAME_CONFIG = {
    startMoney: 10000,
    startParts: { battery: 5, motherboard: 5, cpu: 5, gpu: 5, case: 5, ram: 5 },
    partCost: { battery: 10, motherboard: 50, cpu: 40, gpu: 100, case: 25, ram: 20 },
    upgradeCost: 100,
    supplyUpgradeCost: 10000,
    supplyInterval: 35000,
    supplyAmount: { battery: 2, motherboard: 1, cpu: 1, gpu: 1, case: 1, ram: 2 },
    employeeSpeedIncrease: 0.5,
    orderInterval: 3000,
    employeeSpeedIncrementEvery: 5,
    maxOrders: 8,
    orderIncreaseCost: 5000,
    employeeMaxSpeed: 10,
    EMPLOYEE_AVATARS: ['👨‍🔧','👩‍🔧','👨‍🔬','👩‍🔬','🧑‍💻','👨‍🏭'],
    comboDecayTime: 5000,
    prestigeCost: 100000
};

const PART_ICONS = { 
    battery:'🔋', 
    motherboard:'💻', 
    cpu:'🖥️', 
    gpu:'🎮', 
    case:'🖱️', 
    ram:'💿' 
};

let gameState = {
    money: GAME_CONFIG.startMoney,
    parts: {...GAME_CONFIG.startParts},
    employees: [],
    orders: [],
    lastOrderTime: Date.now(),
    orderCount: 0,
    totalOrdersCompleted: 0,
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
    gameLoopIntervalId: null,
    saveIntervalId: null,
    eventIntervalId: null,
    eventBadgeIntervalId: null
};

const ORDER_TEMPLATES = [
    { type: 'Телефон', minCompleted: 0, baseParts: { battery:1, cpu:1, ram:1 }, baseTime: 100, baseReward: 25 },
    { type: 'Ноутбук', minCompleted: 5, baseParts: { battery:2, cpu:1, ram:2, motherboard:1 }, baseTime: 150, baseReward: 50 },
    { type: 'ПК', minCompleted: 15, baseParts: { cpu:1, gpu:1, ram:2, motherboard:1, case:1 }, baseTime: 200, baseReward: 75 },
    { type: 'Сервер', minCompleted: 30, baseParts: { cpu:2, ram:4, motherboard:1, case:1, gpu:2 }, baseTime: 300, baseReward: 150 },
    { type: 'Суперкомпьютер', minCompleted: 50, baseParts: { cpu:4, ram:8, motherboard:2, case:2, gpu:4, battery:5 }, baseTime: 500, baseReward: 1000, rare: true },
    { type: 'Планшет', minCompleted: 10, baseParts: { battery:1, ram:2, cpu:1 }, baseTime: 120, baseReward: 40 },
    { type: 'Игровая консоль', minCompleted: 20, baseParts: { cpu:1, gpu:1, ram:1, case:1 }, baseTime: 180, baseReward: 60 },
];

const CLIENT_NOTES = [
    "Упал в воду, теперь только пузыри идут...",
    "Случайно перепутал с орехоколом 🎃🥜",
    "Разобрал, чтобы посмотреть, где живут смс — не собрал обратно",
    "Играл в змейку, и он сгорел 🔥",
    "Заряжал через микроволновку — не заряжается 🤷",
    "Кот решил, что ноутбук — это лоток 🐈",
    "Закрыл крышку, забыв про бутерброд внутри 🥪",
    "Сидел на нём во время пар, теперь экран хрустит",
    "Играл в Dark Souls, ноут не выдержал психической нагрузки",
    "Подключил к розетке через вилку от чайника 🍵",
    "Думал, что блок питания — это обогреватель",
    "Пылесосил системник, засосало видеокарту 🌀"
];

const ACHIEVEMENTS = [
    { id: 'first_order', name: 'Первый заказ', desc: 'Выполните первый заказ', icon: '🎯', check: s => s.totalOrdersCompleted >= 1, reward: 100 },
    { id: 'ten_orders', name: 'Опытный мастер', desc: 'Выполните 10 заказов', icon: '⚡', check: s => s.totalOrdersCompleted >= 10, reward: 500 },
    { id: 'fifty_orders', name: 'Профессионал', desc: 'Выполните 50 заказов', icon: '🏆', check: s => s.totalOrdersCompleted >= 50, reward: 2000 },
    { id: 'hundred_orders', name: 'Легенда', desc: 'Выполните 100 заказов', icon: '👑', check: s => s.totalOrdersCompleted >= 100, reward: 5000 },
    { id: 'rich', name: 'Богач', desc: 'Накопите 50000 денег', icon: '💰', check: s => s.money >= 50000, reward: 1000 },
    { id: 'team', name: 'Командная работа', desc: 'Наймите 5 сотрудников', icon: '👥', check: s => s.employees.length >= 5, reward: 1500 },
    { id: 'combo_master', name: 'Комбо мастер', desc: 'Достигните комбо x5', icon: '🔥', check: s => s.combo >= 5, reward: 800 },
    { id: 'rare_order', name: 'Редкий клиент', desc: 'Выполните редкий заказ', icon: '⭐', check: s => s.rareOrdersCompleted >= 1, reward: 1000 },
];

const RANDOM_EVENTS = [
    {
        name: 'Час пик',
        type: 'positive',
        duration: 15000,
        icon: '⚡',
        desc: 'Вознаграждения увеличены на 50%!',
        apply: () => {
            gameState.rewardMultiplier = (gameState.rewardMultiplier || 1) * 1.5;
        },
        revert: () => {
            gameState.rewardMultiplier = (gameState.rewardMultiplier || 1) / 1.5;
        }
    },
    {
        name: 'Скидка от поставщика',
        type: 'positive',
        duration: 20000,
        icon: '💸',
        desc: 'Цены на детали снижены на 30%!',
        apply: () => {
            gameState.costMultiplier = (gameState.costMultiplier || 1) * 0.7;
        },
        revert: () => {
            gameState.costMultiplier = (gameState.costMultiplier || 1) / 0.7;
        }
    },
    {
        name: 'Неожиданная поломка',
        type: 'negative',
        duration: 0,
        icon: '💥',
        desc: 'Потеряно случайное количество деталей!',
        apply: () => {
            const parts = Object.keys(gameState.parts);
            const randomPart = parts[Math.floor(Math.random() * parts.length)];
            const loss = Math.min(3, gameState.parts[randomPart]);
            gameState.parts[randomPart] = Math.max(0, gameState.parts[randomPart] - loss);
            showNotification(`Потеряно: ${PART_ICONS[randomPart]} x${loss}`, 'error');
        },
        revert: () => {}
    },
    {
        name: 'Бонусный клиент',
        type: 'positive',
        duration: 0,
        icon: '🎁',
        desc: 'Получен бонус деньгами!',
        apply: () => {
            const bonus = 500 + Math.floor(Math.random() * 1000);
            gameState.money += bonus;
            showNotification(`Бонус: 💰 ${bonus}`, 'success');
            createParticle('💰', window.innerWidth / 2, window.innerHeight / 2);
        },
        revert: () => {}
    },
    {
        name: 'Забастовка сотрудников',
        type: 'negative',
        duration: 10000,
        icon: '🚫',
        desc: 'Сотрудники работают на 50% медленнее!',
        apply: () => {
            gameState.speedMultiplier = (gameState.speedMultiplier || 1) * 0.5;
        },
        revert: () => {
            gameState.speedMultiplier = (gameState.speedMultiplier || 1) / 0.5;
        }
    },
    {
        name: 'Вирусная реклама',
        type: 'positive',
        duration: 0,
        icon: '📢',
        desc: 'Появились дополнительные заказы!',
        apply: () => {
            for (let i = 0; i < 3; i++) {
                createOrder();
            }
            showNotification('Получено 3 новых заказа!', 'success');
        },
        revert: () => {}
    }
];

function getRandomNote() {
    return CLIENT_NOTES[Math.floor(Math.random() * CLIENT_NOTES.length)];
}

function getPrestigeBonus() {
    return 1 + (gameState.prestige * 0.1);
}

function saveGame() {
    try {
        localStorage.setItem('wsdServiceSave', JSON.stringify(gameState));
    } catch (e) {
        console.error('Ошибка сохранения:', e);
    }
}

function loadGame() {
    try {
        const saved = localStorage.getItem('wsdServiceSave');
        if (saved) {
            const loaded = JSON.parse(saved);
            const defaultState = {
                achievements: [],
                prestige: 0,
                combo: 0,
                activeEvents: [],
                rareOrdersCompleted: 0,
                lastPartNotificationTime: {},
                maxOrderLimit: GAME_CONFIG.maxOrders,
                supplyIntervalId: null,
                gameLoopIntervalId: null,
                saveIntervalId: null,
                eventIntervalId: null,
                eventBadgeIntervalId: null
            };
            gameState = { ...defaultState, ...gameState, ...loaded };
        }
    } catch (e) {
        console.error('Ошибка загрузки:', e);
    }
}

function createOrder() {
    if (gameState.orders.length >= gameState.maxOrderLimit) return;
    
    const available = ORDER_TEMPLATES.filter(o => gameState.totalOrdersCompleted >= o.minCompleted);
    if (!available.length) return;
    
    const rareOrders = available.filter(o => o.rare);
    const normalOrders = available.filter(o => !o.rare);
    
    let tpl = (rareOrders.length && Math.random() < 0.1)
        ? rareOrders[Math.floor(Math.random() * rareOrders.length)]
        : normalOrders[Math.floor(Math.random() * normalOrders.length)];
    
    if (!tpl) return;
    
    const partsRequired = {};
    for (const [part, qty] of Object.entries(tpl.baseParts)) {
        partsRequired[part] = Math.max(1, Math.round(qty * (0.8 + Math.random() * 0.4)));
    }
    
    let reward = Math.round(tpl.baseReward * (0.8 + Math.random() * 0.4) * getPrestigeBonus());
    if (tpl.rare) reward = Math.round(reward * 2);
    if (gameState.rewardMultiplier) reward = Math.round(reward * gameState.rewardMultiplier);
    
    const order = {
        id: gameState.orderCount++,
        type: tpl.type,
        partsRequired,
        initialTime: tpl.baseTime,
        timeRemaining: tpl.baseTime,
        reward,
        note: getRandomNote(),
        employeeId: null,
        completed: false,
        rare: tpl.rare || false
    };
    
    gameState.orders.push(order);
    renderOrders();
}

function renderEmployees() {
    const list = document.getElementById("employeeList");
    list.innerHTML = "";
    
    if (gameState.employees.length === 0) {
        list.innerHTML = '<div style="text-align: center; padding: 20px; opacity: 0.6;">Нанимайте сотрудников в магазине!</div>';
        return;
    }
    
    const fireBtnStyle = `
        position: absolute; 
        top: 5px; 
        right: 10px; 
        font-size: 1.5em; 
        font-weight: bold; 
        cursor: pointer; 
        transition: transform 0.2s;
        line-height: 1;
        padding: 2px 5px;
        color: rgba(255, 255, 255, 0.7);
    `;
    
    gameState.employees.forEach(emp => {
        const card = document.createElement("div");
        card.className = `employee-card ${emp.isBusy ? 'busy' : ''}`;
        card.draggable = !emp.isBusy;
        
        let perksHTML = '';
        if (emp.perks.speedBonus) perksHTML += `<div class="perk-item">⚡ +${Math.round(emp.perks.speedBonus*100)}% скорость</div>`;
        if (emp.perks.savePartChance) perksHTML += `<div class="perk-item">🔧 ${Math.round(emp.perks.savePartChance*100)}% экономия</div>`;
        if (emp.perks.breakPartChance) perksHTML += `<div class="perk-item">💥 ${Math.round(emp.perks.breakPartChance*100)}% поломка</div>`;
        if (emp.perks.bonusReward) perksHTML += `<div class="perk-item">💰 +${Math.round(emp.perks.bonusReward*100)}% награда</div>`;
        if (emp.perks.expBoost) perksHTML += `<div class="perk-item">📚 +${Math.round(emp.perks.expBoost*100)}% опыт</div>`;
        
        const fireButtonHTML = emp.id !== 'emp-starter' ? `
            <div class="fire-employee-btn" data-empid="${emp.id}" style="${fireBtnStyle}" 
                 onmouseover="this.style.transform='scale(1.2)'; this.style.color='rgba(255, 100, 100, 1)';" 
                 onmouseout="this.style.transform='scale(1)'; this.style.color='rgba(255, 255, 255, 0.7)';">
                &times;
            </div>
        ` : '';

        card.innerHTML = `
            ${fireButtonHTML}
            <div class="employee-avatar">${emp.avatar}</div>
            <div class="employee-stats">
                <div><strong>${emp.name || 'Сотрудник'}</strong></div>
                <div>Скорость: ${emp.speed.toFixed(1)}</div>
                <div>Выполнил: ${emp.ordersCompleted}</div>
                <div style="margin-top: 5px;">${emp.isBusy ? '🛠 В работе' : '✅ Свободен'}</div>
            </div>
            ${perksHTML ? `<div class="perk-list">${perksHTML}</div>` : ''}
        `;
        
        card.addEventListener('dragstart', e => {
            if (!emp.isBusy) {
                e.dataTransfer.setData('text/plain', emp.id);
                card.style.opacity = '0.5';
            }
        });
        
        card.addEventListener('dragend', e => {
            card.style.opacity = '1';
        });
        
        list.appendChild(card);
    });
}

function renderOrders() {
    const list = document.getElementById('orderList');
    list.innerHTML = '';
    
    if (gameState.orders.length === 0) {
        list.innerHTML = '<div style="text-align: center; padding: 20px; opacity: 0.6; grid-column: 1/-1;">Ожидание новых заказов...</div>';
        return;
    }
    
    gameState.orders.forEach(order => {
        const card = document.createElement('div');
        card.className = `order-card ${order.rare ? 'rare' : ''}`;
        card.dataset.orderId = order.id;
        
        let partsText = Object.entries(order.partsRequired)
            .map(([p, qty]) => `${PART_ICONS[p]} x${qty}`).join(' ');
        
        const progress = Math.min(100, 100 - (order.timeRemaining / order.initialTime) * 100);
        
        const assignedEmployee = order.employeeId 
            ? gameState.employees.find(e => e.id === order.employeeId)
            : null;
        
        card.innerHTML = `
            <div class="order-type">${order.rare ? '⭐ ' : ''}${order.type} #${order.id}</div>
            <div class="order-note">"${order.note}"</div>
            <div class="order-reward">💰 ${order.reward}</div>
            <div class="order-parts">${partsText}</div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${progress}%"></div>
            </div>
            <div class="order-status">
                ${assignedEmployee ? `🛠 ${assignedEmployee.avatar} работает` : '⏳ Ожидает'}
            </div>
        `;
        
        card.addEventListener('dragenter', e => {
            e.preventDefault();
            card.classList.add('drag-over');
        });

        card.addEventListener('dragover', e => {
            e.preventDefault();
        });
        
        card.addEventListener('dragleave', () => {
            card.classList.remove('drag-over');
        });
        
        card.addEventListener('drop', e => {
            e.preventDefault();
            card.classList.remove('drag-over');
            const empId = e.dataTransfer.getData('text/plain');
            assignEmployeeToOrder(empId, order.id);
        });
        
        list.appendChild(card);
    });
}

function assignEmployeeToOrder(empId, orderId) {
    const emp = gameState.employees.find(e => e.id === empId);
    const order = gameState.orders.find(o => o.id === orderId);
    
    if (!emp || !order) return;
    if (emp.isBusy) {
        showNotification('Сотрудник занят!', 'error');
        return;
    }
    if (order.employeeId) {
        showNotification('Заказ уже выполняется!', 'error');
        return;
    }
    
    for (const [part, qty] of Object.entries(order.partsRequired)) {
        if ((gameState.parts[part] || 0) < qty) {
            
            const currentTime = Date.now();
            const lastTime = gameState.lastPartNotificationTime[part] || 0;
            const throttleDelay = 60000;
            
            if (currentTime - lastTime > throttleDelay) {
                showNotification(`Недостаточно деталей: ${PART_ICONS[part]}`, 'error');
                gameState.lastPartNotificationTime[part] = currentTime;
            }
            return;
        }
    }
    
    for (const [part, qty] of Object.entries(order.partsRequired)) {
        let actualQty = qty;
        
        if (emp.perks.savePartChance && Math.random() < emp.perks.savePartChance) {
            actualQty = 0;
            createParticle('✨', 300, 300);
            showNotification('Сотрудник сэкономил детали!', 'info');
        } else if (emp.perks.breakPartChance && Math.random() < emp.perks.breakPartChance) {
            actualQty = qty * 2;
            createParticle('💥', 300, 300);
            showNotification('Сотрудник сломал детали!', 'warning');
        }
        
        gameState.parts[part] = Math.max(0, (gameState.parts[part] || 0) - actualQty);
    }
    
    emp.isBusy = true;
    order.employeeId = emp.id;
    order.timeRemaining = order.initialTime;
    
    createParticle('🔧', 500, 400);
    renderEmployees();
    renderOrders();
    updateUI();
}

function updateUI() {
    document.getElementById('money').textContent = Math.floor(gameState.money);
    document.getElementById('parts').textContent = Object.entries(gameState.parts)
        .map(([key, val]) => `${PART_ICONS[key]}${val}`).join(' ');
    document.getElementById('completed').textContent = gameState.totalOrdersCompleted;
    document.getElementById('combo').textContent = gameState.combo + 'x';
    document.getElementById('prestige').textContent = gameState.prestige;
}

function renderShop() {
    const content = document.getElementById('shopContent');
    content.innerHTML = '';
    
    const costMult = gameState.costMultiplier || 1;
    
    if (gameState.currentShopTab === 'parts') {
        for (const part in GAME_CONFIG.partCost) {
            const amounts = [1, 10, 100];
            const container = document.createElement('div');
            container.style.marginBottom = '15px';
            
            amounts.forEach(amount => {
                const cost = Math.floor(GAME_CONFIG.partCost[part] * amount * costMult);
                const item = document.createElement('div');
                item.className = 'shop-item';
                item.innerHTML = `
                    <div class="shop-item-info">
                        <div class="shop-item-name">${PART_ICONS[part]} x${amount}</div>
                        <div class="shop-item-desc">💰 ${cost}</div>
                    </div>
                    <button ${gameState.money < cost ? 'disabled' : ''}>Купить</button>
                `;
                item.querySelector('button').onclick = () => buyPart(part, amount, cost);
                container.appendChild(item);
            });
            
            content.appendChild(container);
        }
    } 
    else if (gameState.currentShopTab === 'employees') {
        const hireCost = 100;
        const item = document.createElement('div');
        item.className = 'shop-item';
        item.innerHTML = `
            <div class="shop-item-info">
                <div class="shop-item-name">👤 Нанять сотрудника</div>
                <div class="shop-item-desc">Случайные перки и характеристики</div>
                <div class="shop-item-desc">💰 ${hireCost}</div>
            </div>
            <button ${gameState.money < hireCost ? 'disabled' : ''}>Нанять</button>
        `;
        item.querySelector('button').onclick = hireEmployee;
        content.appendChild(item);
    } 
    else if (gameState.currentShopTab === 'upgrades') {
        const upgrades = [
            { 
                name: '⚡ Ускорить всех сотрудников', 
                cost: GAME_CONFIG.upgradeCost, 
                action: upgradeEmployees,
                desc: `+${GAME_CONFIG.employeeSpeedIncrease} к скорости всех`
            },
            { 
                name: '📦 Регулярные поставки', 
                cost: GAME_CONFIG.supplyUpgradeCost, 
                action: buySupply, 
                disabled: gameState.supplyActive,
                desc: 'Автоматическая доставка деталей каждые 35 сек'
            },
            { 
                name: '📋 Расширить лимит заказов', 
                cost: GAME_CONFIG.orderIncreaseCost, 
                action: expandOrders,
                desc: `+5 к максимуму заказов (текущий: ${gameState.maxOrderLimit})`
            },
            { 
                name: '🤖 Автоматизация сотрудника', 
                cost: 5000, 
                action: buyAutomation,
                desc: 'Сотрудник будет брать заказы автоматически'
            },
            { 
                name: '👑 ПРЕСТИЖ', 
                cost: GAME_CONFIG.prestigeCost, 
                action: doPrestige,
                desc: `Сброс игры с бонусом +10% ко всем наградам (текущий: ${gameState.prestige})`
            },
            { 
                name: '🔄 Сбросить игру', 
                cost: 0, 
                action: resetGame,
                desc: 'Полный сброс прогресса'
            }
        ];
        
        upgrades.forEach(upg => {
            const item = document.createElement('div');
            item.className = 'shop-item';
            const canAfford = upg.cost === 0 || gameState.money >= upg.cost;
            item.innerHTML = `
                <div class="shop-item-info">
                    <div class="shop-item-name">${upg.name}</div>
                    <div class="shop-item-desc">${upg.desc}</div>
                    ${upg.cost > 0 ? `<div class="shop-item-desc">💰 ${upg.cost}</div>` : ''}
                </div>
                <button ${upg.disabled || !canAfford ? 'disabled' : ''}>
                    ${upg.cost > 0 ? 'Купить' : 'Сброс'}
                </button>
            `;
            item.querySelector('button').onclick = upg.action;
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
                    <div class="achievement-reward">Награда: 💰 ${ach.reward}</div>
                </div>
            `;
            content.appendChild(item);
        });
    }
}

function buyPart(part, amount, cost) {
    if (gameState.money >= cost) {
        gameState.money -= cost;
        gameState.parts[part] += amount;
        updateUI();
        renderShop();
        showNotification(`Куплено: ${PART_ICONS[part]} x${amount}`, 'success');
        createParticle(PART_ICONS[part], 800, 300);
    }
}

function hireEmployee() {
    const cost = 100;
    if (gameState.money < cost) {
        showNotification('Недостаточно денег!', 'error');
        return;
    }
    
    gameState.money -= cost;
    
    const avatar = GAME_CONFIG.EMPLOYEE_AVATARS[
        Math.floor(Math.random() * GAME_CONFIG.EMPLOYEE_AVATARS.length)
    ];
    
    const names = ['Алекс', 'Мария', 'Иван', 'Анна', 'Петр', 'Елена', 'Дмитрий', 'Ольга'];
    const name = names[Math.floor(Math.random() * names.length)];
    
    const perks = {
        speedBonus: Math.random() < 0.5 ? (0.05 + Math.random() * 0.15) : 0,
        savePartChance: Math.random() < 0.3 ? (0.15 + Math.random() * 0.25) : 0,
        breakPartChance: Math.random() < 0.15 ? (0.05 + Math.random() * 0.15) : 0,
        bonusReward: Math.random() < 0.25 ? (0.1 + Math.random() * 0.3) : 0,
        expBoost: Math.random() < 0.2 ? (0.2 + Math.random() * 0.5) : 0
    };
    
    const employee = {
        id: `emp-${Date.now()}-${Math.random()}`,
        avatar,
        name,
        speed: 1,
        isBusy: false,
        ordersCompleted: 0,
        autoWork: false,
        perks
    };
    
    gameState.employees.push(employee);
    
    renderEmployees();
    updateUI();
    renderShop();
    showNotification(`Нанят: ${name} ${avatar}`, 'success');
    checkAchievements();
}

function fireEmployee(empId) {
    const emp = gameState.employees.find(e => e.id === empId);
    if (!emp) return;
    
    if (emp.isBusy) {
        showNotification('Нельзя уволить занятого сотрудника!', 'error');
        return;
    }

    if (emp.id === 'emp-starter') {
        showNotification('Нельзя уволить стартового стажера!', 'error');
        return;
    }

    const severance = Math.floor(gameState.money * 0.10);
    
    if (!confirm(`Уволить ${emp.name}? Это будет стоить ${severance} 💰 (10% выходного пособия).`)) {
        return;
    }

    if (gameState.money < severance) {
        showNotification('Недостаточно денег для выплаты пособия!', 'error');
        return;
    }

    gameState.money -= severance;
    gameState.employees = gameState.employees.filter(e => e.id !== empId);
    
    showNotification(`${emp.name} уволен. Выплачено ${severance} 💰.`, 'info');
    
    renderEmployees();
    updateUI();
}

function upgradeEmployees() {
    const cost = GAME_CONFIG.upgradeCost;
    if (gameState.money < cost) {
        showNotification('Недостаточно денег!', 'error');
        return;
    }
    
    if (gameState.employees.length === 0) {
        showNotification('Нет сотрудников для улучшения!', 'error');
        return;
    }
    
    gameState.money -= cost;
    gameState.employees.forEach(e => {
        e.speed = Math.min(GAME_CONFIG.employeeMaxSpeed, e.speed + GAME_CONFIG.employeeSpeedIncrease);
    });
    
    showNotification('Все сотрудники стали быстрее!', 'success');
    renderEmployees();
    updateUI();
    renderShop();
}

function buySupply() {
    const cost = GAME_CONFIG.supplyUpgradeCost;
    if (gameState.money < cost) {
        showNotification('Недостаточно денег!', 'error');
        return;
    }
    if (gameState.supplyActive) {
        showNotification('Поставки уже активны!', 'warning');
        return;
    }
    
    gameState.money -= cost;
    gameState.supplyActive = true;
    
    if (gameState.supplyIntervalId) clearInterval(gameState.supplyIntervalId);
    gameState.supplyIntervalId = setInterval(() => {
        if (gameState.supplyActive) {
            for (const part in GAME_CONFIG.supplyAmount) {
                gameState.parts[part] += GAME_CONFIG.supplyAmount[part];
            }
            showNotification('📦 Поставка деталей получена!', 'success');
            updateUI();
        }
    }, GAME_CONFIG.supplyInterval);
    
    showNotification('Регулярные поставки активированы!', 'success');
    updateUI();
    renderShop();
}

function expandOrders() {
    const cost = GAME_CONFIG.orderIncreaseCost;
    if (gameState.money < cost) {
        showNotification('Недостаточно денег!', 'error');
        return;
    }
    
    gameState.money -= cost;
    gameState.maxOrderLimit += 5;
    
    showNotification('Лимит заказов увеличен!', 'success');
    updateUI();
    renderShop();
}

function buyAutomation() {
    const cost = 5000;
    if (gameState.money < cost) {
        showNotification('Недостаточно денег!', 'error');
        return;
    }
    
    const emp = gameState.employees.find(e => !e.autoWork);
    if (!emp) {
        showNotification('Все сотрудники уже автоматизированы!', 'warning');
        return;
    }
    
    gameState.money -= cost;
    emp.autoWork = true;
    
    showNotification(`${emp.name} теперь работает автоматически!`, 'success');
    updateUI();
    renderShop();
}

function doPrestige() {
    if (gameState.money < GAME_CONFIG.prestigeCost) {
        showNotification('Недостаточно денег для престижа!', 'error');
        return;
    }
    
    if (!confirm(`Престиж сбросит весь прогресс, но даст +10% ко всем наградам навсегда!\n\nТекущий бонус: +${gameState.prestige * 10}%\nНовый бонус: +${(gameState.prestige + 1) * 10}%\n\nПродолжить?`)) {
        return;
    }
    
    if (gameState.supplyIntervalId) clearInterval(gameState.supplyIntervalId);
    if (gameState.gameLoopIntervalId) clearInterval(gameState.gameLoopIntervalId);
    if (gameState.saveIntervalId) clearInterval(gameState.saveIntervalId);
    if (gameState.eventIntervalId) clearInterval(gameState.eventIntervalId);
    if (gameState.eventBadgeIntervalId) clearInterval(gameState.eventBadgeIntervalId);
    
    gameState.prestige++;
    gameState.money = GAME_CONFIG.startMoney;
    gameState.parts = {...GAME_CONFIG.startParts};
    gameState.employees = [];
    gameState.orders = [];
    gameState.totalOrdersCompleted = 0;
    gameState.combo = 0;
    gameState.supplyActive = false;
    gameState.supplyIntervalId = null;
    gameState.maxOrderLimit = GAME_CONFIG.maxOrders;
    gameState.gameLoopIntervalId = null;
    gameState.saveIntervalId = null;
    gameState.eventIntervalId = null;
    gameState.eventBadgeIntervalId = null;
    
    showNotification(`🎉 Престиж ${gameState.prestige}! Бонус: +${gameState.prestige * 10}%`, 'success');
    renderEmployees();
    renderOrders();
    renderShop();
    updateUI();
    initIntervals();
    saveGame();
}

function resetGame() {
    if (!confirm('Вы уверены? Весь прогресс будет потерян!')) return;
    
    window.removeEventListener('beforeunload', saveGame);
    
    if (gameState.supplyIntervalId) clearInterval(gameState.supplyIntervalId);
    if (gameState.gameLoopIntervalId) clearInterval(gameState.gameLoopIntervalId);
    if (gameState.saveIntervalId) clearInterval(gameState.saveIntervalId);
    if (gameState.eventIntervalId) clearInterval(gameState.eventIntervalId);
    if (gameState.eventBadgeIntervalId) clearInterval(gameState.eventBadgeIntervalId);
    
    localStorage.removeItem('wsdServiceSave');
    location.reload();
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
        <div style="font-size: 1.5em; margin-bottom: 5px;">${ach.icon} Достижение!</div>
        <div style="font-weight: bold;">${ach.name}</div>
        <div style="opacity: 0.8;">${ach.desc}</div>
        <div style="color: #fbbf24; margin-top: 5px;">+${ach.reward} 💰</div>
    `;
    
    document.getElementById('notificationContainer').appendChild(popup);
    
    setTimeout(() => {
        popup.style.opacity = '0';
        popup.style.transform = 'translateX(400px)';
        setTimeout(() => popup.remove(), 500);
    }, 5000);
}

function triggerRandomEvent() {
    if (Math.random() < 0.3) { 
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
    badge.innerHTML = `${event.icon} ${event.name}`;
    
    document.getElementById('eventsBanner').appendChild(badge);
    
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
    banner.innerHTML = '';
    
    gameState.activeEvents.forEach(evt => {
        const remaining = Math.max(0, Math.ceil((evt.endTime - Date.now()) / 1000));
        if (remaining > 0) {
            const badge = document.createElement('div');
            badge.className = 'event-badge positive';
            badge.textContent = `${evt.name} (${remaining}s)`;
            banner.appendChild(badge);
        }
    });
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    const container = document.getElementById('notificationContainer');
    container.appendChild(notification);
    
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
    
    document.getElementById('particleContainer').appendChild(particle);
    
    setTimeout(() => particle.remove(), 1500);
}

function gameLoop() {
    if (Date.now() - gameState.lastOrderTime > GAME_CONFIG.orderInterval) {
        createOrder();
        gameState.lastOrderTime = Date.now();
    }
    
    gameState.employees.forEach(emp => {
        if (emp.autoWork && !emp.isBusy) {
            const order = gameState.orders.find(o => !o.employeeId);
            if (order) {
                assignEmployeeToOrder(emp.id, order.id);
            }
        }
    });
    
    gameState.orders.forEach(order => {
        if (order.employeeId) {
            const emp = gameState.employees.find(e => e.id === order.employeeId);
            if (emp) {
                const speedWithPerks = emp.speed * (1 + (emp.perks?.speedBonus || 0));
                const speedMultiplier = gameState.speedMultiplier || 1;
                order.timeRemaining -= speedWithPerks * speedMultiplier;
                
                if (order.timeRemaining <= 0 && !order.completed) {
                    let reward = order.reward;
                    
                    if (emp.perks?.bonusReward) {
                        reward = Math.round(reward * (1 + emp.perks.bonusReward));
                    }
                    
                    const comboBonus = 1 + (gameState.combo * 0.05);
                    reward = Math.round(reward * comboBonus);
                    
                    gameState.money += reward;
                    gameState.totalOrdersCompleted++;
                    
                    if (order.rare) {
                        gameState.rareOrdersCompleted = (gameState.rareOrdersCompleted || 0) + 1;
                    }
                    
                    emp.isBusy = false;
                    emp.ordersCompleted++;
                    
                    if (emp.ordersCompleted % GAME_CONFIG.employeeSpeedIncrementEvery === 0 &&
                        emp.speed < GAME_CONFIG.employeeMaxSpeed) {
                        const expBoost = emp.perks?.expBoost || 0;
                        const speedGain = 1 * (1 + expBoost);
                        emp.speed = Math.min(GAME_CONFIG.employeeMaxSpeed, emp.speed + speedGain);
                        showNotification(`${emp.name} повысил навык! Скорость: ${emp.speed.toFixed(1)}`, 'success');
                    }
                    
                    incrementCombo();
                    order.completed = true;
                    
                    createParticle('💰', 600, 300);
                    if (order.rare) {
                        createParticle('⭐', 620, 280);
                        showNotification(`Редкий заказ выполнен! +${reward} 💰`, 'success');
                    }
                    
                    checkAchievements();
                }
            }
        }
    });
    
    gameState.orders = gameState.orders.filter(o => !o.completed);
    
    updateUI();
    renderOrders();
    renderEmployees();
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
    if (gameState.gameLoopIntervalId) clearInterval(gameState.gameLoopIntervalId);
    gameState.gameLoopIntervalId = setInterval(gameLoop, 100);
    
    if (gameState.saveIntervalId) clearInterval(gameState.saveIntervalId);
    gameState.saveIntervalId = setInterval(saveGame, 5000);
    
    if (gameState.eventIntervalId) clearInterval(gameState.eventIntervalId);
    gameState.eventIntervalId = setInterval(triggerRandomEvent, 60000);

    if (gameState.eventBadgeIntervalId) clearInterval(gameState.eventBadgeIntervalId);
    gameState.eventBadgeIntervalId = setInterval(renderEventBadges, 1000);
}

function init() {
    loadGame();
    setupShopTabs();
    
    document.getElementById('employeeList').addEventListener('click', e => {
        if (e.target.classList.contains('fire-employee-btn')) {
            e.stopPropagation();
            const empId = e.target.dataset.empid;
            fireEmployee(empId);
        }
    });

    renderEmployees();
    renderOrders();
    renderShop();
    updateUI();
    
    if (gameState.employees.length === 0) {
        const avatar = GAME_CONFIG.EMPLOYEE_AVATARS[0];
        gameState.employees.push({
            id: 'emp-starter',
            avatar,
            name: 'Стажер',
            speed: 1,
            isBusy: false,
            ordersCompleted: 0,
            autoWork: false,
            perks: {}
        });
        renderEmployees();
    }
    
    initIntervals();
    
    showNotification('Игра загружена! Добро пожаловать! 🔧', 'success');
}

window.addEventListener('load', init);

window.addEventListener('beforeunload', saveGame);
