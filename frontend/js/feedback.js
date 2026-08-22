class FeedbackManager {
    constructor(pillId, textId) {
        this.pill = document.getElementById(pillId);
        this.text = document.getElementById(textId);
        this.hideTimeout = null;
    }

    show(message, isViolation = false) {
        if (!this.pill || !this.text) return;
        if (!message) {
            this.pill.classList.add('feedback-pill--hidden');
            return;
        }

        this.text.innerText = message.toUpperCase();
        this.pill.classList.remove('feedback-pill--hidden');

        if (isViolation) {
            this.pill.style.background = 'rgba(239, 68, 68, 0.9)';
            this.pill.style.borderColor = 'rgba(239, 68, 68, 1)';
            this.pill.style.color = '#ffffff';
        } else {
            this.pill.style.background = 'rgba(19, 19, 19, 0.85)';
            this.pill.style.borderColor = 'rgba(245, 255, 0, 0.3)';
            this.pill.style.color = '#ffffff';
        }
    }
}

const feedback = new FeedbackManager('feedbackPill', 'feedbackText');
window.showFeedback = (message, isViolation) => feedback.show(message, isViolation);

window.sessionFeedbackLog = [];

window.onPoseDetected = (data) => {
    if (!data) return;

    // 1. Draw Skeleton
    if (window.drawSkeleton && data.keypoints) {
        window.drawSkeleton(data.keypoints);
    }

    // 2. Update Rep Counter
    if (window.updateRepCounter) {
        window.updateRepCounter(data);
    }

    // 3. Feedback & Form Violations Display
    const hasViolations = data.violations && data.violations.length > 0;
    const msg = hasViolations ? data.violations[0] : (data.feedback || `Phase: ${data.phase || 'ACTIVE'}`);

    if (hasViolations && !window.sessionFeedbackLog.includes(data.violations[0])) {
        window.sessionFeedbackLog.push(data.violations[0]);
    }

    feedback.show(msg, hasViolations);
};
