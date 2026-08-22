class RepCounter {
    constructor(displayId) {
        this.display = document.getElementById(displayId);
        this.count = 0;
        this.state = 'up'; // 'up' or 'down'
        this.thresholdDown = 90; // Angle threshold for down position
        this.thresholdUp = 160;  // Angle threshold for up position
        this.target = 15;
        this.initTargetControls();
    }

    initTargetControls() {
        const incBtn = document.getElementById('incTarget');
        const decBtn = document.getElementById('decTarget');
        const targetDisplay = document.getElementById('targetDisplay');

        if (incBtn) {
            incBtn.addEventListener('click', () => {
                this.target++;
                targetDisplay.innerText = this.target;
            });
        }

        if (decBtn) {
            decBtn.addEventListener('click', () => {
                if (this.target > 1) {
                    this.target--;
                    targetDisplay.innerText = this.target;
                }
            });
        }
    }

    update(data) {
        if (!data) return;

        // If backend returned validated state machine rep count, use it directly!
        if (data.reps !== undefined && typeof data.reps === 'number') {
            if (data.reps !== this.count) {
                this.count = data.reps;
                this.animateCount();
            }
            if (this.display) this.display.innerText = this.count;
            return;
        }

        // Fallback local angle counting
        const angles = data.angles || data;
        const currentAngle = angles ? (angles.knee || angles.elbow || angles.primary) : null;
        if (currentAngle === null) return;

        if (this.state === 'up' && currentAngle < this.thresholdDown) {
            this.state = 'down';
        } else if (this.state === 'down' && currentAngle > this.thresholdUp) {
            this.state = 'up';
            this.count++;
            this.animateCount();
        }

        if (this.display) this.display.innerText = this.count;
    }

    animateCount() {
        if (!this.display) return;
        this.display.classList.remove('animate-count-pop');
        void this.display.offsetWidth; // trigger reflow
        this.display.classList.add('animate-count-pop');
    }
}

const repCounter = new RepCounter('repCount');
window.repCounter = repCounter;
window.updateRepCounter = (data) => repCounter.update(data);
