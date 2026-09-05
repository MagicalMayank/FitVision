/**
 * muscleMap.js — Post-Session Muscle Heatmap Engine
 * Maps each exercise to SVG element IDs in HRucY.svg, then applies .high / .moderate / .none
 * classes based on session avgFormScore + repsCompleted when a workout ends.
 *
 * Reuses the workoutCompleted custom event dispatched in camera.js:closeCameraModal
 * as the trigger — same hook the old 3D card used.
 */

// ─── Exercise → SVG element ID mapping ───────────────────────────────────────
// Each value is the full list of SVG muscle IDs that should be highlighted for
// that exercise. Anatomical notes for any adjustments made vs the draft spec are
// inline.
const EXERCISE_MUSCLE_MAP = {
    squat: [
        'front-quads-left', 'front-quads-right',
        'back-glutes',
        'back-hamstrings-left', 'back-hamstrings-right'
        // Note: back-lower-back added — erector spinae is a major squat stabiliser
        , 'back-lower-back'
    ],
    pushup: [
        'front-chest',
        'front-delts-left', 'front-delts-right',
        'front-biceps-left', 'front-biceps-right',  // stabilisers
        'back-triceps-left', 'back-triceps-right'
    ],
    lunge: [
        'front-quads-left', 'front-quads-right',
        'back-glutes',
        'back-hamstrings-left', 'back-hamstrings-right',
        'front-calves-left', 'front-calves-right'
    ],
    glute_bridge: [
        'back-glutes',
        'back-hamstrings-left', 'back-hamstrings-right',
        'back-lower-back'
    ],
    plank: [
        'front-abs',
        'front-obliques-left', 'front-obliques-right',
        'back-lower-back',
        // Note: added back-traps & front-delts — shoulder girdle bears significant
        // isometric load during a plank hold
        'back-traps',
        'front-delts-left', 'front-delts-right'
    ],
    bicep_curl: [
        'front-biceps-left', 'front-biceps-right',
        'front-forearms-left', 'front-forearms-right'
    ],
    shoulder_press: [
        'front-delts-left', 'front-delts-right',
        'back-triceps-left', 'back-triceps-right',
        'back-traps',
        // Note: added back-rear-delts — rear deltoid is a critical stabiliser
        // during pressing overhead
        'back-rear-delts-left', 'back-rear-delts-right'
    ],
    mountain_climber: [
        'front-abs',
        'front-obliques-left', 'front-obliques-right',
        'front-quads-left', 'front-quads-right',
        // Note: added front-delts — shoulder stabilisation is key in mountain climber
        'front-delts-left', 'front-delts-right'
    ],
    jumping_jack: [
        'front-delts-left', 'front-delts-right',
        'front-quads-left', 'front-quads-right',
        'front-calves-left', 'front-calves-right'
    ],
    calf_raise: [
        'front-calves-left', 'front-calves-right',
        'back-calves-left', 'back-calves-right'
    ]
};

// ─── All known SVG muscle element IDs ────────────────────────────────────────
const ALL_MUSCLE_IDS = [
    'front-head', 'front-neck',
    'front-delts-left', 'front-delts-right',
    'front-chest',
    'front-abs', 'front-obliques-left', 'front-obliques-right',
    'front-biceps-left', 'front-biceps-right',
    'front-forearms-left', 'front-forearms-right',
    'front-quads-left', 'front-quads-right',
    'front-calves-left', 'front-calves-right',
    'back-head', 'back-neck',
    'back-traps', 'back-lats',
    'back-rear-delts-left', 'back-rear-delts-right',
    'back-triceps-left', 'back-triceps-right',
    'back-forearms-left', 'back-forearms-right',
    'back-lower-back',
    'back-glutes',
    'back-hamstrings-left', 'back-hamstrings-right',
    'back-calves-left', 'back-calves-right'
];

// ─── Inline SVG fetcher + DOM injector ───────────────────────────────────────
async function loadHeatmapSVG(containerId) {
    const container = document.getElementById(containerId);
    if (!container || container.querySelector('svg')) return; // already loaded

    try {
        const resp = await fetch('/muscleMap.svg');
        if (!resp.ok) throw new Error('SVG fetch failed: ' + resp.status);
        const text = await resp.text();
        container.innerHTML = text;

        // Make the SVG responsive
        const svgEl = container.querySelector('svg');
        if (svgEl) {
            svgEl.removeAttribute('width');
            svgEl.removeAttribute('height');
            svgEl.style.width  = '100%';
            svgEl.style.height = 'auto';
            svgEl.style.display = 'block';
        }
    } catch (err) {
        console.error('[MuscleMap] Failed to load SVG:', err);
        container.innerHTML = '<p style="color:var(--on-surface-variant);text-align:center;padding:2rem;">Muscle map unavailable.</p>';
    }
}

// ─── Classification + class application ──────────────────────────────────────
function renderHeatmap({ exercise, avgFormScore, repsCompleted }) {
    // Normalise exercise key (handles "Squat" → "squat", "glute_bridge", etc.)
    const exKey = (exercise || 'squat')
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/-/g, '_');

    const targetIds = EXERCISE_MUSCLE_MAP[exKey] || [];
    const score     = typeof avgFormScore === 'number' ? avgFormScore : 0;
    const reps      = typeof repsCompleted === 'number' ? repsCompleted : 0;

    let engagementClass;
    if (score >= 80 && reps > 0) {
        engagementClass = 'high';
    } else if (score >= 50 && reps > 0) {
        engagementClass = 'moderate';
    } else {
        engagementClass = 'none';
    }

    // 1. Reset all muscles to .none first so stale highlights don't persist
    ALL_MUSCLE_IDS.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.remove('high', 'moderate', 'none');
            el.classList.add('none');
        }
    });

    // 2. Apply the computed class to the exercise's target muscles
    targetIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.remove('high', 'moderate', 'none');
            el.classList.add(engagementClass);
        }
    });

    // 3. Update the stat pills in the card header if present
    const scoreEl = document.getElementById('heatmap-score-pill');
    if (scoreEl) {
        scoreEl.textContent = reps > 0 ? `FORM ${Math.round(score)}%` : 'NO SESSION YET';
    }

    const exerciseEl = document.getElementById('heatmap-exercise-pill');
    if (exerciseEl) {
        exerciseEl.textContent = exercise
            ? exercise.toUpperCase().replace(/_/g, ' ')
            : '—';
    }

    console.log(`[MuscleMap] Rendered: exercise=${exKey}, score=${score}, reps=${reps} → ${engagementClass}`);
}

// ─── Show the card and scroll to it ──────────────────────────────────────────
function showMuscleHeatmapCard(sessionData) {
    const card = document.getElementById('muscleHeatmapCard');
    if (!card) return;

    card.style.display = 'block';

    // Reveal body if collapsed
    const body = document.getElementById('muscleHeatmapBody');
    if (body) body.style.display = 'block';

    // Flip chevron icon
    const collapseIcon = document.getElementById('collapseHeatmapIcon');
    if (collapseIcon) collapseIcon.innerText = 'expand_less';

    // Scroll into view
    setTimeout(() => {
        card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);

    // Render heatmap with session data
    renderHeatmap({
        exercise:       sessionData.exercise   || window.currentExercise || 'squat',
        avgFormScore:   sessionData.accuracy   || 0,
        repsCompleted:  sessionData.reps       || 0
    });
}

// ─── Wire up to the workoutCompleted event (same hook camera.js fires) ────────
window.addEventListener('workoutCompleted', () => {
    let sessionData = {};
    try {
        sessionData = JSON.parse(localStorage.getItem('kinetic_last_workout_session') || '{}');
    } catch (e) {}

    // Ensure SVG is loaded, then render
    loadHeatmapSVG('muscleHeatmapSVGContainer').then(() => {
        showMuscleHeatmapCard(sessionData);
    });
});

// ─── Collapse toggle ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('toggleHeatmapCollapseBtn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const body = document.getElementById('muscleHeatmapBody');
            const icon = document.getElementById('collapseHeatmapIcon');
            if (!body) return;
            const isCollapsed = body.style.display === 'none';
            body.style.display = isCollapsed ? 'block' : 'none';
            if (icon) icon.innerText = isCollapsed ? 'expand_less' : 'expand_more';
        });
    }
});

// Expose for external use / debug
window.muscleMap = { renderHeatmap, loadHeatmapSVG, showMuscleHeatmapCard, EXERCISE_MUSCLE_MAP };
