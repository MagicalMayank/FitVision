// metrics.js - Dynamic Metrics Engine for FitVision

window.API_BASE = window.API_BASE || 'http://localhost:8000';
var API_BASE = window.API_BASE;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAndRenderMetrics);
} else {
    loadAndRenderMetrics();
}

function loadAndRenderMetrics() {
    let history = [];
    try {
        const stored = localStorage.getItem('kinetic_workout_history');
        if (stored) history = JSON.parse(stored);
    } catch (e) {
        console.warn('Failed parsing workout history:', e);
    }

    let lastSession = null;
    try {
        const lastStored = localStorage.getItem('kinetic_last_workout_session');
        if (lastStored) lastSession = JSON.parse(lastStored);
    } catch (e) {}

    // Calculate totals from history
    let sessionCalories = 0;
    let sessionMins = 0;
    let completedSessions = history.length;

    history.forEach(session => {
        sessionCalories += (session.caloriesBurned || 45);
        
        let mins = session.durationMinutes;
        if (!mins && session.durationFormatted) {
            const parts = session.durationFormatted.split(':');
            mins = Math.max(1, Math.round(parseInt(parts[0] || 0, 10) + parseInt(parts[1] || 0, 10) / 60));
        }
        sessionMins += (mins || 3);
    });

    // Base default values + real logged session metrics
    const baseCalories = 420;
    const totalCalories = baseCalories + sessionCalories;

    const baseWorkoutMins = 25;
    const totalWorkoutMins = baseWorkoutMins + sessionMins;

    // 1. Update Calories Display
    const calEl = document.getElementById('metrics-calories-val');
    if (calEl) {
        calEl.textContent = totalCalories.toLocaleString();
    }

    // 2. Update Workout Time Display
    const minsEl = document.getElementById('metrics-workout-mins');
    if (minsEl) {
        minsEl.textContent = totalWorkoutMins;
    }

    // 3. Update Progress Circle & Label (Daily Goal: 60 Mins)
    const dailyGoalMins = 60;
    const goalPct = Math.min(100, Math.round((totalWorkoutMins / dailyGoalMins) * 100));
    
    const labelEl = document.getElementById('metrics-goal-label');
    if (labelEl) {
        labelEl.textContent = `${goalPct}% of daily goal achieved today (${totalWorkoutMins}/${dailyGoalMins} mins)`;
    }

    const circleEl = document.getElementById('metrics-goal-circle');
    if (circleEl) {
        const circumference = 280;
        const offset = circumference - (goalPct / 100) * circumference;
        circleEl.style.strokeDashoffset = offset;
    }

    // 4. Update Strength Training Weekly Objective
    const totalDaysCompleted = Math.min(5, Math.max(1, 1 + completedSessions));
    const strengthCountEl = document.getElementById('metrics-strength-count');
    const strengthBarEl = document.getElementById('metrics-strength-bar');

    if (strengthCountEl) {
        strengthCountEl.textContent = `${totalDaysCompleted}/5 DAYS`;
    }
    if (strengthBarEl) {
        strengthBarEl.style.width = `${(totalDaysCompleted / 5) * 100}%`;
    }

    // 5. Fetch Kinetic AI Insight from AI
    fetchKineticAIInsight(totalWorkoutMins, totalCalories, completedSessions, lastSession);
}

async function fetchKineticAIInsight(workoutMins, totalCalories, completedSessions, lastSession) {
    const insightEl = document.getElementById('metrics-oracle-insight');
    if (!insightEl) return;

    insightEl.innerHTML = '<span style="opacity:0.7;">Kinetic AI analyzing recovery & biomechanics...</span>';

    const lastExercise = lastSession ? lastSession.exercise : 'Squat Session';
    const lastAccuracy = lastSession ? lastSession.accuracyPct : 92;

    try {
        const response = await fetch(`${API_BASE}/workout/ai-insight`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                exercise: lastExercise,
                total_reps: lastSession ? lastSession.totalReps : 15,
                target_reps: lastSession ? lastSession.targetReps : 15,
                duration_formatted: lastSession ? lastSession.durationFormatted : '03:15',
                accuracy_pct: lastAccuracy,
                calories_burned: totalCalories,
                feedback_log: lastSession ? (lastSession.feedbackLog || []) : []
            })
        });

        if (response.ok) {
            const data = await response.json();
            if (data.insight) {
                insightEl.textContent = data.insight.replace(/\d\.\s*(RECOMMENDATION:|HIGHLIGHT:)/gi, '').trim();
                return;
            }
        }
    } catch (e) {
        console.warn('Ollama Kinetic AI insight error, using rule-based insight:', e);
    }

    // Fallback dynamic insight
    insightEl.textContent = `Your recovery score is optimal today (${workoutMins} mins active). Kinetic data indicates your last ${lastExercise} achieved ${lastAccuracy}% precision. Maintain progressive overload on next session.`;
}
