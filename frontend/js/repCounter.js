class RepCounter {
    constructor(displayId) {
        this.display = document.getElementById(displayId);
        this.count = 0;
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
                if (targetDisplay) targetDisplay.innerText = this.target;
                if (window.voiceCoach && typeof window.voiceCoach.checkTargetAdjustment === 'function') {
                    window.voiceCoach.checkTargetAdjustment(this.target, window.currentExercise || 'squat');
                }
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

        // Primary: Backend state machine (biomechanical_rules.py) is single source of truth
        if (data.reps !== undefined && typeof data.reps === 'number') {
            if (data.reps > this.count) {
                this.animateCount();
            }
            this.count = data.reps;
            if (this.display) this.display.innerText = this.count;
        }
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
