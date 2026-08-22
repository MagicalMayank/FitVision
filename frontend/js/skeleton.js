class SkeletonDrawer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    draw(keypoints) {
        this.clear();
        if (!keypoints || keypoints.length === 0) return;

        // Keypoints are assumed to be normalized (0-1) from backend
        // or absolute in original frame size (320xN).
        // Let's assume normalized for flexibility.

        const connections = [
            [5, 7], [7, 9],   // Left arm
            [6, 8], [8, 10],  // Right arm
            [5, 6],           // Shoulders
            [5, 11], [6, 12], // Torso
            [11, 12],         // Hips
            [11, 13], [13, 15], // Left leg
            [12, 14], [14, 16]  // Right leg
        ];

        // Draw lines
        this.ctx.beginPath();
        this.ctx.strokeStyle = '#7edb7f';
        this.ctx.lineWidth = 2;
        this.ctx.lineCap = 'round';
        this.ctx.shadowBlur = 8;
        this.ctx.shadowColor = 'rgba(126, 219, 127, 0.8)';

        connections.forEach(([i, j]) => {
            const kp1 = keypoints[i];
            const kp2 = keypoints[j];
            if (kp1 && kp2 && kp1.conf > 0.3 && kp2.conf > 0.3) {
                this.ctx.moveTo(kp1.x * this.canvas.width, kp1.y * this.canvas.height);
                this.ctx.lineTo(kp2.x * this.canvas.width, kp2.y * this.canvas.height);
            }
        });
        this.ctx.stroke();

        // Draw joints
        this.ctx.shadowBlur = 4;
        this.ctx.shadowColor = '#F5FF00';
        this.ctx.fillStyle = '#F5FF00';

        keypoints.forEach((kp, i) => {
            if (kp && kp.conf > 0.3) {
                // Skip ears/eyes if we want a cleaner skeleton
                if (i > 4) {
                    this.ctx.beginPath();
                    this.ctx.arc(kp.x * this.canvas.width, kp.y * this.canvas.height, 4, 0, Math.PI * 2);
                    this.ctx.fill();
                }
            }
        });
    }
}

const skeleton = new SkeletonDrawer('skeletonCanvas');
window.onPoseDetected = (data) => {
    if (data.keypoints) {
        skeleton.draw(data.keypoints);
    }
    if (window.updateRepCounter) {
        window.updateRepCounter(data.angles);
    }
    if (window.showFeedback) {
        window.showFeedback(data.feedback);
    }
};
