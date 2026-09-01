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
        const handleDelete = (e) => {
            e.stopPropagation();
            if (e.cancelable) e.preventDefault();
            if (window.removeComponent) window.removeComponent(this.id);
        };
        delBtn.addEventListener('mousedown', handleDelete);
        delBtn.addEventListener('touchstart', handleDelete, { passive: false });
        el.appendChild(delBtn);

        // Rotate button (ideal para pantallas táctiles y móviles)
        const rotBtn = document.createElement('div');
        rotBtn.className = 'rotate-btn';
        rotBtn.innerHTML = '<i class="fa-solid fa-rotate-right"></i>';
        rotBtn.title = 'Rotar componente';
        const handleRotate = (e) => {
            e.stopPropagation();
            if (e.cancelable) e.preventDefault();
            this.rotate();
            if (window.onComponentRotated) window.onComponentRotated(this);
        };
        rotBtn.addEventListener('mousedown', handleRotate);
        rotBtn.addEventListener('touchstart', handleRotate, { passive: false });
        el.appendChild(rotBtn);

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
    updateState(isActive, intensity = 1.0) {
        const icon = this.element.querySelector('.comp-led');
        if (isActive) {
            icon.classList.add('active');
            const clamped = Math.max(0.1, Math.min(1.0, intensity));
            icon.style.filter = `drop-shadow(0 0 ${22 * clamped}px rgba(245, 158, 11, ${clamped})) brightness(${0.6 + 0.6 * clamped})`;
            icon.style.opacity = `${0.35 + 0.65 * clamped}`;
        } else {
            icon.classList.remove('active');
            icon.style.filter = '';
            icon.style.opacity = '';
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
        this.currentSpeed = 1;
    }
    getIconHTML() {
        return '<i class="fa-solid fa-gear"></i>';
    }
    updateState(isActive, intensity = 1.0) {
        const icon = this.element.querySelector('.comp-motor');
        if (isActive) {
            icon.classList.add('active');
            const clamped = Math.max(0.1, Math.min(1.0, intensity));
            this.currentSpeed = clamped;
            const duration = (1.0 / clamped).toFixed(2);
            icon.style.animationDuration = `${duration}s`;
        } else {
            icon.classList.remove('active');
            icon.style.animationDuration = '';
            this.currentSpeed = 0;
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
    updateState(isActive, intensity = 1.0) {
        const icon = this.element.querySelector('.comp-fan');
        if (isActive) {
            icon.classList.add('active');
            const clamped = Math.max(0.1, Math.min(1.0, intensity));
            const duration = (0.25 / clamped).toFixed(2);
            icon.style.animationDuration = `${duration}s`;
        } else {
            icon.classList.remove('active');
            icon.style.animationDuration = '';
        }
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
        this.intensity = 1.0;
    }
    getIconHTML() {
        return '<i class="fa-solid fa-volume-high"></i>';
    }
    updateState(isActive, intensity = 1.0) {
        this.intensity = intensity;
        const clamped = Math.max(0.1, Math.min(1.0, intensity));
        const icon = this.element.querySelector('.comp-buzzer');

        if (isActive) {
            icon.classList.add('active');
            const targetGain = 0.08 * clamped;
            const targetFreq = 200 + 120 * clamped;
            
            if (!this.audioCtx) {
                this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }
            
            if (!this.isPlaying) {
                this.isPlaying = true;
                this.oscillator = this.audioCtx.createOscillator();
                this.oscillator.type = 'sine';
                this.oscillator.frequency.setValueAtTime(targetFreq, this.audioCtx.currentTime); 
                
                this.gainNode = this.audioCtx.createGain();
                this.gainNode.gain.setValueAtTime(0, this.audioCtx.currentTime);
                this.gainNode.gain.linearRampToValueAtTime(targetGain, this.audioCtx.currentTime + 0.3);
                
                this.oscillator.connect(this.gainNode);
                this.gainNode.connect(this.audioCtx.destination);
                this.oscillator.start();
            } else if (this.gainNode && this.oscillator) {
                const now = this.audioCtx.currentTime;
                this.gainNode.gain.setTargetAtTime(targetGain, now, 0.05);
                this.oscillator.frequency.setTargetAtTime(targetFreq, now, 0.05);
            }
        } else {
            icon.classList.remove('active');
            if (this.isPlaying) {
                this.isPlaying = false;
                if (this.gainNode && this.audioCtx) {
                    const now = this.audioCtx.currentTime;
                    this.gainNode.gain.cancelScheduledValues(now);
                    this.gainNode.gain.setValueAtTime(this.gainNode.gain.value, now);
                    this.gainNode.gain.linearRampToValueAtTime(0, now + 0.2);
                }
                
                if (this.oscillator && this.audioCtx) {
                    const oscToStop = this.oscillator;
                    oscToStop.stop(this.audioCtx.currentTime + 0.2);
                    setTimeout(() => {
                        try { oscToStop.disconnect(); } catch(e){}
                    }, 250);
                    this.oscillator = null;
                }
                this.gainNode = null;
            }
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

class Potentiometer extends Component {
    constructor(id, x, y, value = 0.8) {
        super(id, 'potentiometer', x, y);
        this.value = value; // 0.05 a 1.0
        this.terminals = [
            { id: 't1', position: 'left' },
            { id: 't2', position: 'right' }
        ];
    }
    getIconHTML() {
        const angle = -135 + (this.value * 270);
        const pct = Math.round(this.value * 100);
        return `
            <div class="knob-container" title="Gira o usa la rueda del ratón para ajustar">
                <div class="knob-dial" style="transform: rotate(${angle}deg);">
                    <div class="knob-pointer"></div>
                </div>
                <div class="knob-label">${pct}%</div>
            </div>
        `;
    }
    setValue(newVal) {
        this.value = Math.max(0.05, Math.min(1.0, newVal));
        if (this.element) {
            const dial = this.element.querySelector('.knob-dial');
            const label = this.element.querySelector('.knob-label');
            const angle = -135 + (this.value * 270);
            if (dial) dial.style.transform = `rotate(${angle}deg)`;
            if (label) label.textContent = `${Math.round(this.value * 100)}%`;
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
    updateState(isActive, intensity = 1.0) {
        const icon = this.element.querySelector('.comp-gear');
        if (isActive) {
            icon.classList.add('active');
            const clamped = Math.max(0.1, Math.min(1.0, intensity));
            const duration = (2.0 / clamped).toFixed(2);
            const iconEl = icon.querySelector('i');
            if (iconEl) iconEl.style.animationDuration = `${duration}s`;
        } else {
            icon.classList.remove('active');
            const iconEl = icon.querySelector('i');
            if (iconEl) iconEl.style.animationDuration = '';
        }
    }
}

class SolarPanel extends Component {
    constructor(id, x, y, isSunny = true) {
        super(id, 'solar', x, y);
        this.isSunny = isSunny;
        this.terminals = [
            { id: 't1', position: 'top' }, // Positivo
            { id: 't2', position: 'bottom' } // Negativo
        ];
    }
    getIconHTML() {
        return `
            <div class="solar-container ${this.isSunny ? 'sunny' : 'cloudy'}" title="Genera energía con el sol del Entorno ☀️">
                <i class="fa-solid fa-solar-panel solar-grid-icon"></i>
                <div class="solar-sun-toggle"><i class="fa-solid ${this.isSunny ? 'fa-sun' : 'fa-cloud'}"></i></div>
            </div>
        `;
    }
    setSunny(sunny) {
        this.isSunny = sunny;
        const container = this.element ? this.element.querySelector('.solar-container') : null;
        const icon = this.element ? this.element.querySelector('.solar-sun-toggle i') : null;
        if (container) {
            container.className = `solar-container ${this.isSunny ? 'sunny' : 'cloudy'}`;
        }
        if (icon) {
            icon.className = `fa-solid ${this.isSunny ? 'fa-sun' : 'fa-cloud'}`;
        }
    }
    toggleSun() {
        this.setSunny(!this.isSunny);
        return this.isSunny;
    }
}

class Photoresistor extends Component {
    constructor(id, x, y, isDark = false) {
        super(id, 'ldr', x, y);
        this.isDark = isDark;
        this.isClosed = isDark; // Conduce corriente en la oscuridad
        this.terminals = [
            { id: 't1', position: 'left' },
            { id: 't2', position: 'right' }
        ];
    }
    getIconHTML() {
        return `
            <div class="sensor-container ldr-container ${this.isDark ? 'night' : 'day'}" title="Detecta la noche del Entorno 🌙">
                <i class="fa-solid ${this.isDark ? 'fa-moon' : 'fa-cloud-sun'} ldr-main-icon"></i>
                <span class="sensor-badge">${this.isDark ? '🌙 Noche' : '☀️ Día'}</span>
            </div>
        `;
    }
    setDark(dark) {
        this.isDark = dark;
        this.isClosed = dark;
        const container = this.element ? this.element.querySelector('.ldr-container') : null;
        const badge = this.element ? this.element.querySelector('.sensor-badge') : null;
        const icon = this.element ? this.element.querySelector('.ldr-main-icon') : null;
        if (container) container.className = `sensor-container ldr-container ${this.isDark ? 'night' : 'day'}`;
        if (badge) badge.textContent = this.isDark ? '🌙 Noche' : '☀️ Día';
        if (icon) icon.className = `fa-solid ${this.isDark ? 'fa-moon' : 'fa-cloud-sun'} ldr-main-icon`;
    }
    toggleLight() {
        this.setDark(!this.isDark);
        return this.isClosed;
    }
}

class ProximitySensor extends Component {
    constructor(id, x, y) {
        super(id, 'proximity', x, y);
        this.isDetected = false;
        this.isClosed = false;
        this.terminals = [
            { id: 't1', position: 'left' },
            { id: 't2', position: 'right' }
        ];
    }
    getIconHTML() {
        return `
            <div class="sensor-container prox-container ${this.isDetected ? 'detecting' : ''}" title="¡Pasa el ratón cerca del sensor!">
                <div class="ultrasonic-eyes">
                    <div class="eye"></div>
                    <div class="eye"></div>
                </div>
                <div class="radar-wave"></div>
                <span class="sensor-badge">${this.isDetected ? '¡ALERTA!' : 'Vigilando'}</span>
            </div>
        `;
    }
    setDetected(detected) {
        if (this.isDetected === detected) return;
        this.isDetected = detected;
        this.isClosed = detected;
        const container = this.element ? this.element.querySelector('.prox-container') : null;
        const badge = this.element ? this.element.querySelector('.sensor-badge') : null;
        if (container) {
            if (this.isDetected) container.classList.add('detecting');
            else container.classList.remove('detecting');
        }
        if (badge) {
            badge.textContent = this.isDetected ? '¡ALERTA!' : 'Vigilando';
        }
    }
}

class TemperatureSensor extends Component {
    constructor(id, x, y, isHot = false) {
        super(id, 'thermostat', x, y);
        this.isHot = isHot;
        this.isClosed = isHot; // Se activa con el calor
        this.terminals = [
            { id: 't1', position: 'left' },
            { id: 't2', position: 'right' }
        ];
    }
    getIconHTML() {
        return `
            <div class="sensor-container temp-container ${this.isHot ? 'hot' : 'cold'}" title="Detecta la temperatura del Entorno 🔥">
                <i class="fa-solid ${this.isHot ? 'fa-temperature-high' : 'fa-temperature-low'} temp-icon"></i>
                <span class="sensor-badge">${this.isHot ? '🔥 40°C' : '❄️ 18°C'}</span>
            </div>
        `;
    }
    setHot(hot) {
        this.isHot = hot;
        this.isClosed = hot;
        const container = this.element ? this.element.querySelector('.temp-container') : null;
        const badge = this.element ? this.element.querySelector('.sensor-badge') : null;
        const icon = this.element ? this.element.querySelector('.temp-icon') : null;
        if (container) container.className = `sensor-container temp-container ${this.isHot ? 'hot' : 'cold'}`;
        if (badge) badge.textContent = this.isHot ? '🔥 40°C' : '❄️ 18°C';
        if (icon) icon.className = `fa-solid ${this.isHot ? 'fa-temperature-high' : 'fa-temperature-low'} temp-icon`;
    }
    toggleTemp() {
        this.setHot(!this.isHot);
        return this.isClosed;
    }
}

class RGBLED extends Component {
    constructor(id, x, y, color = '#ec4899') {
        super(id, 'rgbled', x, y);
        this.colorList = ['#ef4444', '#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#06b6d4', '#ec4899', '#ffffff'];
        this.color = color;
        this.terminals = [
            { id: 't1', position: 'left' },
            { id: 't2', position: 'right' }
        ];
    }
    getIconHTML() {
        return `
            <div class="rgb-led-container" title="Toca para cambiar el color del LED">
                <i class="fa-solid fa-lightbulb rgb-bulb" style="color: #d1d5db;"></i>
                <div class="rgb-color-pip" style="background-color: ${this.color};"></div>
            </div>
        `;
    }
    cycleColor() {
        const idx = this.colorList.indexOf(this.color);
        const nextIdx = (idx + 1) % this.colorList.length;
        this.color = this.colorList[nextIdx];
        const pip = this.element ? this.element.querySelector('.rgb-color-pip') : null;
        if (pip) pip.style.backgroundColor = this.color;
        return this.color;
    }
    updateState(isActive, intensity = 1.0) {
        const icon = this.element ? this.element.querySelector('.rgb-bulb') : null;
        const pip = this.element ? this.element.querySelector('.rgb-color-pip') : null;
        if (pip) pip.style.backgroundColor = this.color;
        
        if (icon) {
            if (isActive) {
                icon.classList.add('active');
                icon.style.color = this.color;
                const clamped = Math.max(0.1, Math.min(1.0, intensity));
                icon.style.filter = `drop-shadow(0 0 ${24 * clamped}px ${this.color}) brightness(${0.7 + 0.6 * clamped})`;
                icon.style.opacity = `${0.4 + 0.6 * clamped}`;
            } else {
                icon.classList.remove('active');
                icon.style.color = '#d1d5db';
                icon.style.filter = '';
                icon.style.opacity = '';
            }
        }
    }
}

class SevenSegmentDisplay extends Component {
    constructor(id, x, y, digit = 0) {
        super(id, 'display7seg', x, y);
        this.digit = digit;
        this.wasActive = false;
        this.terminals = [
            { id: 't1', position: 'left' },
            { id: 't2', position: 'right' }
        ];
    }
    getIconHTML() {
        return `
            <div class="display-7seg-box" title="Display digital (Toca para cambiar de número)">
                <div class="seven-segment-render">${this.renderSegmentsHTML(this.digit, false)}</div>
            </div>
        `;
    }
    renderSegmentsHTML(num, isActive) {
        const patterns = {
            0: ['a', 'b', 'c', 'd', 'e', 'f'],
            1: ['b', 'c'],
            2: ['a', 'b', 'd', 'e', 'g'],
            3: ['a', 'b', 'c', 'd', 'g'],
            4: ['b', 'c', 'f', 'g'],
            5: ['a', 'c', 'd', 'f', 'g'],
            6: ['a', 'c', 'd', 'e', 'f', 'g'],
            7: ['a', 'b', 'c'],
            8: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
            9: ['a', 'b', 'c', 'd', 'f', 'g']
        };
        const activeSegs = patterns[num] || patterns[0];
        const allSegs = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
        
        let segsHTML = allSegs.map(s => {
            const on = activeSegs.includes(s) && isActive;
            return `<div class="seg seg-${s} ${on ? 'seg-on' : 'seg-off'}"></div>`;
        }).join('');

        return `
            <div class="digit-wrapper ${isActive ? 'is-powered' : ''}">
                ${segsHTML}
            </div>
        `;
    }
    nextDigit() {
        this.digit = (this.digit + 1) % 10;
        this.refreshDisplay(this.wasActive);
        return this.digit;
    }
    refreshDisplay(isActive) {
        const render = this.element ? this.element.querySelector('.seven-segment-render') : null;
        if (render) {
            render.innerHTML = this.renderSegmentsHTML(this.digit, isActive);
        }
    }
    updateState(isActive, intensity = 1.0) {
        if (isActive && !this.wasActive) {
            this.digit = (this.digit + 1) % 10;
            if (window.playUISound) window.playUISound('connect');
        }
        this.wasActive = isActive;
        this.refreshDisplay(isActive);
    }
}

class RainSensor extends Component {
    constructor(id, x, y, isWet = false) {
        super(id, 'rain', x, y);
        this.isWet = isWet;
        this.isClosed = isWet;
        this.terminals = [
            { id: 't1', position: 'left' },
            { id: 't2', position: 'right' }
        ];
    }
    getIconHTML() {
        return `
            <div class="sensor-container rain-container ${this.isWet ? 'wet' : 'dry'}" title="Detecta la lluvia del Entorno 🌧️">
                <i class="fa-solid fa-cloud-showers-heavy rain-icon"></i>
                <span class="sensor-badge">${this.isWet ? '💧 Mojado' : '☀️ Seco'}</span>
            </div>
        `;
    }
    setWet(wet) {
        this.isWet = wet;
        this.isClosed = wet;
        const container = this.element ? this.element.querySelector('.rain-container') : null;
        const badge = this.element ? this.element.querySelector('.sensor-badge') : null;
        if (container) container.className = `sensor-container rain-container ${this.isWet ? 'wet' : 'dry'}`;
        if (badge) badge.textContent = this.isWet ? '💧 Mojado' : '☀️ Seco';
    }
    toggleWet() {
        this.setWet(!this.isWet);
        return this.isClosed;
    }
}
