// Definición de componentes eléctricos

class Component {
    constructor(id, type, x, y) {
        this.id = id;
        this.type = type;
        this.x = x;
        this.y = y;
        this.rotation = 0;
        this.terminals = [];
        this.element = null;
    }

    createDOM() {
        const el = document.createElement('div');
        el.className = 'board-component';
        el.id = this.id;
        el.style.left = `${this.x}px`;
        el.style.top = `${this.y}px`;

        // Delete button
        const delBtn = document.createElement('div');
        delBtn.className = 'delete-btn';
        delBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        delBtn.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            if (window.removeComponent) window.removeComponent(this.id);
        });
        el.appendChild(delBtn);

        // Graphic container
        const graphic = document.createElement('div');
        graphic.className = `component-graphic comp-${this.type}`;
        graphic.innerHTML = this.getIconHTML();
        el.appendChild(graphic);

        // Terminals
        this.terminals.forEach(term => {
            const t = document.createElement('div');
            t.className = `terminal ${term.position}`;
            t.dataset.compId = this.id;
            t.dataset.termId = term.id;
            el.appendChild(t);
        });

        this.element = el;
        this.applyRotation();
        return el;
    }

    applyRotation() {
        if (!this.element) return;
        this.element.style.transform = `rotate(${this.rotation}deg)`;
    }

    rotate() {
        this.rotation = (this.rotation + 90) % 360;
        this.applyRotation();
    }

    destroy() {
        if (this.updateState) this.updateState(false);
        if (this.element) this.element.remove();
    }

    getIconHTML() {
        return '';
    }

    updateState(isActive) {
        // Overridden in subclasses
    }
}

class Battery extends Component {
    constructor(id, x, y) {
        super(id, 'battery', x, y);
        this.terminals = [
            { id: 't1', position: 'top' }, // Positive
            { id: 't2', position: 'bottom' } // Negative
        ];
    }
    getIconHTML() {
        return '<i class="fa-solid fa-battery-full"></i>';
    }
}

class LED extends Component {
    constructor(id, x, y) {
        super(id, 'led', x, y);
        this.terminals = [
            { id: 't1', position: 'left' },
            { id: 't2', position: 'right' }
        ];
    }
    getIconHTML() {
        return '<i class="fa-solid fa-lightbulb"></i>';
    }
    updateState(isActive) {
        const icon = this.element.querySelector('.comp-led');
        if (isActive) {
            icon.classList.add('active');
        } else {
            icon.classList.remove('active');
        }
    }
}

class Motor extends Component {
    constructor(id, x, y) {
        super(id, 'motor', x, y);
        this.terminals = [
            { id: 't1', position: 'left' },
            { id: 't2', position: 'right' }
        ];
    }
    getIconHTML() {
        return '<i class="fa-solid fa-gear"></i>';
    }
    updateState(isActive) {
        const icon = this.element.querySelector('.comp-motor');
        if (isActive) {
            icon.classList.add('active');
        } else {
            icon.classList.remove('active');
        }
    }
}

class Switch extends Component {
    constructor(id, x, y) {
        super(id, 'switch', x, y);
        this.isClosed = false;
        this.terminals = [
            { id: 't1', position: 'left' },
            { id: 't2', position: 'right' }
        ];
    }
    getIconHTML() {
        return '<i class="fa-solid fa-toggle-off switch-visual"></i>';
    }
    
    toggle() {
        this.isClosed = !this.isClosed;
        const icon = this.element.querySelector('.switch-visual');
        if (this.isClosed) {
            icon.classList.remove('fa-toggle-off');
            icon.classList.add('fa-toggle-on');
            icon.style.color = '#10b981'; // Green when ON
        } else {
            icon.classList.remove('fa-toggle-on');
            icon.classList.add('fa-toggle-off');
            icon.style.color = ''; // Default
        }
        return this.isClosed;
    }
}

class Fan extends Component {
    constructor(id, x, y) {
        super(id, 'fan', x, y);
        this.terminals = [
            { id: 't1', position: 'left' },
            { id: 't2', position: 'right' }
        ];
    }
    getIconHTML() {
        return '<i class="fa-solid fa-fan"></i>';
    }
    updateState(isActive) {
        const icon = this.element.querySelector('.comp-fan');
        if (isActive) icon.classList.add('active');
        else icon.classList.remove('active');
    }
}

class Buzzer extends Component {
    constructor(id, x, y) {
        super(id, 'buzzer', x, y);
        this.terminals = [
            { id: 't1', position: 'left' },
            { id: 't2', position: 'right' }
        ];
        this.audioCtx = null;
        this.oscillator = null;
        this.gainNode = null;
        this.isPlaying = false;
    }
    getIconHTML() {
        return '<i class="fa-solid fa-volume-high"></i>';
    }
    updateState(isActive) {
        if (this.isPlaying === isActive) return; // Evitar reinicios constantes en cada frame
        this.isPlaying = isActive;

        const icon = this.element.querySelector('.comp-buzzer');
        if (isActive) {
            icon.classList.add('active');
            
            // Iniciar sonido
            if (!this.audioCtx) {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }
            
            // Tono muy suave y relajante (C4)
            this.oscillator = this.audioCtx.createOscillator();
            this.oscillator.type = 'sine';
            this.oscillator.frequency.setValueAtTime(261.63, this.audioCtx.currentTime); 
            
            this.gainNode = this.audioCtx.createGain();
            this.gainNode.gain.setValueAtTime(0, this.audioCtx.currentTime);
            // Aparece suavemente (Fade in de 0.5 segundos) para no asustar
            this.gainNode.gain.linearRampToValueAtTime(0.08, this.audioCtx.currentTime + 0.5);
            
            this.oscillator.connect(this.gainNode);
            this.gainNode.connect(this.audioCtx.destination);
            
            this.oscillator.start();
            
        } else {
            icon.classList.remove('active');
            
            // Detener sonido con un fade out suave
            if (this.gainNode && this.audioCtx) {
                const now = this.audioCtx.currentTime;
                this.gainNode.gain.cancelScheduledValues(now);
                this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
                this.gainNode.gain.linearRampToValueAtTime(0, now + 0.4); // Desaparece en 0.4s
            }
            
            if (this.oscillator && this.audioCtx) {
                const oscToStop = this.oscillator;
                oscToStop.stop(this.audioCtx.currentTime + 0.4);
                setTimeout(() => {
                    try { oscToStop.disconnect(); } catch(e){}
                }, 450);
                this.oscillator = null;
            }
            this.gainNode = null;
        }
    }
}

class Button extends Component {
    constructor(id, x, y) {
        super(id, 'button', x, y);
        this.isClosed = false;
        this.terminals = [
            { id: 't1', position: 'left' },
            { id: 't2', position: 'right' }
        ];
    }
    getIconHTML() {
        return '<i class="fa-regular fa-circle-dot button-visual"></i>';
    }
    
    // For push button, it needs mousedown / mouseup events
    setPressed(pressed) {
        this.isClosed = pressed;
        const icon = this.element.querySelector('.button-visual');
        if (this.isClosed) {
            icon.classList.remove('fa-circle-dot');
            icon.classList.add('fa-circle-check');
            icon.style.color = '#10b981';
        } else {
            icon.classList.remove('fa-circle-check');
            icon.classList.add('fa-circle-dot');
            icon.style.color = '';
        }
    }
}

class Gear extends Component {
    constructor(id, x, y) {
        super(id, 'gear', x, y);
        this.terminals = []; // Sin terminales eléctricos
    }
    getIconHTML() {
        return '<i class="fa-solid fa-gear gear-visual"></i>';
    }
    updateState(isActive) {
        const icon = this.element.querySelector('.comp-gear');
        if (isActive) icon.classList.add('active');
        else icon.classList.remove('active');
    }
}
