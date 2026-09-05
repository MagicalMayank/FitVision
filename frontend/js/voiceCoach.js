/**
 * FitVision Voice Coach Engine (js/voiceCoach.js)
 * Native browser SpeechSynthesis API wrapper for real-time workout cues,
 * bilingual voice cue library integration, smart target recommendations,
 * repeated mistake back-to-basics alerts, and post-session dashboard AI insight read-aloud.
 */

class VoiceCoach {
    constructor() {
        this.isSupported = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
        this.lastSpoken = '';
        this.lastSpokenTime = 0;
        this.cooldownMs = 3000; // Minimum 3-second cooldown between utterances
        this.isMuted = false;   // In-memory mute state (resets to unmuted each session)
        this.voices = [];
        this.currentInsightUtterance = null;

        // Smart Cue & Violation Tracking State
        this.lastCueIndex = {};
        this.sessionViolationCounts = {};
        this.triggeredRepeatedMistakes = new Set();
        this.hasTriggeredTargetAdjustment = false;
        this.effortFrameCount = 0;

        if (this.isSupported) {
            this.initVoices();
            if (window.speechSynthesis.onvoiceschanged !== undefined) {
                window.speechSynthesis.onvoiceschanged = () => this.initVoices();
            }
        } else {
            console.warn('SpeechSynthesis API is not supported in this browser.');
        }
    }

    initVoices() {
        if (!this.isSupported) return;
        this.voices = window.speechSynthesis.getVoices();
    }

    getLangPref() {
        return localStorage.getItem('fitvision_voice_lang') || 'en';
    }

    setLangPref(langVal) {
        if (langVal === 'en' || langVal === 'hi') {
            localStorage.setItem('fitvision_voice_lang', langVal);
            this.updateLangToggleUI(langVal);
        }
    }

    getVoiceForLang(langVal) {
        if (!this.voices || this.voices.length === 0) {
            this.initVoices();
        }

        const targetLang = langVal === 'hi' ? 'hi' : 'en';
        
        let match = this.voices.find(v => {
            const l = v.lang.toLowerCase();
            return targetLang === 'hi' ? (l.includes('hi') || l.includes('hindi')) : (l.includes('en-us') || l.includes('en-in') || l.includes('en-gb'));
        });

        if (!match) {
            match = this.voices.find(v => v.lang.toLowerCase().startsWith(targetLang));
        }

        return match || null;
    }

    pickCue(cuesArray, categoryKey) {
        if (!cuesArray || cuesArray.length === 0) return null;
        if (cuesArray.length === 1) return cuesArray[0];

        const lastIdx = this.lastCueIndex[categoryKey];
        let newIdx;
        let attempts = 0;
        do {
            newIdx = Math.floor(Math.random() * cuesArray.length);
            attempts++;
        } while (newIdx === lastIdx && attempts < 10);

        this.lastCueIndex[categoryKey] = newIdx;
        return cuesArray[newIdx];
    }

    /**
     * Speaks live workout cues with rate limiting and deduplication.
     */
    speak(text, overrideLang, bypassDeduplication = false) {
        if (!this.isSupported || this.isMuted || !text) return;

        const cleanText = text.trim();
        if (!cleanText) return;

        const now = Date.now();

        if (!bypassDeduplication && cleanText.toLowerCase() === this.lastSpoken.toLowerCase()) {
            return;
        }

        if (!bypassDeduplication && (now - this.lastSpokenTime < this.cooldownMs)) {
            return;
        }

        this.lastSpoken = cleanText;
        this.lastSpokenTime = now;

        const langPref = overrideLang || this.getLangPref();
        this._executeSpeech(cleanText, langPref);
    }

    /**
     * PART 2 & PART 4: Smart Exercise Cue Selector & Repeated Mistake Trigger
     */
    speakSmartCue(data) {
        if (!this.isSupported || this.isMuted || !data) return;

        const lang = this.getLangPref();
        const rawEx = data.exercise || window.currentExercise || 'squat';
        const exKey = rawEx.toLowerCase().replace(/[\s-]/g, '_');
        const phase = (data.phase || data.state || '').toUpperCase();

        // ---------------------------------------------------------
        // PART 4: Repeated-mistake detection (5+ in session)
        // ---------------------------------------------------------
        if (data.violations && Array.isArray(data.violations) && data.violations.length > 0) {
            for (const v of data.violations) {
                const cleanDesc = v.replace(/^Technique correction:\s*/i, '').trim();
                const currentCount = (this.sessionViolationCounts[cleanDesc] || 0) + 1;
                this.sessionViolationCounts[cleanDesc] = currentCount;

                if (currentCount >= 5 && !this.triggeredRepeatedMistakes.has(cleanDesc)) {
                    this.triggeredRepeatedMistakes.add(cleanDesc);

                    const templateList = window.GENERIC_CUES && window.GENERIC_CUES.repeated_mistake ? window.GENERIC_CUES.repeated_mistake[lang] : null;
                    if (templateList) {
                        const template = this.pickCue(templateList, 'repeated_mistake_' + lang);
                        const cueText = template.replace('{violation_description}', cleanDesc.toLowerCase());
                        this.speak(cueText, lang, true);
                    }

                    // If exercise is squat, re-surface instructions bottom sheet & pause camera
                    if (exKey.includes('squat')) {
                        const sheet = document.getElementById('squatInstructionsSheet');
                        if (sheet) {
                            sheet.style.display = 'flex';
                            if (window.cameraInstance && window.cameraInstance.isProcessing) {
                                window.cameraInstance.toggleAnalysis();
                                const playIcon = document.getElementById('playIcon');
                                const aiSyncText = document.getElementById('aiSyncStatusText');
                                if (playIcon) playIcon.innerText = 'play_arrow';
                                if (aiSyncText) aiSyncText.innerText = 'AI SYNC: PAUSED';
                            }
                        }
                    }
                    return; // Avoid overlaying achievement cue in same frame
                }
            }
        }

        // ---------------------------------------------------------
        // PART 2: Bilingual Exercise Cue Selection (Achievement vs Effort)
        // ---------------------------------------------------------
        const cueLib = window.VOICE_CUES ? window.VOICE_CUES[exKey] : null;
        if (!cueLib) {
            if (data.feedback) this.speak(data.feedback);
            return;
        }

        let isAchievement = false;
        let isEffort = false;

        if (phase === 'BOTTOM' && ['squat', 'pushup', 'lunge'].includes(exKey)) isAchievement = true;
        else if ((phase === 'TOP' || phase === 'PEAK') && ['glute_bridge', 'shoulder_press', 'bicep_curl', 'calf_raise'].includes(exKey)) isAchievement = true;
        else if (phase === 'OPEN' && exKey === 'jumping_jack') isAchievement = true;
        else if ((phase === 'HOLD' || phase === 'ACTIVE') && exKey === 'plank') isAchievement = true;
        else if (phase.includes('KNEE_DRIVE') && exKey === 'mountain_climber') isAchievement = true;
        else if (phase === 'DESCENDING' || phase === 'DOWN' || phase === 'CLOSED') isEffort = true;

        if (isAchievement) {
            const arr = cueLib.achievement[lang];
            const cue = this.pickCue(arr, exKey + '_achievement_' + lang);
            if (cue) this.speak(cue, lang);
        } else if (isEffort) {
            this.effortFrameCount++;
            if (this.effortFrameCount % 3 === 0) {
                const arr = cueLib.effort[lang];
                const cue = this.pickCue(arr, exKey + '_effort_' + lang);
                if (cue) this.speak(cue, lang);
            }
        } else if (data.feedback) {
            this.speak(data.feedback);
        }
    }

    /**
     * PART 3: Smart target-adjustment recommendation.
     * Computes rolling average of COMPLETED reps across user's last 5 sessions
     * from localStorage item 'kinetic_workout_history'.
     */
    checkTargetAdjustment(newTarget, exercise) {
        if (this.hasTriggeredTargetAdjustment || !newTarget) return;

        const exName = exercise || window.currentExercise || 'squat';
        let history = [];
        try {
            const raw = localStorage.getItem('kinetic_workout_history');
            if (raw) history = JSON.parse(raw);
        } catch (e) {
            return;
        }

        const relevantSessions = history.filter(s => {
            const sEx = (s.exercise || s.exerciseName || '').toLowerCase();
            return sEx.includes(exName.toLowerCase()) && typeof s.reps === 'number' && s.reps > 0;
        }).slice(-5);

        if (relevantSessions.length < 3) return;

        const totalReps = relevantSessions.reduce((acc, s) => acc + s.reps, 0);
        const rollingAvg = totalReps / relevantSessions.length;

        if (newTarget > rollingAvg * 1.5) {
            this.hasTriggeredTargetAdjustment = true;
            const suggestedTarget = Math.round(rollingAvg * 1.2);
            const lang = this.getLangPref();

            const templateList = window.GENERIC_CUES && window.GENERIC_CUES.target_adjustment ? window.GENERIC_CUES.target_adjustment[lang] : null;
            if (templateList) {
                const template = this.pickCue(templateList, 'target_adj_' + lang);
                const cueText = template.replace('{target}', newTarget).replace('{suggested_target}', suggestedTarget);
                this.speak(cueText, lang, true);
            }
        }
    }

    /**
     * Read-aloud for Dashboard AI Insight card.
     */
    speakInsight(text, onEndCallback) {
        if (!this.isSupported || !text) return;
        
        this.stop();

        const langPref = this.getLangPref();
        const cleanText = text.trim();

        const utterance = new SpeechSynthesisUtterance(cleanText);
        const voice = this.getVoiceForLang(langPref);

        utterance.lang = langPref === 'hi' ? 'hi-IN' : 'en-US';
        if (voice) utterance.voice = voice;
        utterance.rate = 0.95;

        utterance.onend = () => {
            this.currentInsightUtterance = null;
            if (onEndCallback) onEndCallback();
        };

        utterance.onerror = () => {
            this.currentInsightUtterance = null;
            if (onEndCallback) onEndCallback();
        };

        this.currentInsightUtterance = utterance;
        window.speechSynthesis.speak(utterance);
    }

    isSpeakingInsight() {
        return this.isSupported && window.speechSynthesis.speaking && this.currentInsightUtterance !== null;
    }

    _executeSpeech(text, langPref) {
        try {
            window.speechSynthesis.cancel();

            const utterance = new SpeechSynthesisUtterance(text);
            const voice = this.getVoiceForLang(langPref);

            utterance.lang = langPref === 'hi' ? 'hi-IN' : 'en-US';
            if (voice) utterance.voice = voice;
            utterance.rate = 1.0;

            window.speechSynthesis.speak(utterance);
        } catch (e) {
            console.warn('VoiceCoach speech execution failed:', e);
        }
    }

    stop() {
        if (this.isSupported) {
            window.speechSynthesis.cancel();
            this.currentInsightUtterance = null;
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        this.updateMuteUI();
    }

    setMute(muted) {
        this.isMuted = muted;
        if (this.isMuted) {
            this.stop();
        }
        this.updateMuteUI();
    }

    resetSessionMute() {
        this.isMuted = false;
        this.lastSpoken = '';
        this.lastSpokenTime = 0;
        this.sessionViolationCounts = {};
        this.triggeredRepeatedMistakes.clear();
        this.hasTriggeredTargetAdjustment = false;
        this.effortFrameCount = 0;
        this.updateMuteUI();
    }

    updateMuteUI() {
        const icon = document.getElementById('voiceMuteIcon');
        const btn = document.getElementById('btnVoiceMute');
        if (icon) {
            icon.innerText = this.isMuted ? 'volume_off' : 'volume_up';
        }
        if (btn) {
            btn.style.opacity = '1';
            if (this.isMuted) {
                btn.classList.add('nav-circle-btn--muted');
                btn.style.color = '#ff4d4d';
            } else {
                btn.classList.remove('nav-circle-btn--muted');
                btn.style.color = 'var(--primary-fixed)';
            }
        }
    }

    updateLangToggleUI(activeLang) {
        const lang = activeLang || this.getLangPref();
        const enBtn = document.getElementById('voiceLangEnBtn');
        const hiBtn = document.getElementById('voiceLangHiBtn');

        if (enBtn && hiBtn) {
            if (lang === 'en') {
                enBtn.classList.add('voice-lang-btn--active');
                hiBtn.classList.remove('voice-lang-btn--active');
            } else {
                hiBtn.classList.add('voice-lang-btn--active');
                enBtn.classList.remove('voice-lang-btn--active');
            }
        }
    }
}

// Global Singleton Instance
window.voiceCoach = new VoiceCoach();

// Initialize UI state on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.voiceCoach.updateLangToggleUI();
    window.voiceCoach.updateMuteUI();
});
