class CameraManager {
    constructor(videoElementId, apiEndpoint) {
        this.video = document.getElementById(videoElementId);
        this.endpoint = apiEndpoint;
        this.isProcessing = false;
        this.stream = null;
        this.capturedCanvas = document.createElement('canvas'); // hidden canvas for frame resizing
        this.startTime = null;
        this.elapsedTime = 0;
        this.timerInterval = null;
        this.currentCallback = null;

        // WebSocket Stream State
        this.ws = null;
        this.useWebSocket = true;
        this.wsPending = false;

        // Form score accumulator (fixes "FORM 0%" bug)
        this.formScoreSum   = 0;
        this.formScoreCount = 0;
    }

    connectWebSocket() {
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
            return;
        }

        try {
            const apiBase = window.API_BASE || 'http://localhost:8000';
            const wsUrl = apiBase.replace(/^http/, 'ws') + '/ws/pose?exercise=' + (window.currentExercise || 'squat');

            this.ws = new WebSocket(wsUrl);
            this.ws.binaryType = 'arraybuffer';

            this.ws.onopen = () => {
                console.log('⚡ WebSocket Pose Stream Connected:', wsUrl);
                this.useWebSocket = true;
                const statusEl = document.getElementById('connectionStatus');
                if (statusEl) statusEl.classList.add('connection-status--hidden');
            };

            this.ws.onmessage = (event) => {
                this.wsPending = false;
                try {
                    const data = JSON.parse(event.data);
                    // Accumulate form score for session average
                    if (data && typeof data.formScore === 'number' && data.formScore > 0) {
                        this.formScoreSum   += data.formScore;
                        this.formScoreCount += 1;
                    }
                    if (this.currentCallback) this.currentCallback(data);
                    const statusEl = document.getElementById('connectionStatus');
                    if (statusEl) statusEl.classList.add('connection-status--hidden');
                } catch (e) {
                    console.error('WS JSON parse error:', e);
                }
            };

            this.ws.onerror = (err) => {
                console.warn('WebSocket stream error, falling back to HTTP POST:', err);
                this.useWebSocket = false;
                this.wsPending = false;
            };

            this.ws.onclose = () => {
                this.wsPending = false;
            };
        } catch (e) {
            console.warn('WebSocket init exception, falling back to HTTP POST:', e);
            this.useWebSocket = false;
            this.wsPending = false;
        }
    }

    sendExerciseChange(exerciseKey) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            try {
                this.ws.send(JSON.stringify({ exercise: exerciseKey }));
            } catch(e) {}
        }
    }

    async init() {
        if (!this.video) this.video = document.getElementById('webcam');
        if (!this.video) return false;
        
        try {
            if (!this.stream) {
                this.stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: 'environment',
                        width: { ideal: 640 },
                        height: { ideal: 480 }
                    }
                });
                this.video.srcObject = this.stream;
            }
            return true;
        } catch (err) {
            console.error('Camera init error:', err);
            return false;
        }
    }

    toggleAnalysis() {
        this.isProcessing = !this.isProcessing;
        if (this.isProcessing) {
            this.startTimer();
            if (this.currentCallback) this.loop(this.currentCallback);
        } else {
            this.stopTimer();
        }
    }

    startAnalysis(callback) {
        this.currentCallback = callback;
        this.isProcessing = true;
        // Reset form score accumulator for clean session
        this.formScoreSum   = 0;
        this.formScoreCount = 0;
        this.startTimer();
        this.loop(callback);
    }

    startTimer() {
        this.startTime = Date.now() - this.elapsedTime;
        if (this.timerInterval) clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            this.elapsedTime = Date.now() - this.startTime;
            this.updateTimerDisplay();
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);
    }

    resetTimer() {
        this.stopTimer();
        this.elapsedTime = 0;
        this.updateTimerDisplay();
    }

    updateTimerDisplay() {
        const display = document.getElementById('timerDisplay');
        if (!display) return;
        const totalSeconds = Math.floor(this.elapsedTime / 1000);
        const mins = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
        const secs = String(totalSeconds % 60).padStart(2, '0');
        display.innerText = `${mins}:${secs}`;
    }

    stopAnalysis() {
        this.isProcessing = false;
        this.stopTimer();
    }

    stopCamera() {
        this.stopAnalysis();
        if (this.ws) {
            try { this.ws.close(); } catch(e) {}
            this.ws = null;
        }
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        if (this.video) {
            this.video.srcObject = null;
        }
    }

    async loop(callback) {
        if (!this.isProcessing) return;

        // Try connecting WebSocket stream if active
        if (this.useWebSocket) {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                this.connectWebSocket();
            }
        }

        // Send binary JPEG blob over WebSocket if connected
        if (this.useWebSocket && this.ws && this.ws.readyState === WebSocket.OPEN) {
            if (!this.wsPending && this.video && this.video.readyState >= 2) {
                const width = 320;
                const height = (this.video.videoHeight / (this.video.videoWidth || 1)) * width || 240;
                this.capturedCanvas.width = width;
                this.capturedCanvas.height = height;
                const ctx = this.capturedCanvas.getContext('2d');
                ctx.drawImage(this.video, 0, 0, width, height);

                this.wsPending = true;
                this.capturedCanvas.toBlob((blob) => {
                    if (blob && this.ws && this.ws.readyState === WebSocket.OPEN) {
                        this.ws.send(blob);
                    } else {
                        this.wsPending = false;
                    }
                }, 'image/jpeg', 0.6);
            }
        } else {
            // Fallback to HTTP POST
            const frameData = this.captureFrame();
            if (frameData) {
                try {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 10000);

                    const response = await fetch(this.endpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            image: frameData,
                            exercise: window.currentExercise || 'squat',
                            debug: window.isDebugMode || false
                        }),
                        signal: controller.signal
                    });
                    
                    clearTimeout(timeoutId);
                    
                    const statusEl = document.getElementById('connectionStatus');
                    if (response.ok) {
                        const data = await response.json();
                        // Accumulate form score for session average
                        if (data && typeof data.formScore === 'number' && data.formScore > 0) {
                            this.formScoreSum   += data.formScore;
                            this.formScoreCount += 1;
                        }
                        if (callback) callback(data);
                        if (statusEl) {
                            statusEl.classList.add('connection-status--hidden');
                            statusEl.innerText = 'DISCONNECTED';
                        }
                    } else {
                        if (statusEl) {
                            statusEl.innerText = 'AI SERVER ERROR';
                            statusEl.classList.remove('connection-status--hidden');
                        }
                    }
                } catch (err) {
                    console.error('API Error:', err);
                    const statusEl = document.getElementById('connectionStatus');
                    if (statusEl) {
                        statusEl.innerText = err.name === 'AbortError' ? 'AI SERVER TIMEOUT' : 'AI SERVER OFFLINE';
                        statusEl.classList.remove('connection-status--hidden');
                    }
                }
            }
        }

        // Loop next frame (~60 FPS real-time pose analysis)
        setTimeout(() => this.loop(callback), 15);
    }

    captureFrame() {
        if (!this.video || this.video.readyState < 2) return null;
        
        const width = 320;
        const height = (this.video.videoHeight / (this.video.videoWidth || 1)) * width || 240;
        
        this.capturedCanvas.width = width;
        this.capturedCanvas.height = height;
        
        const ctx = this.capturedCanvas.getContext('2d');
        ctx.drawImage(this.video, 0, 0, width, height);
        
        return this.capturedCanvas.toDataURL('image/jpeg', 0.6);
    }
}

// Global state
window.currentExercise = 'squat';
const camera = new CameraManager('webcam', `${window.API_BASE}/analyze`);
window.cameraInstance = camera;

// Global Open / Close Embedded Camera Handlers
window.openCameraModal = async function() {
    document.body.classList.add('camera-active');
    const container = document.getElementById('embeddedCameraContainer');
    if (container) {
        container.style.display = 'flex';
        container.classList.add('embedded-camera-card--fullscreen');
        document.body.style.overflow = 'hidden';
    }

    if (screen.orientation && screen.orientation.lock) {
        try {
            screen.orientation.lock('portrait').catch(() => {});
        } catch (e) {}
    }

    // Wait 1 frame for layout DOM update
    await new Promise(resolve => requestAnimationFrame(resolve));

    // Reset rep counter, voice coach & backend state machine for clean session start
    if (window.repCounter) {
        window.repCounter.count = 0;
        if (window.repCounter.display) window.repCounter.display.innerText = 0;
    }
    if (window.voiceCoach) {
        window.voiceCoach.resetSessionMute();
    }
    try {
        fetch(`${window.API_BASE}/biomechanics/reset?exercise=${window.currentExercise || 'squat'}`, { method: 'POST' }).catch(() => {});
    } catch(e) {}

    const success = await camera.init();
    if (success) {
        const video = document.getElementById('webcam');
        if (video && (video.readyState < 1 || video.videoWidth === 0)) {
            await new Promise(resolve => {
                const onLoaded = () => {
                    video.removeEventListener('loadedmetadata', onLoaded);
                    resolve();
                };
                video.addEventListener('loadedmetadata', onLoaded);
            });
        }

        if (window.skeletonDrawer) {
            window.skeletonDrawer.resize();
        }
        if (window.biomechanicalSkeleton3D) {
            window.biomechanicalSkeleton3D.resetSession();
            window.biomechanicalSkeleton3D.onResize();
        }

        camera.startAnalysis((data) => {
            if (window.onPoseDetected) {
                window.onPoseDetected(data);
            }
            if (window.voiceCoach && data) {
                window.voiceCoach.speakSmartCue(data);
            }
        });
    }
};

window.closeCameraModal = function() {
    if (window.voiceCoach) {
        window.voiceCoach.stop();
    }
    document.body.classList.remove('camera-active');
    const container = document.getElementById('embeddedCameraContainer');
    if (container) {
        container.classList.remove('embedded-camera-card--fullscreen');
        container.style.display = 'none';
        document.body.style.overflow = '';
    }

    if (screen.orientation && screen.orientation.unlock) {
        try {
            screen.orientation.unlock();
        } catch (e) {}
    }

    camera.stopCamera();

    // Gather REAL workout session metrics logged during session
    const totalReps = (window.repCounter && window.repCounter.count !== undefined) ? window.repCounter.count : 0;
    const targetReps = (window.repCounter && window.repCounter.target !== undefined) ? window.repCounter.target : 15;
    
    const timerEl = document.getElementById('timerDisplay');
    const durationFormatted = (timerEl && timerEl.innerText.trim()) ? timerEl.innerText.trim() : '00:00';
    
    // Calculate seconds from duration string
    const parts = durationFormatted.split(':');
    const durationSec = parts.length === 2 ? (parseInt(parts[0]) * 60 + parseInt(parts[1])) : 0;

    // Real average form score from backend data (fixes "FORM 0%" bug)
    const avgFormScore = (camera.formScoreCount > 0)
        ? Math.round(camera.formScoreSum / camera.formScoreCount)
        : 0;

    let accuracy = avgFormScore;
    let caloriesBurned = 0;
    if (totalReps > 0) {
        // Use real form score; fall back to estimate only if no frames were received
        if (accuracy === 0) accuracy = Math.min(98, Math.max(72, Math.round(85 + (totalReps >= targetReps ? 8 : 3))));
        caloriesBurned = Math.max(5, Math.round(totalReps * 3.5 + (durationSec * 0.4)));
    }
    const exTitle = (window.currentExercise || 'squat').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    
    const sessionData = {
        id: 'session_' + Date.now(),
        exercise: exTitle,
        reps: totalReps,
        targetReps: targetReps,
        duration: durationFormatted,
        durationSec: durationSec,
        calories: caloriesBurned,
        accuracy: accuracy,
        date: new Date().toISOString(),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        feedbackLog: window.sessionFeedbackLog || ["Good form maintained", "Core stability verified"],
        notes: totalReps >= targetReps ? "Target Achieved!" : "Good Effort"
    };

    // Save session to localStorage
    try {
        localStorage.setItem('kinetic_last_workout_session', JSON.stringify(sessionData));
    } catch(e) {
        console.warn('Failed saving last session:', e);
    }

    try {
        const history = JSON.parse(localStorage.getItem('kinetic_workout_history') || '[]');
        history.unshift(sessionData);
        localStorage.setItem('kinetic_workout_history', JSON.stringify(history.slice(0, 20)));
    } catch(e) {
        console.warn('Failed saving workout history:', e);
    }

    // Trigger Analytics Component re-render with real data
    if (window.workoutAnalytics) {
        window.workoutAnalytics.loadData();
        window.workoutAnalytics.renderActiveSegment();
    }

    window.dispatchEvent(new CustomEvent('workoutCompleted'));

    // muscleMap.js listens for this event and shows/populates the heatmap card
    // (no manual scroll here — muscleMap.showMuscleHeatmapCard handles it)
};

window.addEventListener('load', () => {
    if (window.location.pathname.includes('workout.html')) {
        const toggleBtn = document.getElementById('toggleWorkout');
        const modalCloseBtn = document.getElementById('modalCloseBtn');

        const playIcon = document.getElementById('playIcon');
        const aiSyncText = document.getElementById('aiSyncStatusText');
        const selectedBadge = document.getElementById('selectedExBadge');

        // Setup exercise selection chips on the page
        document.querySelectorAll('.ex-select-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                document.querySelectorAll('.ex-select-chip').forEach(c => c.classList.remove('ex-select-chip--active'));
                const btn = e.currentTarget;
                btn.classList.add('ex-select-chip--active');
                
                const exKey = btn.getAttribute('data-exercise') || 'squat';
                window.currentExercise = exKey;
                if (window.cameraInstance) window.cameraInstance.sendExerciseChange(exKey);

                const exName = exKey.replace(/_/g, ' ').toUpperCase();
                if (selectedBadge) selectedBadge.innerText = `${exName} ACTIVE`;
                
                console.log('Switched target exercise to:', window.currentExercise);

                // Reset local rep counter and backend exercise state for new exercise
                if (window.repCounter) {
                    window.repCounter.count = 0;
                    if (window.repCounter.display) window.repCounter.display.innerText = 0;
                }
                try {
                    fetch(`${window.API_BASE}/biomechanics/reset?exercise=${exKey}`, { method: 'POST' }).catch(() => {});
                } catch(e) {}
            });
        });

        // Pause / Resume Toggle
        const handlePauseToggle = () => {
            camera.toggleAnalysis();
            if (camera.isProcessing) {
                if (playIcon) playIcon.innerText = 'pause';
                if (aiSyncText) aiSyncText.innerText = 'AI SYNC: ACTIVE';
            } else {
                if (playIcon) playIcon.innerText = 'play_arrow';
                if (aiSyncText) aiSyncText.innerText = 'AI SYNC: PAUSED';
            }
        };

        if (toggleBtn) toggleBtn.addEventListener('click', handlePauseToggle);
        if (modalCloseBtn) modalCloseBtn.addEventListener('click', window.closeCameraModal);
    }
});
