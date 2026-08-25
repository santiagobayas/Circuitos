const board = document.getElementById('board');
const wiresLayer = document.getElementById('wires-layer');
const clearBtn = document.getElementById('clear-btn');
const learnBtn = document.getElementById('learn-btn');
const examplesSelect = document.getElementById('examples-select');
const learnModal = document.getElementById('learn-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const toolboxItems = document.querySelectorAll('.toolbox-item');

let components = [];
let wires = [];
let idCounter = 1;

// Wire drawing state
let isDrawingWire = false;
let currentWire = null;
let startTerminal = null;

// Dragging component state
let draggedComp = null;
let dragOffsetX = 0;
let dragOffsetY = 0;

// --- Drag & Drop from Toolbox ---
toolboxItems.forEach(item => {
    item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('type', item.dataset.type);
    });
});

board.addEventListener('dragover', (e) => {
    e.preventDefault(); // allow drop
});

board.addEventListener('drop', (e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('type');
    if (!type) return;

    const boardRect = board.getBoundingClientRect();
    // Drop at center of component (assuming 100x100)
    const x = e.clientX - boardRect.left - 50;
    const y = e.clientY - boardRect.top - 50;

    createComponent(type, x, y);
    playUISound('drop');
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
            // Ascending bloop
            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
            
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(0.3, now + 0.05);
            gainNode.gain.linearRampToValueAtTime(0, now + 0.1);
            
            osc.start(now);
            osc.stop(now + 0.1);
            
        } else if (type === 'delete') {
            // Descending bloop
            osc.type = 'sine';
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.exponentialRampToValueAtTime(150, now + 0.15);
            
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(0.3, now + 0.05);
            gainNode.gain.linearRampToValueAtTime(0, now + 0.15);
            
            osc.start(now);
            osc.stop(now + 0.15);
        } else if (type === 'drop') {
            // Component dropped
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(400, now);
            osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);
            
            gainNode.gain.setValueAtTime(0, now);
            gainNode.gain.linearRampToValueAtTime(0.1, now + 0.05);
            gainNode.gain.linearRampToValueAtTime(0, now + 0.1);
            
            osc.start(now);
            osc.stop(now + 0.1);
        }
    } catch(e) {
        console.error("UI sound error", e);
    }
}

// --- Component Management ---
function createComponent(type, x, y, forceId = null) {
    const id = forceId || `comp_${idCounter++}`;
    let comp;
    switch(type) {
        case 'battery': comp = new Battery(id, x, y); break;
        case 'led': comp = new LED(id, x, y); break;
        case 'motor': comp = new Motor(id, x, y); break;
        case 'fan': comp = new Fan(id, x, y); break;
        case 'buzzer': comp = new Buzzer(id, x, y); break;
        case 'switch': comp = new Switch(id, x, y); break;
        case 'button': comp = new Button(id, x, y); break;
        case 'gear': comp = new Gear(id, x, y); break;
    }

    if (comp) {
        const el = comp.createDOM();
        board.appendChild(el);
        components.push(comp);
        
        setupComponentEvents(comp);
        updateCircuit();
        return comp;
    }
}

window.removeComponent = function(id) {
    playUISound('delete');
    // 1. Remove all wires connected to this component
    const wiresToRemove = wires.filter(w => w.c1 === id || w.c2 === id);
    wiresToRemove.forEach(w => {
        w.element.remove();
    });
    wires = wires.filter(w => w.c1 !== id && w.c2 !== id);

    // 2. Remove component from DOM
    const compIndex = components.findIndex(c => c.id === id);
    if (compIndex !== -1) {
        components[compIndex].destroy();
        components.splice(compIndex, 1);
    }

    // 3. Update logic
    updateCircuit();
};

function setupComponentEvents(comp) {
    const el = comp.element;
    
    // Switch toggle interaction
    if (comp.type === 'switch') {
        el.addEventListener('dblclick', () => {
            comp.toggle();
            updateCircuit();
        });
        // alternative click on icon
        el.querySelector('.switch-visual').addEventListener('mousedown', (e) => {
            comp.toggle();
            updateCircuit();
            e.stopPropagation();
        });
    }

    // Button push interaction
    if (comp.type === 'button') {
        const icon = el.querySelector('.button-visual');
        const press = (e) => { comp.setPressed(true); updateCircuit(); e.stopPropagation(); };
        const release = (e) => { comp.setPressed(false); updateCircuit(); e.stopPropagation(); };
        
        icon.addEventListener('mousedown', press);
        document.addEventListener('mouseup', release);
        icon.addEventListener('touchstart', press);
        document.addEventListener('touchend', release);
    }

    // Dragging on board
    el.addEventListener('mousedown', (e) => {
        // Don't drag if clicking a terminal
        if (e.target.classList.contains('terminal')) return;
        // Don't drag if clicking switch or button icon
        if (e.target.classList.contains('switch-visual') || e.target.classList.contains('button-visual')) return;

        draggedComp = comp;
        const rect = el.getBoundingClientRect();
        dragOffsetX = e.clientX - rect.left;
        dragOffsetY = e.clientY - rect.top;
        
        el.style.zIndex = 100;
        e.stopPropagation();
    });

    // Right click to rotate
    el.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        comp.rotate();
        updateWiresPosition();
        e.stopPropagation();
    });
}

// Global mouse events for dragging and wiring
document.addEventListener('mousemove', (e) => {
    const boardRect = board.getBoundingClientRect();

    if (draggedComp) {
        let x = e.clientX - boardRect.left - dragOffsetX;
        let y = e.clientY - boardRect.top - dragOffsetY;
        
        // Bounds checking
        x = Math.max(0, Math.min(x, boardRect.width - 100));
        y = Math.max(0, Math.min(y, boardRect.height - 100));

        // Snap to grid (20px)
        const SNAP = 20;
        x = Math.round(x / SNAP) * SNAP;
        y = Math.round(y / SNAP) * SNAP;

        draggedComp.x = x;
        draggedComp.y = y;
        draggedComp.element.style.left = `${x}px`;
        draggedComp.element.style.top = `${y}px`;
        
        updateWiresPosition();
    }

    if (isDrawingWire && currentWire) {
        const endX = e.clientX - boardRect.left;
        const endY = e.clientY - boardRect.top;
        const startPos = getTerminalPos(startTerminal.dataset.compId, startTerminal.dataset.termId);
        
        updateWirePath(currentWire, startPos.x, startPos.y, endX, endY);
    }
});

document.addEventListener('mouseup', () => {
    if (draggedComp) {
        draggedComp.element.style.zIndex = 10;
        draggedComp = null;
        updateCircuit(); // Para recalcular la cercanía de engranajes
        saveCircuit();
    }

    if (isDrawingWire) {
        // If mouseup is not on a terminal, cancel wire
        wiresLayer.removeChild(currentWire);
        isDrawingWire = false;
        currentWire = null;
        startTerminal = null;
    }
});

// --- Wiring System ---
board.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('terminal')) {
        startTerminal = e.target;
        isDrawingWire = true;
        
        // Create temp SVG line
        currentWire = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        currentWire.classList.add('wire', 'drawing');
        wiresLayer.appendChild(currentWire);
        
        e.stopPropagation();
    }
});

board.addEventListener('mouseup', (e) => {
    if (isDrawingWire && e.target.classList.contains('terminal')) {
        const endTerminal = e.target;
        
        // Validations
        if (startTerminal !== endTerminal && 
            startTerminal.dataset.compId !== endTerminal.dataset.compId) {
            
            // Check if connection already exists
            const exists = wires.some(w => 
                (w.c1 === startTerminal.dataset.compId && w.t1 === startTerminal.dataset.termId && w.c2 === endTerminal.dataset.compId && w.t2 === endTerminal.dataset.termId) ||
                (w.c2 === startTerminal.dataset.compId && w.t2 === startTerminal.dataset.termId && w.c1 === endTerminal.dataset.compId && w.t1 === endTerminal.dataset.termId)
            );

            if (!exists) {
                // Add permanent wire
                createWire(startTerminal.dataset.compId, startTerminal.dataset.termId, endTerminal.dataset.compId, endTerminal.dataset.termId, currentWire);
                playUISound('connect');
                
                isDrawingWire = false;
                currentWire = null;
                startTerminal = null;
                return; // success
            }
        }
    }
    // Handled by document mouseup to remove drawing
});

function getTerminalPos(compId, termId) {
    const comp = components.find(c => c.id === compId);
    if (!comp) return {x:0, y:0};
    
    // offset depends on terminal position
    let tx = comp.x + 50; // center
    let ty = comp.y + 50; // center
    
    const term = comp.terminals.find(t => t.id === termId);
    if (term) {
        let dx = 0;
        let dy = 0;
        if (term.position === 'top') dy = -50;
        if (term.position === 'bottom') dy = 50;
        if (term.position === 'left') dx = -50;
        if (term.position === 'right') dx = 50;

        // Apply rotation
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
    // Smooth curve
    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    // Control point calculation for nice curves
    const cpX1 = x1 + (x2 > x1 ? dx/2 : -dx/2);
    const cpY1 = y1 + (y2 > y1 ? dy/8 : -dy/8);
    
    const d = `M ${x1} ${y1} Q ${cpX1} ${y1} ${x2} ${y2}`;
    // Simpler curved line:
    // const d = `M ${x1} ${y1} C ${x1 + dx/3} ${y1}, ${x2 - dx/3} ${y2}, ${x2} ${y2}`;
    
    pathEl.setAttribute('d', d);
}


// --- Circuit Logic ---
function updateCircuit() {
    // 1. Build Graph adjacency list
    // Nodes: string `${compId}_${termId}`
    const adj = {};
    const addEdge = (n1, n2, wireId) => {
        if(!adj[n1]) adj[n1] = [];
        if(!adj[n2]) adj[n2] = [];
        adj[n1].push({ to: n2, wireId });
        adj[n2].push({ to: n1, wireId });
    };

    // Add edges from wires
    wires.forEach(w => {
        addEdge(`${w.c1}_${w.t1}`, `${w.c2}_${w.t2}`, w.id);
    });

    // Add internal edges (inside components)
    components.forEach(c => {
        if (c.type === 'battery') return; // Battery is the source, no internal edge
        
        // Some components bridge their terminals conditionally
        if ((c.type === 'switch' || c.type === 'button') && !c.isClosed) return; 
        
        if (c.terminals.length >= 2) {
            addEdge(`${c.id}_${c.terminals[0].id}`, `${c.id}_${c.terminals[1].id}`, null);
        }
    });

    // 3. Find if any battery forms a closed loop
    const batteries = components.filter(c => c.type === 'battery');
    
    let activeComponents = new Set();
    let activeWires = new Set();

    batteries.forEach(batt => {
        const startNode = `${batt.id}_t1`;
        const targetNode = `${batt.id}_t2`;

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
                        // Traverse if it's NOT a consumer
                        if (compObj && ['led', 'motor', 'fan', 'buzzer'].includes(compObj.type)) {
                            continue; // Block consumer paths
                        }
                        visitedSC.add(edge.to);
                        queueSC.push(edge.to);
                    }
                }
            }
        }

        if (isShortCircuit) {
            // Apply short circuit visual to battery
            batt.element.classList.add('short-circuit-alert');
            return; // Stop processing this battery's paths
        } else {
            batt.element.classList.remove('short-circuit-alert');
        }

        // 2. Normal BFS to find path from t1 to t2
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
                        // Extract component ID correctly (e.g., "comp_1_t1" -> "comp_1")
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
            // Include battery itself
            activeComponents.add(batt.id);
            finalPathComps.forEach(id => activeComponents.add(id));
            finalPathWires.forEach(id => activeWires.add(id));
        }
    });

    // 3. Apply states based on active status
    components.forEach(c => {
        const shouldBeActive = activeComponents.has(c.id);
        if (c.updateState && c.type !== 'gear') c.updateState(shouldBeActive);
    });
    
    // 3.5 Mechanical interactions (Gears and active Motors)
    const activeMotors = components.filter(c => c.type === 'motor' && activeComponents.has(c.id));
    const gears = components.filter(c => c.type === 'gear');
    
    gears.forEach(g => {
        let isNearActiveMotor = false;
        activeMotors.forEach(m => {
            const dx = m.x - g.x;
            const dy = m.y - g.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist <= 145) { // 145px is enough for adjacent diagonals (grid is 20px, component is ~100px)
                isNearActiveMotor = true;
            }
        });
        if (g.updateState) g.updateState(isNearActiveMotor);
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
function clearBoard() {
    components.forEach(c => c.destroy());
    components = [];
    
    wires.forEach(w => w.element.remove());
    wires = [];
    
    idCounter = 1;
    updateCircuit();
}

clearBtn.addEventListener('click', () => {
    playUISound('delete');
    clearBoard();
});

// --- Modal de Aprendizaje ---
learnBtn.addEventListener('click', () => {
    learnModal.classList.remove('hidden');
    playUISound('connect'); // Usar el mismo sonido amigable
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
            { type: 'led', x: 400, y: 300 }
        ],
        wires: [
            { c1: 1, t1: 't1', c2: 2, t2: 't1' },
            { c1: 1, t1: 't2', c2: 2, t2: 't2' }
        ]
    },
    switch: {
        comps: [
            { type: 'battery', x: 100, y: 300 },
            { type: 'switch', x: 300, y: 150 },
            { type: 'fan', x: 500, y: 300 }
        ],
        wires: [
            { c1: 1, t1: 't1', c2: 2, t2: 't1' },
            { c1: 2, t1: 't2', c2: 3, t2: 't1' },
            { c1: 3, t1: 't2', c2: 1, t2: 't2' }
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
    clearBoard();
    const data = examples[key];
    if (!data) return;

    data.comps.forEach(c => {
        createComponent(c.type, c.x, c.y);
    });

    data.wires.forEach(w => {
        const c1Str = `comp_${w.c1}`;
        const c2Str = `comp_${w.c2}`;
        createWire(c1Str, w.t1, c2Str, w.t2);
    });

    updateWiresPosition();
    updateCircuit();
}

function createWire(c1, t1, c2, t2, existingPathEl = null) {
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
    pathEl.style.pointerEvents = 'auto'; // allow click
    pathEl.classList.add('clickable-wire');
    pathEl.addEventListener('click', () => {
        playUISound('delete');
        wires = wires.filter(w => w.id !== wireObj.id);
        pathEl.remove();
        updateCircuit();
    });
    
    wires.push(wireObj);
    updateWiresPosition();
    updateCircuit();
}

function saveCircuit() {
    const data = {
        components: components.map(c => ({
            id: c.id,
            type: c.type,
            x: c.x,
            y: c.y,
            rotation: c.rotation || 0
        })),
        wires: wires.map(w => ({
            c1: w.c1,
            t1: w.t1,
            c2: w.c2,
            t2: w.t2
        })),
        idCounter: idCounter
    };
    localStorage.setItem('roboticsLab_circuit', JSON.stringify(data));
}

function loadSavedCircuit() {
    const saved = localStorage.getItem('roboticsLab_circuit');
    if (!saved) return;
    try {
        const data = JSON.parse(saved);
        clearBoard();
        
        data.components.forEach(c => {
            const comp = createComponent(c.type, c.x, c.y, c.id);
            if (comp && c.rotation) {
                comp.rotation = c.rotation;
                comp.applyRotation();
            }
        });
        
        idCounter = data.idCounter || idCounter;
        
        data.wires.forEach(w => {
            createWire(w.c1, w.t1, w.c2, w.t2);
        });
        
        updateWiresPosition();
        updateCircuit();
    } catch(e) {
        console.error("Error loading circuit", e);
    }
}

// Inicializar
window.addEventListener('DOMContentLoaded', loadSavedCircuit);

examplesSelect.addEventListener('change', (e) => {
    const key = e.target.value;
    if (key) {
        loadExample(key);
        // Reset the select back to default option
        e.target.value = "";
    }
});
