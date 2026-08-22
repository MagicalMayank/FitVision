// session-summary.js - Dynamic Workout Metrics & Ollama qwen2.5:7b Kinetic AI Coach

window.API_BASE = window.API_BASE || 'http://localhost:8000';
var API_BASE = window.API_BASE;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Load session data from localStorage
    let session = null;
    try {
        const stored = localStorage.getItem('kinetic_last_workout_session');
        if (stored) {
            session = JSON.parse(stored);
        }
    } catch (e) {
        console.warn('Could not parse workout session data from localStorage:', e);
    }

    // Default fallback values if no recent workout recorded yet
    if (!session) {
        session = {
            exercise: 'SQUAT SESSION',
            totalReps: 15,
            targetReps: 15,
            durationFormatted: '02:45',
            accuracyPct: 92,
            caloriesBurned: 98,
            feedbackLog: ['Good squat depth maintained', 'Controlled descent speed']
        };
    }

    // 2. Update DOM elements with real values
    const titleEl = document.getElementById('summary-title');
    const accValEl = document.getElementById('summary-accuracy-val');
    const accLabelEl = document.getElementById('summary-accuracy-label');
    const accCircleEl = document.getElementById('summary-accuracy-circle');
    const durationEl = document.getElementById('summary-duration');
    const repsEl = document.getElementById('summary-reps');
    const caloriesEl = document.getElementById('summary-calories');
    const aiRecTextEl = document.getElementById('ai-rec-text');
    const aiHighlightTextEl = document.getElementById('ai-highlight-text');

    if (titleEl) titleEl.textContent = session.exercise || 'SQUAT SESSION';
    if (durationEl) durationEl.textContent = session.durationFormatted || '00:00';
    if (repsEl) repsEl.textContent = session.totalReps !== undefined ? session.totalReps : '0';
    if (caloriesEl) caloriesEl.textContent = `${session.caloriesBurned || 0} kcal`;

    const accuracy = session.accuracyPct || 90;
    if (accValEl) accValEl.textContent = `${accuracy}%`;

    if (accLabelEl) {
        if (accuracy >= 90) {
            accLabelEl.textContent = 'Elite Form Precision';
            accLabelEl.style.color = 'var(--secondary)';
        } else if (accuracy >= 80) {
            accLabelEl.textContent = 'Optimal Mechanical Output';
            accLabelEl.style.color = 'var(--primary-fixed)';
        } else {
            accLabelEl.textContent = 'Form Adjustment Needed';
            accLabelEl.style.color = 'var(--error)';
        }
    }

    // Animate SVG Gauge
    if (accCircleEl) {
        const circumference = 283;
        const offset = circumference - (accuracy / 100) * circumference;
        accCircleEl.style.strokeDashoffset = offset;
    }

    // 3. Fetch real AI insight from local Ollama (qwen2.5:7b)
    if (aiRecTextEl || aiHighlightTextEl) {
        if (aiRecTextEl) aiRecTextEl.innerHTML = '<span style="opacity:0.6;">Consulting Kinetic AI...</span>';
        if (aiHighlightTextEl) aiHighlightTextEl.innerHTML = '<span style="opacity:0.6;">Analyzing performance metrics...</span>';

        try {
            const response = await fetch(`${API_BASE}/workout/ai-insight`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    exercise: session.exercise,
                    total_reps: session.totalReps,
                    target_reps: session.targetReps || 15,
                    duration_formatted: session.durationFormatted,
                    accuracy_pct: accuracy,
                    calories_burned: session.caloriesBurned || 98,
                    feedback_log: session.feedbackLog || []
                })
            });

            if (response.ok) {
                const data = await response.json();
                parseAndRenderAIInsight(data.insight, aiRecTextEl, aiHighlightTextEl);
            } else {
                throw new Error(`AI status code: ${response.status}`);
            }
        } catch (err) {
            console.warn('Ollama AI insight fetch failed, using fallback rule engine:', err);
            renderDefaultInsights(session, aiRecTextEl, aiHighlightTextEl);
        }
    }
});

function parseAndRenderAIInsight(text, recEl, highlightEl) {
    if (!text) return;

    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    let rec = '';
    let highlight = '';

    lines.forEach(line => {
        const lower = line.toLowerCase();
        if (lower.includes('recommend') || lower.startsWith('1.') || lower.includes('descent') || lower.includes('tempo')) {
            rec += (rec ? ' ' : '') + line.replace(/^(1\.|RECOMMENDATION:)/i, '').trim();
        } else if (lower.includes('highlight') || lower.includes('record') || lower.startsWith('2.') || lower.includes('precision')) {
            highlight += (highlight ? ' ' : '') + line.replace(/^(2\.|HIGHLIGHT:)/i, '').trim();
        }
    });

    if (recEl && rec) recEl.textContent = rec;
    else if (recEl && lines[0]) recEl.textContent = lines[0].replace(/^(1\.|RECOMMENDATION:)/i, '').trim();

    if (highlightEl && highlight) highlightEl.textContent = highlight;
    else if (highlightEl && lines[1]) highlightEl.textContent = lines[1].replace(/^(2\.|HIGHLIGHT:)/i, '').trim();
}

function renderDefaultInsights(session, recEl, highlightEl) {
    if (recEl) {
        recEl.textContent = session.accuracyPct >= 90 ?
            'Eccentric phase control is excellent. Keep a 3-second descent tempo on future sets.' :
            'Focus on stabilizing knees at bottom depth to avoid micro-valgus shifts.';
    }
    if (highlightEl) {
        highlightEl.textContent = `Completed ${session.totalReps} repetitions in ${session.durationFormatted} with ${session.accuracyPct}% form accuracy rating.`;
    }
}
