class SkeletonDrawer {
    constructor(canvasId = 'skeletonCanvas', videoId = 'webcam') {
        this.canvas = document.getElementById(canvasId);
        this.video = document.getElementById(videoId);
        this.dpr = window.devicePixelRatio || 1;
        this.cssWidth = 0;
        this.cssHeight = 0;

        if (this.canvas) {
            this.ctx = this.canvas.getContext('2d');
            this.resize();
        }

        // Add ResizeObserver and orientation listeners for robust scaling
        if (window.ResizeObserver && this.canvas && this.canvas.parentElement) {
            this.resizeObserver = new ResizeObserver(() => this.resize());
            this.resizeObserver.observe(this.canvas.parentElement);
        } else {
            window.addEventListener('resize', () => this.resize());
            window.addEventListener('orientationchange', () => this.resize());
        }
    }

    resize() {
        if (!this.canvas) this.canvas = document.getElementById('skeletonCanvas');
        if (!this.canvas) return;
        if (!this.video) this.video = document.getElementById('webcam');

        const rect = this.canvas.getBoundingClientRect();
        const cw = rect.width || this.canvas.parentElement?.clientWidth || window.innerWidth;
        const ch = rect.height || this.canvas.parentElement?.clientHeight || window.innerHeight;

        this.dpr = window.devicePixelRatio || 1;
        this.cssWidth = cw;
        this.cssHeight = ch;

        // Synchronize internal drawing resolution with devicePixelRatio for crisp rendering
        this.canvas.width = Math.round(cw * this.dpr);
        this.canvas.height = Math.round(ch * this.dpr);

        this.ctx = this.canvas.getContext('2d');
        if (this.ctx) {
            if (typeof this.ctx.resetTransform === 'function') {
                this.ctx.resetTransform();
            } else {
                this.ctx.setTransform(1, 0, 0, 1, 0, 0);
            }
            this.ctx.scale(this.dpr, this.dpr);
        }
    }

    clear() {
        if (!this.ctx || !this.canvas) return;
        this.ctx.clearRect(0, 0, this.cssWidth || this.canvas.width, this.cssHeight || this.canvas.height);
    }

    /**
     * Map normalized keypoints (0.0 to 1.0) from backend video resolution (e.g. 640x480)
     * to displayed viewport canvas space using exact object-fit: cover scaling & crop offsets.
     */
    getMappedPoint(kp) {
        if (!kp) return null;
        if (!this.video) this.video = document.getElementById('webcam');

        const vw = (this.video && this.video.videoWidth) ? this.video.videoWidth : 640;
        const vh = (this.video && this.video.videoHeight) ? this.video.videoHeight : 480;
        const cw = this.cssWidth || 320;
        const ch = this.cssHeight || 480;

        // Calculate object-fit: cover scale factor
        const sw = cw / vw;
        const sh = ch / vh;
        const s = Math.max(sw, sh);

        // Rendered dimensions & crop offsets
        const rw = vw * s;
        const rh = vh * s;
        const ox = (cw - rw) / 2;
        const oy = (ch - rh) / 2;

        // Keypoint in video pixel space
        const px = kp.x * vw;
        const py = kp.y * vh;

        // Keypoint in unmirrored viewport CSS space
        const unmirroredX = ox + (px * s);
        const unmirroredY = oy + (py * s);

        // Video element uses CSS scaleX(-1) mirror transform, so mirror horizontal X coordinate
        const canvasX = cw - unmirroredX;
        const canvasY = unmirroredY;

        return { x: canvasX, y: canvasY };
    }

    draw(keypoints) {
        if (!this.canvas) this.canvas = document.getElementById('skeletonCanvas');
        if (!this.canvas) return;
        if (!this.ctx) this.ctx = this.canvas.getContext('2d');

        const rect = this.canvas.getBoundingClientRect();
        if (Math.abs((this.cssWidth || 0) - rect.width) > 2 || Math.abs((this.cssHeight || 0) - rect.height) > 2) {
            this.resize();
        }

        this.clear();
        if (!keypoints || keypoints.length === 0) return;

        const connections = [
            [5, 7], [7, 9],   // Left arm
            [6, 8], [8, 10],  // Right arm
            [5, 6],           // Shoulders
            [5, 11], [6, 12], // Torso
            [11, 12],         // Hips
            [11, 13], [13, 15], // Left leg
            [12, 14], [14, 16]  // Right leg
        ];

        // Draw bone connections
        this.ctx.beginPath();
        this.ctx.strokeStyle = '#7edb7f';
        this.ctx.lineWidth = 3;
        this.ctx.lineCap = 'round';
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = 'rgba(126, 219, 127, 0.9)';

        connections.forEach(([i, j]) => {
            const kp1 = keypoints[i];
            const kp2 = keypoints[j];
            if (kp1 && kp2 && kp1.conf > 0.2 && kp2.conf > 0.2) {
                const pt1 = this.getMappedPoint(kp1);
                const pt2 = this.getMappedPoint(kp2);
                if (pt1 && pt2) {
                    this.ctx.moveTo(pt1.x, pt1.y);
                    this.ctx.lineTo(pt2.x, pt2.y);
                }
            }
        });
        this.ctx.stroke();

        // Draw joint keypoints
        this.ctx.shadowBlur = 6;
        this.ctx.shadowColor = '#F5FF00';
        this.ctx.fillStyle = '#F5FF00';

        keypoints.forEach((kp, i) => {
            if (kp && kp.conf > 0.2 && i > 4) { // Skip face keypoints
                const pt = this.getMappedPoint(kp);
                if (pt) {
                    this.ctx.beginPath();
                    this.ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
                    this.ctx.fill();
                }
            }
        });
    }
}

const skeleton = new SkeletonDrawer('skeletonCanvas', 'webcam');
window.skeletonDrawer = skeleton;
window.drawSkeleton = (kp) => skeleton.draw(kp);
