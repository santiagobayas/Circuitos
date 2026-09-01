const boardContainer = document.getElementById('board-container');
const boardWorld = document.getElementById('board-world');
const board = document.getElementById('board');
const wiresLayer = document.getElementById('wires-layer');
const clearBtn = document.getElementById('clear-btn');
const learnBtn = document.getElementById('learn-btn');
const exportBtn = document.getElementById('export-btn');
const undoBtn = document.getElementById('undo-btn');
const redoBtn = document.getElementById('redo-btn');
const resetViewBtn = document.getElementById('reset-view-btn');
const mobileToolboxBtn = document.getElementById('mobile-toolbox-btn');
const closeToolboxBtn = document.getElementById('close-toolbox-btn');
const toolbox = document.getElementById('toolbox');
const examplesSelect = document.getElementById('examples-select');
const learnModal = document.getElementById('learn-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const toolboxItems = document.querySelectorAll('.toolbox-item');

// Environment buttons & canvas
const envLightBtn = document.getElementById('env-light-btn');
const envRainBtn = document.getElementById('env-rain-btn');
const envTempBtn = document.getElementById('env-temp-btn');
const rainCanvas = document.getElementById('rain-layer');

let components = [];
let wires = [];
let idCounter = 1;

// Global Environment State
const envState = {
    isNight: false,
    isRaining: false,
    isHot: false
};

// Pan state
let panX = 0;
let panY = 0;
let isPanning = false;
let panStartX = 0;
let panStartY = 0;

// Wire drawing & Tap-to-connect state
let isDrawingWire = false;
let currentWire = null;
let startTerminal = null;
let selectedTerminal = null; // Para conectar tocando 2 terminales consecutivas

// Dragging component state
let draggedComp = null;
let dragOffsetX = 0;
let dragOffsetY = 0;
let dragHasMoved = false;

// History state for Undo / Redo
let historyStack = [];
let historyIndex = -1;
const MAX_HISTORY = 40;
let isRestoringHistory = false;

// --- Mobile Toolbox Drawer ---
if (mobileToolboxBtn && toolbox) {
    mobileToolboxBtn.addEventListener('click', () => {
        toolbox.classList.add('open');
        playUISound('connect');
    });
}

if (closeToolboxBtn && toolbox) {
    closeToolboxBtn.addEventListener('click', () => {
        toolbox.classList.remove('open');
        playUISound('delete');
    });
}

function closeMobileToolbox() {
    if (toolbox && toolbox.classList.contains('open')) {
        toolbox.classList.remove('open');
    }
}

// --- Environment Controls ---
function updateEnvironmentUI() {
    // 1. Light (Día / Noche)
    if (envLightBtn) {
        if (envState.isNight) {
            envLightBtn.className = 'env-toggle-btn active-night';
            envLightBtn.innerHTML = '<i class="fa-solid fa-moon"></i> <span>Noche</span>';
            boardContainer.classList.add('night-mode');
        } else {
            envLightBtn.className = 'env-toggle-btn';
            envLightBtn.innerHTML = '<i class="fa-solid fa-sun"></i> <span>Día</span>';
            boardContainer.classList.remove('night-mode');
        }
    }

    // 2. Rain (Lluvia)
    if (envRainBtn) {
        if (envState.isRaining) {
            envRainBtn.className = 'env-toggle-btn active-rain';
            envRainBtn.innerHTML = '<i class="fa-solid fa-cloud-showers-heavy"></i> <span>Lloviendo</span>';
            startRainAnimation();
        } else {
            envRainBtn.className = 'env-toggle-btn';
            envRainBtn.innerHTML = '<i class="fa-solid fa-cloud-sun"></i> <span>Seco</span>';
            stopRainAnimation();
        }
    }

    // 3. Temperature (Frío / Calor)
    if (envTempBtn) {
        if (envState.isHot) {
            envTempBtn.className = 'env-toggle-btn active-hot';
            envTempBtn.innerHTML = '<i class="fa-solid fa-temperature-high"></i> <span>40°C</span>';
        } else {
            envTempBtn.className = 'env-toggle-btn';
            envTempBtn.innerHTML = '<i class="fa-solid fa-temperature-half"></i> <span>18°C</span>';
        }
    }

    // Actualizar estados automáticos de componentes ambientales según el entorno global
    components.forEach(c => {
        if (c.type === 'solar' && c.setSunny) {
            c.setSunny(!envState.isNight && !envState.isRaining);
        }
        if (c.type === 'ldr' && c.setDark) {
            c.setDark(envState.isNight);
        }
        if (c.type === 'rain' && c.setWet) {
            c.setWet(envState.isRaining);
        }
        if (c.type === 'thermostat' && c.setHot) {
            c.setHot(envState.isHot);
        }
    });

    updateCircuit();
}

if (envLightBtn) {
    envLightBtn.addEventListener('click', () => {
        envState.isNight = !envState.isNight;
        updateEnvironmentUI();
        playUISound('connect');
        pushHistoryState();
    });
}

if (envRainBtn) {
    envRainBtn.addEventListener('click', () => {
        envState.isRaining = !envState.isRaining;
        updateEnvironmentUI();
        playUISound('connect');
        pushHistoryState();
    });
}

if (envTempBtn) {
    envTempBtn.addEventListener('click', () => {
        envState.isHot = !envState.isHot;
        updateEnvironmentUI();
        playUISound('connect');
        pushHistoryState();
    });
}

// --- Rain Particle System on Canvas ---
let rainAnimationId = null;
let rainDrops = [];

function initRainParticles() {
    if (!rainCanvas) return;
    const rect = boardContainer.getBoundingClientRect();
    rainCanvas.width = rect.width;
    rainCanvas.height = rect.height;

    rainDrops = [];
    const dropCount = Math.floor(rect.width / 15);
    for (let i = 0; i < dropCount; i++) {
        rainDrops.push({
            x: Math.random() * rect.width,
            y: Math.random() * rect.height,
            length: 12 + Math.random() * 10,
            speed: 14 + Math.random() * 8,
            opacity: 0.3 + Math.random() * 0.4
        });
    }
}

function startRainAnimation() {
    if (!rainCanvas || rainAnimationId) return;
    initRainParticles();
    const ctx = rainCanvas.getContext('2d');

    function renderRain() {
        ctx.clearRect(0, 0, rainCanvas.width, rainCanvas.height);
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';

        rainDrops.forEach(d => {
            ctx.strokeStyle = `rgba(56, 189, 248, ${d.opacity})`;
            ctx.beginPath();
            ctx.moveTo(d.x, d.y);
            ctx.lineTo(d.x - 3, d.y + d.length);
            ctx.stroke();

            d.y += d.speed;
            d.x -= 1.5;

            if (d.y > rainCanvas.height) {
                d.y = -d.length;
                d.x = Math.random() * (rainCanvas.width + 50);
            }
        });

        rainAnimationId = requestAnimationFrame(renderRain);
    }
    renderRain();
}

function stopRainAnimation() {
    if (rainAnimationId) {
        cancelAnimationFrame(rainAnimationId);
        rainAnimationId = null;
    }
    if (rainCanvas) {
        const ctx = rainCanvas.getContext('2d');
        ctx.clearRect(0, 0, rainCanvas.width, rainCanvas.height);
    }
}

window.addEventListener('resize', () => {
    if (envState.isRaining && rainCanvas) {
        initRainParticles();
    }
});

// --- Pan & Canvas Navigation ---
function updateWorldTransform() {
    if (boardWorld) {
        boardWorld.style.transform = `translate(${panX}px, ${panY}px)`;
    }
    if (boardContainer) {
        boardContainer.style.backgroundPosition = `${panX}px ${panY}px`;
    }
}

function resetView() {
    panX = 0;
    panY = 0;
    updateWorldTransform();
    playUISound('connect');
}

if (resetViewBtn) resetViewBtn.addEventListener('click', resetView);

// Board mouse & touch pan initiation
function handlePanStart(clientX, clientY, target) {
    if (target.closest('.board-component') || 
        target.classList.contains('terminal') || 
        target.classList.contains('wire') ||
        target.closest('.view-controls') ||
        target.closest('.environment-bar') ||
        target.closest('.delete-btn') ||
        target.closest('.rotate-btn')) {
        return;
    }

    if (selectedTerminal) {
        selectedTerminal.classList.remove('selected-terminal');
        selectedTerminal = null;
    }

    isPanning = true;
    panStartX = clientX - panX;
    panStartY = clientY - panY;
    boardContainer.classList.add('is-panning');
}

boardContainer.addEventListener('mousedown', (e) => {
    handlePanStart(e.clientX, e.clientY, e.target);
});

boardContainer.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
        const touch = e.touches[0];
        handlePanStart(touch.clientX, touch.clientY, e.target);
    }
}, { passive: true });

// --- History System (Undo / Redo) ---
function serializeCircuit() {
    return JSON.stringify({
        env: {
            isNight: envState.isNight,
            isRaining: envState.isRaining,
            isHot: envState.isHot
        },
        components: components.map(c => ({
            id: c.id,
            type: c.type,
            x: c.x,
            y: c.y,
            rotation: c.rotation || 0,
            isClosed: c.isClosed !== undefined ? c.isClosed : undefined,
            value: c.value !== undefined ? c.value : undefined,
            color: c.color !== undefined ? c.color : undefined,
            digit: c.digit !== undefined ? c.digit : undefined,
            isSunny: c.isSunny !== undefined ? c.isSunny : undefined,
            isDark: c.isDark !== undefined ? c.isDark : undefined,
            isHot: c.isHot !== undefined ? c.isHot : undefined,
            isWet: c.isWet !== undefined ? c.isWet : undefined
        })),
        wires: wires.map(w => ({
            c1: w.c1,
            t1: w.t1,
            c2: w.c2,
            t2: w.t2
        })),
        idCounter: idCounter
    });
}

function pushHistoryState() {
    if (isRestoringHistory) return;
    const currentState = serializeCircuit();
    
    if (historyIndex >= 0 && historyStack[historyIndex] === currentState) {
        return;
    }

    if (historyIndex < historyStack.length - 1) {
        historyStack = historyStack.slice(0, historyIndex + 1);
    }

    historyStack.push(currentState);
    if (historyStack.length > MAX_HISTORY) {
        historyStack.shift();
    } else {
        historyIndex++;
    }

    updateHistoryButtons();
    saveCircuit();
}

function restoreCircuitState(jsonStr) {
    if (!jsonStr) return;
    try {
        isRestoringHistory = true;
        const data = JSON.parse(jsonStr);

        if (data.env) {
            envState.isNight = !!data.env.isNight;
            envState.isRaining = !!data.env.isRaining;
            envState.isHot = !!data.env.isHot;
            updateEnvironmentUI();
        }

        components.forEach(c => c.destroy());
        components = [];
        wires.forEach(w => w.element.remove());
        wires = [];

        idCounter = data.idCounter || 1;

        data.components.forEach(c => {
            const comp = createComponent(c.type, c.x, c.y, c.id, false);
            if (comp) {
                if (c.rotation) {
                    comp.rotation = c.rotation;
                    comp.applyRotation();
                }
                if (c.type === 'switch' && c.isClosed) comp.toggle();
                if (c.type === 'potentiometer' && c.value !== undefined) comp.setValue(c.value);
                if (c.type === 'rgbled' && c.color) comp.color = c.color;
                if (c.type === 'display7seg' && c.digit !== undefined) comp.digit = c.digit;
                if (c.type === 'solar' && c.isSunny !== undefined) comp.setSunny(c.isSunny);
                if (c.type === 'ldr' && c.isDark !== undefined) comp.setDark(c.isDark);
                if (c.type === 'thermostat' && c.isHot !== undefined) comp.setHot(c.isHot);
                if (c.type === 'rain' && c.isWet !== undefined) comp.setWet(c.isWet);
            }
        });

        data.wires.forEach(w => {
            createWire(w.c1, w.t1, w.c2, w.t2, null, false);
        });

        updateWiresPosition();
        updateCircuit();
    } catch(e) {
        console.error("Error restaurando estado del circuito", e);
    } finally {
        isRestoringHistory = false;
        updateHistoryButtons();
        saveCircuit();
    }
}

function undo() {
    if (historyIndex > 0) {
        historyIndex--;
        restoreCircuitState(historyStack[historyIndex]);
        playUISound('delete');
    }
}

function redo() {
    if (historyIndex < historyStack.length - 1) {
        historyIndex++;
        restoreCircuitState(historyStack[historyIndex]);
        playUISound('connect');
    }
}

function updateHistoryButtons() {
    if (undoBtn) undoBtn.disabled = (historyIndex <= 0);
    if (redoBtn) redoBtn.disabled = (historyIndex >= historyStack.length - 1);
}

if (undoBtn) undoBtn.addEventListener('click', undo);
if (redoBtn) redoBtn.addEventListener('click', redo);

// Rotation callback from component button
window.onComponentRotated = function(comp) {
    updateWiresPosition();
    updateCircuit();
    pushHistoryState();
    playUISound('connect');
};

// Keyboard shortcuts for Undo (Ctrl+Z) and Redo (Ctrl+Y / Ctrl+Shift+Z)
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        undo();
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y' || (e.shiftKey && (e.key === 'z' || e.key === 'Z')))) {
        e.preventDefault();
        redo();
    }
});

// --- Toolbox: Drag & Drop and Mobile Touch-to-Add ---
let touchDragGhost = null;
let touchDragType = null;

toolboxItems.forEach(item => {
    // Desktop Drag
    item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('type', item.dataset.type);
    });

    // Mobile & Desktop Click / Tap: Directly places component in center of viewport
    item.addEventListener('click', () => {
        const type = item.dataset.type;
        if (!type) return;

        const boardRect = boardContainer.getBoundingClientRect();
        const centerX = (-panX) + (boardRect.width / 2) - 50;
        const centerY = (-panY) + (boardRect.height / 2) - 50;

        // Desplazamiento leve para no encimar exactamente si colocan varios
        const jitterX = (Math.random() * 40 - 20);
        const jitterY = (Math.random() * 40 - 20);

        createComponent(type, Math.max(20, Math.round(centerX + jitterX)), Math.max(20, Math.round(centerY + jitterY)));
        playUISound('drop');
        pushHistoryState();
        closeMobileToolbox();
    });

    // Touch Dragging with floating Ghost
    item.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            touchDragType = item.dataset.type;

            touchDragGhost = item.cloneNode(true);
            touchDragGhost.className = 'toolbox-item touch-drag-ghost';
            touchDragGhost.style.left = `${touch.clientX}px`;
            touchDragGhost.style.top = `${touch.clientY}px`;
            document.body.appendChild(touchDragGhost);
        }
    }, { passive: true });
});

document.addEventListener('touchmove', (e) => {
    if (touchDragGhost && e.touches.length === 1) {
        const touch = e.touches[0];
        touchDragGhost.style.left = `${touch.clientX}px`;
        touchDragGhost.style.top = `${touch.clientY}px`;
    }
}, { passive: true });

document.addEventListener('touchend', (e) => {
    if (touchDragGhost && touchDragType) {
        const touch = e.changedTouches[0];
        const boardRect = boardContainer.getBoundingClientRect();

        if (touch.clientX >= boardRect.left && touch.clientX <= boardRect.right &&
            touch.clientY >= boardRect.top && touch.clientY <= boardRect.bottom) {
            
            const x = touch.clientX - boardRect.left - panX - 50;
            const y = touch.clientY - boardRect.top - panY - 50;

            createComponent(touchDragType, Math.max(0, Math.round(x)), Math.max(0, Math.round(y)));
            playUISound('drop');
            pushHistoryState();
            closeMobileToolbox();
        }

        touchDragGhost.remove();
        touchDragGhost = null;
        touchDragType = null;
    }
});

boardContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
});

boardContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('type');
    if (!type) return;

    const boardRect = boardContainer.getBoundingClientRect();
    const x = e.clientX - boardRect.left - panX - 50;
    const y = e.clientY - boardRect.top - panY - 50;

    createComponent(type, Math.max(0, Math.round(x)), Math.max(0, Math.round(y)));
    playUISound('drop');
    pushHistoryState();
});

// --- UI Sounds ---
let uiAudioCtx = null;

function playUISound(type) {
    try {
        if (!uiAudioCtx) {
            uiAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (uiAudioCtx.state === 'suspended') {
            uiAudioCtx.resume();
        }

        const osc = uiAudioCtx.createOscillator();
        const gainNode = uiAudioCtx.createGain();
        
        osc.connect(gainNode);
        gainNode.connect(uiAudioCtx.destination);

        const now = uiAudioCtx.currentTime;
        
        if (type === 'connect') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
            
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(0.3, now + 0.05);
            gainNode.gain.linearRampToValueAtTime(0, now + 0.1);
            
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'delete') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.exponentialRampToValueAtTime(150, now + 0.15);
            
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(0.3, now + 0.05);
            gainNode.gain.linearRampToValueAtTime(0, now + 0.15);
            
            osc.start(now);
            osc.stop(now + 0.15);
        } else if (type === 'drop') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
            
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(0.1, now + 0.05);
            gainNode.gain.linearRampToValueAtTime(0, now + 0.1);
            
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'camera') {
            osc.type = 'square';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(300, now + 0.08);
            
            gainNode.gain.setValueAtTime(0.15, now);
            gainNode.gain.linearRampToValueAtTime(0, now + 0.08);
            
            osc.start(now);
            osc.stop(now + 0.08);
        }
    } catch(e) {
        console.error("UI sound error", e);
    }
}
window.playUISound = playUISound;

// --- Component Management ---
function createComponent(type, x, y, forceId = null, shouldPushHistory = true) {
    const id = forceId || `comp_${idCounter++}`;
    let comp;
    switch(type) {
        case 'battery': comp = new Battery(id, x, y); break;
        case 'solar': comp = new SolarPanel(id, x, y, !envState.isNight && !envState.isRaining); break;
        case 'led': comp = new LED(id, x, y); break;
        case 'rgbled': comp = new RGBLED(id, x, y); break;
        case 'display7seg': comp = new SevenSegmentDisplay(id, x, y); break;
        case 'motor': comp = new Motor(id, x, y); break;
        case 'fan': comp = new Fan(id, x, y); break;
        case 'buzzer': comp = new Buzzer(id, x, y); break;
        case 'potentiometer': comp = new Potentiometer(id, x, y); break;
        case 'switch': comp = new Switch(id, x, y); break;
        case 'button': comp = new Button(id, x, y); break;
        case 'ldr': comp = new Photoresistor(id, x, y, envState.isNight); break;
        case 'rain': comp = new RainSensor(id, x, y, envState.isRaining); break;
        case 'proximity': comp = new ProximitySensor(id, x, y); break;
        case 'thermostat': comp = new TemperatureSensor(id, x, y, envState.isHot); break;
        case 'gear': comp = new Gear(id, x, y); break;
    }

    if (comp) {
        const el = comp.createDOM();
        board.appendChild(el);
        components.push(comp);
        
        setupComponentEvents(comp);
        updateCircuit();
        if (shouldPushHistory) pushHistoryState();
        return comp;
    }
}

window.removeComponent = function(id) {
    playUISound('delete');
    const wiresToRemove = wires.filter(w => w.c1 === id || w.c2 === id);
    wiresToRemove.forEach(w => {
        w.element.remove();
    });
    wires = wires.filter(w => w.c1 !== id && w.c2 !== id);

    const compIndex = components.findIndex(c => c.id === id);
    if (compIndex !== -1) {
        components[compIndex].destroy();
        components.splice(compIndex, 1);
    }

    updateCircuit();
    pushHistoryState();
};

function setupComponentEvents(comp) {
    const el = comp.element;
    
    // Switch toggle interaction (Mouse & Touch)
    if (comp.type === 'switch') {
        const toggleSwitch = (e) => {
            comp.toggle();
            updateCircuit();
            pushHistoryState();
            e.stopPropagation();
            if (e.cancelable) e.preventDefault();
        };
        const visual = el.querySelector('.switch-visual');
        if (visual) {
            visual.addEventListener('mousedown', toggleSwitch);
            visual.addEventListener('touchstart', toggleSwitch, { passive: false });
        }
    }

    // Button push interaction (Mouse & Touch)
    if (comp.type === 'button') {
        const icon = el.querySelector('.button-visual');
        if (icon) {
            const press = (e) => { 
                comp.setPressed(true); 
                updateCircuit(); 
                e.stopPropagation(); 
                if (e.cancelable) e.preventDefault();
            };
            const release = (e) => { 
                comp.setPressed(false); 
                updateCircuit(); 
                e.stopPropagation(); 
            };
            
            icon.addEventListener('mousedown', press);
            document.addEventListener('mouseup', release);
            icon.addEventListener('touchstart', press, { passive: false });
            document.addEventListener('touchend', release);
        }
    }

    // RGB LED color cycle interaction
    if (comp.type === 'rgbled') {
        const cycleRGB = (e) => {
            if (e.target.classList.contains('terminal') || 
                e.target.closest('.delete-btn') || 
                e.target.closest('.rotate-btn')) return;
            comp.cycleColor();
            updateCircuit();
            pushHistoryState();
            playUISound('connect');
            e.stopPropagation();
            if (e.cancelable) e.preventDefault();
        };
        el.addEventListener('mousedown', cycleRGB);
        el.addEventListener('touchstart', cycleRGB, { passive: false });
    }

    // Seven Segment Display click/tap to increment
    if (comp.type === 'display7seg') {
        const next7Seg = (e) => {
            if (e.target.classList.contains('terminal') || 
                e.target.closest('.delete-btn') || 
                e.target.closest('.rotate-btn')) return;
            comp.nextDigit();
            pushHistoryState();
            playUISound('connect');
            e.stopPropagation();
            if (e.cancelable) e.preventDefault();
        };
        el.addEventListener('mousedown', next7Seg);
        el.addEventListener('touchstart', next7Seg, { passive: false });
    }

    // Proximity Radar Sensor hover / touch interaction
    if (comp.type === 'proximity') {
        const proxContainer = el.querySelector('.prox-container');
        if (proxContainer) {
            proxContainer.addEventListener('mouseenter', () => {
                comp.setDetected(true);
                updateCircuit();
            });
            proxContainer.addEventListener('mouseleave', () => {
                comp.setDetected(false);
                updateCircuit();
            });
        }
    }

    // Potentiometer interaction (rotary knob & mouse wheel & touch drag)
    if (comp.type === 'potentiometer') {
        const knobContainer = el.querySelector('.knob-container');
        if (knobContainer) {
            let isAdjusting = false;
            let startY = 0;
            let startVal = 0.8;

            const onKnobStart = (clientY, e) => {
                isAdjusting = true;
                startY = clientY;
                startVal = comp.value;
                e.stopPropagation();
                if (e.cancelable) e.preventDefault();
            };

            const onKnobMove = (clientY) => {
                if (!isAdjusting) return;
                const deltaY = startY - clientY;
                const deltaVal = deltaY / 120;
                const newVal = Math.max(0.05, Math.min(1.0, startVal + deltaVal));
                comp.setValue(newVal);
                updateCircuit();
            };

            const onKnobEnd = () => {
                if (isAdjusting) {
                    isAdjusting = false;
                    pushHistoryState();
                }
            };

            knobContainer.addEventListener('mousedown', (e) => onKnobStart(e.clientY, e));
            document.addEventListener('mousemove', (e) => onKnobMove(e.clientY));
            document.addEventListener('mouseup', onKnobEnd);

            knobContainer.addEventListener('touchstart', (e) => {
                if (e.touches.length === 1) onKnobStart(e.touches[0].clientY, e);
            }, { passive: false });
            document.addEventListener('touchmove', (e) => {
                if (isAdjusting && e.touches.length === 1) onKnobMove(e.touches[0].clientY);
            }, { passive: true });
            document.addEventListener('touchend', onKnobEnd);

            knobContainer.addEventListener('wheel', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const step = e.deltaY < 0 ? 0.05 : -0.05;
                comp.setValue(comp.value + step);
                updateCircuit();
                pushHistoryState();
            }, { passive: false });
        }
    }

    // Component Dragging Start Helper
    const startDraggingComp = (clientX, clientY, target, e) => {
        if (target.classList.contains('terminal') || 
            target.closest('.delete-btn') || 
            target.closest('.rotate-btn') ||
            target.classList.contains('switch-visual') || 
            target.classList.contains('button-visual') || 
            target.closest('.knob-container')) return;

        draggedComp = comp;
        dragHasMoved = false;
        const rect = el.getBoundingClientRect();
        dragOffsetX = clientX - rect.left;
        dragOffsetY = clientY - rect.top;
        
        el.style.zIndex = 100;
        e.stopPropagation();
    };

    el.addEventListener('mousedown', (e) => {
        startDraggingComp(e.clientX, e.clientY, e.target, e);
    });

    el.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            startDraggingComp(e.touches[0].clientX, e.touches[0].clientY, e.target, e);
        }
    }, { passive: true });

    // Right click on desktop to rotate
    el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        comp.rotate();
        updateWiresPosition();
        updateCircuit();
        pushHistoryState();
        e.stopPropagation();
    });
}

// Global move handler for panning, dragging, and wire drawing (Mouse & Touch)
function handleGlobalMove(clientX, clientY) {
    const boardRect = boardContainer.getBoundingClientRect();

    if (isPanning) {
        panX = clientX - panStartX;
        panY = clientY - panStartY;
        updateWorldTransform();
        return;
    }

    const mouseWorldX = clientX - boardRect.left - panX;
    const mouseWorldY = clientY - boardRect.top - panY;
    
    let proximityChanged = false;
    components.forEach(c => {
        if (c.type === 'proximity') {
            const centerX = c.x + 50;
            const centerY = c.y + 50;
            const dist = Math.sqrt(Math.pow(mouseWorldX - centerX, 2) + Math.pow(mouseWorldY - centerY, 2));
            const isNear = dist <= 120 && clientX >= boardRect.left && clientX <= boardRect.right && clientY >= boardRect.top && clientY <= boardRect.bottom;
            if (c.isDetected !== isNear) {
                c.setDetected(isNear);
                proximityChanged = true;
            }
        }
    });
    if (proximityChanged) {
        updateCircuit();
    }

    if (draggedComp) {
        let x = clientX - boardRect.left - panX - dragOffsetX;
        let y = clientY - boardRect.top - panY - dragOffsetY;
        
        x = Math.max(0, Math.min(x, 5900));
        y = Math.max(0, Math.min(y, 5900));

        const SNAP = 20;
        x = Math.round(x / SNAP) * SNAP;
        y = Math.round(y / SNAP) * SNAP;

        if (draggedComp.x !== x || draggedComp.y !== y) {
            dragHasMoved = true;
            draggedComp.x = x;
            draggedComp.y = y;
            draggedComp.element.style.left = `${x}px`;
            draggedComp.element.style.top = `${y}px`;
            updateWiresPosition();
        }
    }

    if (isDrawingWire && currentWire && startTerminal) {
        const endX = clientX - boardRect.left - panX;
        const endY = clientY - boardRect.top - panY;
        const startPos = getTerminalPos(startTerminal.dataset.compId, startTerminal.dataset.termId);
        
        updateWirePath(currentWire, startPos.x, startPos.y, endX, endY);
    }
}

function handleGlobalEnd() {
    if (isPanning) {
        isPanning = false;
        boardContainer.classList.remove('is-panning');
    }

    if (draggedComp) {
        draggedComp.element.style.zIndex = 10;
        const wasMoved = dragHasMoved;
        draggedComp = null;
        dragHasMoved = false;
        updateCircuit();
        if (wasMoved) pushHistoryState();
    }

    if (isDrawingWire) {
        if (currentWire && wiresLayer.contains(currentWire)) {
            wiresLayer.removeChild(currentWire);
        }
        isDrawingWire = false;
        currentWire = null;
        startTerminal = null;
    }
}

document.addEventListener('mousemove', (e) => {
    handleGlobalMove(e.clientX, e.clientY);
});

document.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1) {
        handleGlobalMove(e.touches[0].clientX, e.touches[0].clientY);
    }
}, { passive: true });

document.addEventListener('mouseup', handleGlobalEnd);
document.addEventListener('touchend', handleGlobalEnd);

// --- Wiring System: Drag-to-wire & Tap-to-connect ---
function handleTerminalInteraction(terminalEl) {
    if (!selectedTerminal) {
        // First terminal selected
        selectedTerminal = terminalEl;
        selectedTerminal.classList.add('selected-terminal');
        playUISound('connect');
    } else {
        // Second terminal tapped
        if (selectedTerminal === terminalEl) {
            // Deselect
            selectedTerminal.classList.remove('selected-terminal');
            selectedTerminal = null;
            playUISound('delete');
        } else if (selectedTerminal.dataset.compId !== terminalEl.dataset.compId) {
            // Connect both terminals
            const c1 = selectedTerminal.dataset.compId;
            const t1 = selectedTerminal.dataset.termId;
            const c2 = terminalEl.dataset.compId;
            const t2 = terminalEl.dataset.termId;

            const exists = wires.some(w => 
                (w.c1 === c1 && w.t1 === t1 && w.c2 === c2 && w.t2 === t2) ||
                (w.c2 === c1 && w.t2 === t1 && w.c1 === c2 && w.t1 === t2)
            );

            if (!exists) {
                createWire(c1, t1, c2, t2, null, true);
                playUISound('connect');
            }

            selectedTerminal.classList.remove('selected-terminal');
            selectedTerminal = null;
        }
    }
}

board.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('terminal')) {
        startTerminal = e.target;
        isDrawingWire = true;
        
        currentWire = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        currentWire.classList.add('wire', 'drawing');
        wiresLayer.appendChild(currentWire);
        
        e.stopPropagation();
    }
});

board.addEventListener('mouseup', (e) => {
    if (isDrawingWire && e.target.classList.contains('terminal')) {
        const endTerminal = e.target;
        
        if (startTerminal !== endTerminal && 
            startTerminal.dataset.compId !== endTerminal.dataset.compId) {
            
            const exists = wires.some(w => 
                (w.c1 === startTerminal.dataset.compId && w.t1 === startTerminal.dataset.termId && w.c2 === endTerminal.dataset.compId && w.t2 === endTerminal.dataset.termId) ||
                (w.c2 === startTerminal.dataset.compId && w.t2 === startTerminal.dataset.termId && w.c1 === endTerminal.dataset.compId && w.t1 === endTerminal.dataset.termId)
            );

            if (!exists) {
                createWire(startTerminal.dataset.compId, startTerminal.dataset.termId, endTerminal.dataset.compId, endTerminal.dataset.termId, currentWire, true);
                playUISound('connect');
                
                isDrawingWire = false;
                currentWire = null;
                startTerminal = null;
                return;
            }
        }
    }
    
    // Tap to connect on click/tap
    if (e.target.classList.contains('terminal')) {
        handleTerminalInteraction(e.target);
    }
});

board.addEventListener('touchstart', (e) => {
    if (e.target.classList.contains('terminal') && e.touches.length === 1) {
        handleTerminalInteraction(e.target);
        e.stopPropagation();
    }
}, { passive: true });

function getTerminalPos(compId, termId) {
    const comp = components.find(c => c.id === compId);
    if (!comp) return {x: 0, y: 0};
    
    let tx = comp.x + 50;
    let ty = comp.y + 50;
    
    const term = comp.terminals.find(t => t.id === termId);
    if (term) {
        let dx = 0;
        let dy = 0;
        if (term.position === 'top') dy = -50;
        if (term.position === 'bottom') dy = 50;
        if (term.position === 'left') dx = -50;
        if (term.position === 'right') dx = 50;

        const rad = (comp.rotation || 0) * Math.PI / 180;
        const rotDx = dx * Math.cos(rad) - dy * Math.sin(rad);
        const rotDy = dx * Math.sin(rad) + dy * Math.cos(rad);

        tx += rotDx;
        ty += rotDy;
    }
    
    return { x: tx, y: ty };
}

function updateWiresPosition() {
    wires.forEach(w => {
        const p1 = getTerminalPos(w.c1, w.t1);
        const p2 = getTerminalPos(w.c2, w.t2);
        updateWirePath(w.element, p1.x, p1.y, p2.x, p2.y);
    });
}

function updateWirePath(pathEl, x1, y1, x2, y2) {
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const cpX1 = x1 + (x2 > x1 ? dx/2 : -dx/2);
    const cpY1 = y1 + (y2 > y1 ? dy/8 : -dy/8);
    
    const d = `M ${x1} ${y1} Q ${cpX1} ${y1} ${x2} ${y2}`;
    pathEl.setAttribute('d', d);
}

function createWire(c1, t1, c2, t2, existingPathEl = null, shouldPushHistory = true) {
    let pathEl = existingPathEl;
    if (!pathEl) {
        pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        pathEl.classList.add('wire');
        wiresLayer.appendChild(pathEl);
    }
    
    const wireObj = {
        id: `wire_${idCounter++}`,
        c1: c1,
        t1: t1,
        c2: c2,
        t2: t2,
        element: pathEl
    };
    
    pathEl.classList.remove('drawing');
    pathEl.style.pointerEvents = 'auto';
    pathEl.classList.add('clickable-wire');
    
    const deleteWireHandler = (e) => {
        playUISound('delete');
        wires = wires.filter(w => w.id !== wireObj.id);
        pathEl.remove();
        updateCircuit();
        pushHistoryState();
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
    };
    
    pathEl.addEventListener('click', deleteWireHandler);
    pathEl.addEventListener('touchstart', deleteWireHandler, { passive: false });
    
    wires.push(wireObj);
    updateWiresPosition();
    updateCircuit();
    if (shouldPushHistory) pushHistoryState();
}

// --- Circuit Logic ---
function updateCircuit() {
    const adj = {};
    const addEdge = (n1, n2, wireId) => {
        if(!adj[n1]) adj[n1] = [];
        if(!adj[n2]) adj[n2] = [];
        adj[n1].push({ to: n2, wireId });
        adj[n2].push({ to: n1, wireId });
    };

    wires.forEach(w => {
        addEdge(`${w.c1}_${w.t1}`, `${w.c2}_${w.t2}`, w.id);
    });

    components.forEach(c => {
        if (c.type === 'battery' || c.type === 'solar') return;
        
        if ((c.type === 'switch' || c.type === 'button') && !c.isClosed) return;
        if (c.type === 'ldr' && !c.isDark) return;
        if (c.type === 'rain' && !c.isWet) return;
        if (c.type === 'proximity' && !c.isDetected) return;
        if (c.type === 'thermostat' && !c.isHot) return;
        
        if (c.terminals && c.terminals.length >= 2) {
            addEdge(`${c.id}_${c.terminals[0].id}`, `${c.id}_${c.terminals[1].id}`, null);
        }
    });

    const powerSources = components.filter(c => 
        (c.type === 'battery') || 
        (c.type === 'solar' && c.isSunny)
    );

    let activeComponents = new Set();
    let activeWires = new Set();
    let componentIntensity = new Map();

    powerSources.forEach(source => {
        const startNode = `${source.id}_t1`;
        const targetNode = `${source.id}_t2`;

        // 1. Check for short circuit
        let queueSC = [startNode];
        let visitedSC = new Set([startNode]);
        let isShortCircuit = false;
        
        while(queueSC.length > 0) {
            let curr = queueSC.shift();
            if (curr === targetNode) {
                isShortCircuit = true;
                break;
            }
            if (adj[curr]) {
                for (let edge of adj[curr]) {
                    if (!visitedSC.has(edge.to)) {
                        let compId = edge.to.substring(0, edge.to.lastIndexOf('_'));
                        const compObj = components.find(c => c.id === compId);
                        if (compObj && ['led', 'rgbled', 'display7seg', 'motor', 'fan', 'buzzer', 'potentiometer'].includes(compObj.type)) {
                            continue;
                        }
                        visitedSC.add(edge.to);
                        queueSC.push(edge.to);
                    }
                }
            }
        }

        if (isShortCircuit) {
            source.element.classList.add('short-circuit-alert');
            return;
        } else {
            source.element.classList.remove('short-circuit-alert');
        }

        // 2. BFS to find path from t1 to t2
        let visited = new Set();
        let queue = [{ node: startNode, pathComps: [], pathWires: [] }];
        visited.add(startNode);
        
        let foundPath = false;
        let finalPathComps = [];
        let finalPathWires = [];

        while(queue.length > 0) {
            let curr = queue.shift();
            
            if (curr.node === targetNode) {
                foundPath = true;
                finalPathComps = curr.pathComps;
                finalPathWires = curr.pathWires;
                break;
            }

            if (adj[curr.node]) {
                for (let edge of adj[curr.node]) {
                    if (!visited.has(edge.to)) {
                        visited.add(edge.to);
                        
                        let nextComps = [...curr.pathComps];
                        let lastUnder = edge.to.lastIndexOf('_');
                        let compId = edge.to.substring(0, lastUnder);
                        
                        if(!nextComps.includes(compId)) nextComps.push(compId);
                        
                        let nextWires = [...curr.pathWires];
                        if (edge.wireId && !nextWires.includes(edge.wireId)) {
                            nextWires.push(edge.wireId);
                        }

                        queue.push({
                            node: edge.to,
                            pathComps: nextComps,
                            pathWires: nextWires
                        });
                    }
                }
            }
        }

        if (foundPath) {
            activeComponents.add(source.id);
            finalPathComps.forEach(id => activeComponents.add(id));
            finalPathWires.forEach(id => activeWires.add(id));

            let loopIntensity = 1.0;
            finalPathComps.forEach(id => {
                const comp = components.find(c => c.id === id);
                if (comp && comp.type === 'potentiometer' && comp.value !== undefined) {
                    loopIntensity *= comp.value;
                }
            });

            finalPathComps.forEach(id => {
                const currentInt = componentIntensity.get(id) || 1.0;
                componentIntensity.set(id, Math.min(currentInt, loopIntensity));
            });
        }
    });

    // 3. Apply states based on active status & intensity
    components.forEach(c => {
        const shouldBeActive = activeComponents.has(c.id);
        const intensity = componentIntensity.get(c.id) || 1.0;
        if (c.updateState && c.type !== 'gear') {
            c.updateState(shouldBeActive, intensity);
        }
    });
    
    // 3.5 Mechanical interactions (Gears and active Motors)
    const activeMotors = components.filter(c => c.type === 'motor' && activeComponents.has(c.id));
    const gears = components.filter(c => c.type === 'gear');
    
    gears.forEach(g => {
        let isNearActiveMotor = false;
        let maxMotorSpeed = 1.0;
        activeMotors.forEach(m => {
            const dx = m.x - g.x;
            const dy = m.y - g.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist <= 145) {
                isNearActiveMotor = true;
                if (m.currentSpeed) maxMotorSpeed = m.currentSpeed;
            }
        });
        if (g.updateState) g.updateState(isNearActiveMotor, maxMotorSpeed);
    });
    
    wires.forEach(w => {
        if (activeWires.has(w.id)) {
            w.element.classList.add('active');
        } else {
            w.element.classList.remove('active');
        }
    });

    saveCircuit();
}

// --- Clear Board ---
function clearBoard(shouldPush = true) {
    components.forEach(c => c.destroy());
    components = [];
    
    wires.forEach(w => w.element.remove());
    wires = [];
    
    idCounter = 1;
    updateCircuit();
    if (shouldPush) pushHistoryState();
}

clearBtn.addEventListener('click', () => {
    playUISound('delete');
    clearBoard(true);
});

// --- Modal de Aprendizaje ---
learnBtn.addEventListener('click', () => {
    learnModal.classList.remove('hidden');
    playUISound('connect');
});

closeModalBtn.addEventListener('click', () => {
    learnModal.classList.add('hidden');
    playUISound('delete');
});

learnModal.addEventListener('click', (e) => {
    if (e.target === learnModal) {
        learnModal.classList.add('hidden');
        playUISound('delete');
    }
});

// --- Examples ---
const examples = {
    simple: {
        comps: [
            { type: 'battery', x: 200, y: 300 },
            { type: 'led', x: 440, y: 300 }
        ],
        wires: [
            { c1: 1, t1: 't1', c2: 2, t2: 't1' },
            { c1: 1, t1: 't2', c2: 2, t2: 't2' }
        ]
    },
    solar: {
        comps: [
            { type: 'solar', x: 160, y: 300 },
            { type: 'motor', x: 380, y: 300 },
            { type: 'gear', x: 380, y: 160 },
            { type: 'fan', x: 580, y: 300 }
        ],
        wires: [
            { c1: 1, t1: 't1', c2: 2, t2: 't1' },
            { c1: 2, t1: 't2', c2: 4, t2: 't1' },
            { c1: 4, t1: 't2', c2: 1, t2: 't2' }
        ]
    },
    rain: {
        comps: [
            { type: 'battery', x: 140, y: 300 },
            { type: 'rain', x: 360, y: 200, isWet: true },
            { type: 'motor', x: 580, y: 300 }
        ],
        wires: [
            { c1: 1, t1: 't1', c2: 2, t2: 't1' },
            { c1: 2, t1: 't2', c2: 3, t2: 't1' },
            { c1: 3, t1: 't2', c2: 1, t2: 't2' }
        ],
        env: { isRaining: true }
    },
    nightlight: {
        comps: [
            { type: 'battery', x: 140, y: 300 },
            { type: 'ldr', x: 360, y: 200, isDark: true },
            { type: 'rgbled', x: 580, y: 300, color: '#38bdf8' }
        ],
        wires: [
            { c1: 1, t1: 't1', c2: 2, t2: 't1' },
            { c1: 2, t1: 't2', c2: 3, t2: 't1' },
            { c1: 3, t1: 't2', c2: 1, t2: 't2' }
        ],
        env: { isNight: true }
    },
    tempfan: {
        comps: [
            { type: 'battery', x: 140, y: 300 },
            { type: 'thermostat', x: 360, y: 200, isHot: true },
            { type: 'fan', x: 580, y: 300 }
        ],
        wires: [
            { c1: 1, t1: 't1', c2: 2, t2: 't1' },
            { c1: 2, t1: 't2', c2: 3, t2: 't1' },
            { c1: 3, t1: 't2', c2: 1, t2: 't2' }
        ],
        env: { isHot: true }
    },
    alarm: {
        comps: [
            { type: 'battery', x: 140, y: 300 },
            { type: 'proximity', x: 360, y: 200 },
            { type: 'buzzer', x: 580, y: 300 }
        ],
        wires: [
            { c1: 1, t1: 't1', c2: 2, t2: 't1' },
            { c1: 2, t1: 't2', c2: 3, t2: 't1' },
            { c1: 3, t1: 't2', c2: 1, t2: 't2' }
        ]
    },
    rgb: {
        comps: [
            { type: 'battery', x: 120, y: 300 },
            { type: 'potentiometer', x: 320, y: 180, value: 0.9 },
            { type: 'rgbled', x: 520, y: 300, color: '#ec4899' }
        ],
        wires: [
            { c1: 1, t1: 't1', c2: 2, t2: 't1' },
            { c1: 2, t1: 't2', c2: 3, t2: 't1' },
            { c1: 3, t1: 't2', c2: 1, t2: 't2' }
        ]
    },
    counter: {
        comps: [
            { type: 'battery', x: 120, y: 300 },
            { type: 'button', x: 320, y: 180 },
            { type: 'display7seg', x: 520, y: 300, digit: 0 }
        ],
        wires: [
            { c1: 1, t1: 't1', c2: 2, t2: 't1' },
            { c1: 2, t1: 't2', c2: 3, t2: 't1' },
            { c1: 3, t1: 't2', c2: 1, t2: 't2' }
        ]
    },
    switch: {
        comps: [
            { type: 'battery', x: 100, y: 300 },
            { type: 'switch', x: 300, y: 160 },
            { type: 'fan', x: 500, y: 300 }
        ],
        wires: [
            { c1: 1, t1: 't1', c2: 2, t2: 't1' },
            { c1: 2, t1: 't2', c2: 3, t2: 't1' },
            { c1: 3, t1: 't2', c2: 1, t2: 't2' }
        ]
    },
    dimmer: {
        comps: [
            { type: 'battery', x: 100, y: 300 },
            { type: 'potentiometer', x: 280, y: 160, value: 0.75 },
            { type: 'led', x: 480, y: 160 },
            { type: 'motor', x: 480, y: 360 }
        ],
        wires: [
            { c1: 1, t1: 't1', c2: 2, t2: 't1' },
            { c1: 2, t1: 't2', c2: 3, t2: 't1' },
            { c1: 3, t1: 't2', c2: 4, t2: 't1' },
            { c1: 4, t1: 't2', c2: 1, t2: 't2' }
        ]
    },
    series: {
        comps: [
            { type: 'battery', x: 100, y: 300 },
            { type: 'led', x: 300, y: 200 },
            { type: 'buzzer', x: 500, y: 400 }
        ],
        wires: [
            { c1: 1, t1: 't1', c2: 2, t2: 't1' },
            { c1: 2, t1: 't2', c2: 3, t2: 't1' },
            { c1: 3, t1: 't2', c2: 1, t2: 't2' }
        ]
    }
};

function loadExample(key) {
    clearBoard(false);
    resetView();
    const data = examples[key];
    if (!data) return;

    if (data.env) {
        envState.isNight = !!data.env.isNight;
        envState.isRaining = !!data.env.isRaining;
        envState.isHot = !!data.env.isHot;
        updateEnvironmentUI();
    }

    data.comps.forEach(c => {
        const comp = createComponent(c.type, c.x, c.y, null, false);
        if (comp) {
            if (c.value !== undefined && comp.setValue) comp.setValue(c.value);
            if (c.color && comp.color !== undefined) comp.color = c.color;
            if (c.digit !== undefined && comp.digit !== undefined) comp.digit = c.digit;
            if (c.isDark !== undefined && comp.setDark) comp.setDark(c.isDark);
            if (c.isHot !== undefined && comp.setHot) comp.setHot(c.isHot);
            if (c.isWet !== undefined && comp.setWet) comp.setWet(c.isWet);
            if (c.isSunny !== undefined && comp.setSunny) comp.setSunny(c.isSunny);
        }
    });

    data.wires.forEach(w => {
        const c1Str = `comp_${w.c1}`;
        const c2Str = `comp_${w.c2}`;
        createWire(c1Str, w.t1, c2Str, w.t2, null, false);
    });

    updateWiresPosition();
    updateCircuit();
    pushHistoryState();
}

// --- Export Circuit as PNG Image ---
function exportCircuitAsPNG() {
    playUISound('camera');

    if (components.length === 0) {
        alert("¡Coloca al menos un componente en la mesa para guardar una foto!");
        return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    components.forEach(c => {
        minX = Math.min(minX, c.x);
        minY = Math.min(minY, c.y);
        maxX = Math.max(maxX, c.x + 100);
        maxY = Math.max(maxY, c.y + 100);
    });

    const margin = 80;
    const cropX = Math.max(0, minX - margin);
    const cropY = Math.max(0, minY - margin);
    const width = Math.max(600, (maxX - minX) + margin * 2);
    const height = Math.max(450, (maxY - minY) + margin * 2);
    const scale = 2;

    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    // Fondo
    ctx.fillStyle = envState.isNight ? '#090d16' : '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    // Grid
    ctx.strokeStyle = envState.isNight ? 'rgba(99, 102, 241, 0.18)' : '#e2e8f0';
    ctx.lineWidth = 1.5;
    const gridOffsetX = cropX % 40;
    const gridOffsetY = cropY % 40;
    for (let x = -gridOffsetX; x < width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }
    for (let y = -gridOffsetY; y < height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }

    // Cables
    wires.forEach(w => {
        const p1Raw = getTerminalPos(w.c1, w.t1);
        const p2Raw = getTerminalPos(w.c2, w.t2);
        const p1 = { x: p1Raw.x - cropX, y: p1Raw.y - cropY };
        const p2 = { x: p2Raw.x - cropX, y: p2Raw.y - cropY };
        const isActive = w.element.classList.contains('active');

        const dx = Math.abs(p2.x - p1.x);
        const dy = Math.abs(p2.y - p1.y);
        const cpX1 = p1.x + (p2.x > p1.x ? dx/2 : -dx/2);
        const cpY1 = p1.y + (p2.y > p1.y ? dy/8 : -dy/8);

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.quadraticCurveTo(cpX1, p1.y, p2.x, p2.y);
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.strokeStyle = isActive ? '#22c55e' : '#3b82f6';
        if (isActive) {
            ctx.shadowColor = '#22c55e';
            ctx.shadowBlur = 10;
        }
        ctx.stroke();
        ctx.restore();
    });

    // Componentes
    components.forEach(c => {
        const cx = (c.x - cropX) + 50;
        const cy = (c.y - cropY) + 50;
        const rad = (c.rotation || 0) * Math.PI / 180;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rad);

        // Tarjeta
        ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
        ctx.shadowBlur = 15;
        ctx.shadowOffsetY = 6;
        ctx.fillStyle = envState.isNight ? '#0f172a' : '#ffffff';
        drawRoundedRect(ctx, -50, -50, 100, 100, 16);
        ctx.fill();

        ctx.shadowColor = 'transparent';
        ctx.strokeStyle = envState.isNight ? '#334155' : '#e2e8f0';
        ctx.lineWidth = 2;
        drawRoundedRect(ctx, -50, -50, 100, 100, 16);
        ctx.stroke();

        // Terminales
        c.terminals.forEach(term => {
            let tx = 0, ty = 0;
            if (term.position === 'left') tx = -50;
            if (term.position === 'right') tx = 50;
            if (term.position === 'top') ty = -50;
            if (term.position === 'bottom') ty = 50;

            ctx.beginPath();
            ctx.arc(tx, ty, 8, 0, Math.PI * 2);
            ctx.fillStyle = '#3b82f6';
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2.5;
            ctx.stroke();
        });

        drawComponentGraphic(ctx, c);

        ctx.restore();
    });

    // Marca de agua
    ctx.save();
    ctx.fillStyle = '#6366f1';
    ctx.font = '800 18px "Outfit", sans-serif';
    ctx.fillText('🤖 Mi Laboratorio de Robótica', 25, 35);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 13px "Outfit", sans-serif';
    ctx.fillText(new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }), 25, 55);
    ctx.restore();

    const link = document.createElement('a');
    link.download = `circuito_robotica_${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

function drawComponentGraphic(ctx, comp) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const isActive = comp.element && (
        comp.element.querySelector('.active') || 
        comp.element.classList.contains('active')
    );

    if (comp.type === 'battery') {
        ctx.fillStyle = '#10b981';
        ctx.font = '36px "Font Awesome 6 Free", "FontAwesome"';
        ctx.fillText('\uf240', 0, 0);
    } else if (comp.type === 'solar') {
        ctx.fillStyle = comp.isSunny ? '#fbbf24' : '#94a3b8';
        ctx.font = '34px "Font Awesome 6 Free", "FontAwesome"';
        ctx.fillText('\uf5ba', 0, -4);
        ctx.fillStyle = comp.isSunny ? '#f59e0b' : '#64748b';
        ctx.font = '800 10px "Outfit", sans-serif';
        ctx.fillText(comp.isSunny ? '☀️ Sol' : '☁️ Nublado', 0, 24);
    } else if (comp.type === 'led') {
        ctx.fillStyle = isActive ? '#f59e0b' : '#d1d5db';
        if (isActive) {
            ctx.shadowColor = '#f59e0b';
            ctx.shadowBlur = 18;
        }
        ctx.font = '36px "Font Awesome 6 Free", "FontAwesome"';
        ctx.fillText('\uf0eb', 0, 0);
    } else if (comp.type === 'rgbled') {
        const color = comp.color || '#ec4899';
        ctx.fillStyle = isActive ? color : '#d1d5db';
        if (isActive) {
            ctx.shadowColor = color;
            ctx.shadowBlur = 20;
        }
        ctx.font = '36px "Font Awesome 6 Free", "FontAwesome"';
        ctx.fillText('\uf0eb', 0, 0);
    } else if (comp.type === 'display7seg') {
        ctx.fillStyle = '#020617';
        drawRoundedRect(ctx, -26, -32, 52, 64, 8);
        ctx.fill();
        ctx.fillStyle = '#ef4444';
        ctx.font = '800 38px monospace';
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 10;
        ctx.fillText(`${comp.digit !== undefined ? comp.digit : 0}`, 0, 0);
    } else if (comp.type === 'motor') {
        ctx.fillStyle = '#6366f1';
        ctx.font = '38px "Font Awesome 6 Free", "FontAwesome"';
        ctx.fillText('\uf013', 0, 0);
    } else if (comp.type === 'fan') {
        ctx.fillStyle = '#06b6d4';
        ctx.font = '38px "Font Awesome 6 Free", "FontAwesome"';
        ctx.fillText('\uf863', 0, 0);
    } else if (comp.type === 'buzzer') {
        ctx.fillStyle = '#ec4899';
        ctx.font = '36px "Font Awesome 6 Free", "FontAwesome"';
        ctx.fillText('\uf028', 0, 0);
    } else if (comp.type === 'switch') {
        ctx.fillStyle = comp.isClosed ? '#10b981' : '#8b5cf6';
        ctx.font = '34px "Font Awesome 6 Free", "FontAwesome"';
        ctx.fillText(comp.isClosed ? '\uf205' : '\uf204', 0, 0);
    } else if (comp.type === 'button') {
        ctx.fillStyle = comp.isClosed ? '#10b981' : '#ef4444';
        ctx.font = '34px "Font Awesome 6 Free", "FontAwesome"';
        ctx.fillText(comp.isClosed ? '\uf058' : '\uf192', 0, 0);
    } else if (comp.type === 'ldr') {
        ctx.fillStyle = comp.isDark ? '#6366f1' : '#f59e0b';
        ctx.font = '32px "Font Awesome 6 Free", "FontAwesome"';
        ctx.fillText(comp.isDark ? '\uf186' : '\uf6c4', 0, -4);
        ctx.fillStyle = comp.isDark ? '#4338ca' : '#b45309';
        ctx.font = '800 10px "Outfit", sans-serif';
        ctx.fillText(comp.isDark ? '🌙 Noche' : '☀️ Día', 0, 24);
    } else if (comp.type === 'rain') {
        ctx.fillStyle = comp.isWet ? '#38bdf8' : '#0284c7';
        ctx.font = '32px "Font Awesome 6 Free", "FontAwesome"';
        ctx.fillText('\uf73d', 0, -4);
        ctx.fillStyle = comp.isWet ? '#0284c7' : '#64748b';
        ctx.font = '800 10px "Outfit", sans-serif';
        ctx.fillText(comp.isWet ? '💧 Mojado' : '☀️ Seco', 0, 24);
    } else if (comp.type === 'proximity') {
        ctx.fillStyle = comp.isDetected ? '#ef4444' : '#0d9488';
        ctx.font = '30px "Font Awesome 6 Free", "FontAwesome"';
        ctx.fillText('\uf7c0', 0, -4);
        ctx.fillStyle = comp.isDetected ? '#dc2626' : '#0f766e';
        ctx.font = '800 10px "Outfit", sans-serif';
        ctx.fillText(comp.isDetected ? '¡ALERTA!' : 'Vigilando', 0, 24);
    } else if (comp.type === 'thermostat') {
        ctx.fillStyle = comp.isHot ? '#ef4444' : '#0284c7';
        ctx.font = '32px "Font Awesome 6 Free", "FontAwesome"';
        ctx.fillText(comp.isHot ? '\uf769' : '\uf76b', 0, -4);
        ctx.fillStyle = comp.isHot ? '#b91c1c' : '#0369a1';
        ctx.font = '800 10px "Outfit", sans-serif';
        ctx.fillText(comp.isHot ? '🔥 40°C' : '❄️ 18°C', 0, 24);
    } else if (comp.type === 'potentiometer') {
        const val = comp.value !== undefined ? comp.value : 0.8;
        const angle = -135 + (val * 270);
        const rad = angle * Math.PI / 180;

        ctx.beginPath();
        ctx.arc(0, -4, 22, 0, Math.PI * 2);
        ctx.fillStyle = '#e0f2fe';
        ctx.fill();
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, -4);
        ctx.lineTo(Math.sin(rad) * 16, -4 - Math.cos(rad) * 16);
        ctx.strokeStyle = '#0284c7';
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.fillStyle = '#0369a1';
        ctx.font = '800 11px "Outfit", sans-serif';
        ctx.fillText(`${Math.round(val * 100)}%`, 0, 24);
    } else if (comp.type === 'gear') {
        ctx.fillStyle = isActive ? '#f59e0b' : '#94a3b8';
        ctx.font = '46px "Font Awesome 6 Free", "FontAwesome"';
        ctx.fillText('\uf013', 0, 0);
    }
}

if (exportBtn) exportBtn.addEventListener('click', exportCircuitAsPNG);

// --- LocalStorage Persistence ---
function saveCircuit() {
    if (isRestoringHistory) return;
    const data = serializeCircuit();
    localStorage.setItem('roboticsLab_circuit', data);
}

function loadSavedCircuit() {
    const saved = localStorage.getItem('roboticsLab_circuit');
    if (!saved) {
        pushHistoryState();
        return;
    }
    restoreCircuitState(saved);
    historyStack = [saved];
    historyIndex = 0;
    updateHistoryButtons();
}

window.addEventListener('DOMContentLoaded', () => {
    loadSavedCircuit();
    updateEnvironmentUI();
});

examplesSelect.addEventListener('change', (e) => {
    const key = e.target.value;
    if (key) {
        loadExample(key);
        e.target.value = "";
    }
});
