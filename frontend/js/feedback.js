class FeedbackManager {
    constructor(pillId, textId) {
        this.pill = document.getElementById(pillId);
        this.text = document.getElementById(textId);
    }

    show(message, isViolation = false) {
        if (!this.pill) this.pill = document.getElementById('feedbackPill');
        if (!this.text) this.text = document.getElementById('feedbackText');
        if (!this.pill || !this.text) return;

        if (!message) {
            this.pill.classList.add('feedback-pill--hidden');
            return;
        }

        this.text.innerText = message.toUpperCase();
        this.pill.classList.remove('feedback-pill--hidden');

        if (isViolation) {
            this.pill.style.background = '#ff4d4d';
            this.pill.style.color = '#ffffff';
            this.pill.style.boxShadow = '0 0 35px rgba(255, 77, 77, 0.7)';
        } else {
            this.pill.style.background = '#F5FF00';
            this.pill.style.color = '#131313';
            this.pill.style.boxShadow = '0 0 35px rgba(245, 255, 0, 0.6)';
        }
    }
}

const feedback = new FeedbackManager('feedbackPill', 'feedbackText');
window.showFeedback = (message, isViolation) => feedback.show(message, isViolation);

window.sessionFeedbackLog = [];

window.onPoseDetected = (data) => {
    if (!data) return;

    // 1. Draw Skeleton on Canvas
    if (window.drawSkeleton && data.keypoints) {
        window.drawSkeleton(data.keypoints);
    }

    // 2. Update Rep Counter
    if (window.updateRepCounter) {
        window.updateRepCounter(data);
    }

    // 3. Form Accuracy Score
    const accuracyText = document.getElementById('hudAccuracyText');
    if (accuracyText && data.formScore !== undefined) {
        accuracyText.innerText = `${Math.round(data.formScore)}%`;
    }

    // 4. Feedback & Form Violations Display
    const hasViolations = data.violations && data.violations.length > 0;
    const msg = hasViolations ? data.violations[0] : (data.feedback || `Phase: ${data.phase || 'ACTIVE'}`);

    if (hasViolations && !window.sessionFeedbackLog.includes(data.violations[0])) {
        window.sessionFeedbackLog.push(data.violations[0]);
    }

    feedback.show(msg, hasViolations);

    // 5. Trigger Voice Coach Cue
    if (window.voiceCoach && data) {
        window.voiceCoach.speakSmartCue(data);
    }

    // 6. Update Real-Time 3D Biomechanical Skeleton Engine
    if (window.biomechanicalSkeleton3D) {
        window.biomechanicalSkeleton3D.updatePose(data, true);
    }
};
